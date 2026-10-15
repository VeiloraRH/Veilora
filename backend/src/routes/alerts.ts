import { Router, type Request, type Response } from "express";
import { getAddress, isAddress, isHex, parseUnits, recoverMessageAddress } from "viem";
import { query } from "../db/index";
import { RULE_ASSETS } from "../rules/spec";

/**
 * Alerts API, mounted at /v1/wallets/:address/alerts. Reads and changes need a
 * fresh Shard A signature, since alerts describe the owner's activity.
 */
export const alertsRouter = Router({ mergeParams: true });

const WINDOW_SECONDS = 300;
const MAX_PRICE_ALERTS = 10;
export const PRICE_ASSETS = Object.keys(RULE_ASSETS).filter((s) => s !== "USDG");

export const alertsReadMessage = (wallet: string, ts: number) => `Veilora alerts access\nwallet:${getAddress(wallet)}\ntimestamp:${ts}`;
export const alertsChangeMessage = (wallet: string, action: string, payload: string, ts: number) =>
  `Veilora alerts change\nwallet:${getAddress(wallet)}\naction:${action}\npayload:${payload}\ntimestamp:${ts}`;

class HttpError extends Error { constructor(readonly status: number, message: string) { super(message); } }

async function walletOf(req: Request) {
  const raw = String(req.params.address);
  if (!isAddress(raw)) throw new HttpError(400, "A valid smart account address is required");
  const rows = await query("SELECT address, shard_a_address FROM wallets WHERE address = $1", [raw.toLowerCase()]);
  if (!rows.rows.length) throw new HttpError(404, "Wallet not found");
  return { address: rows.rows[0].address as string, shardA: String(rows.rows[0].shard_a_address).toLowerCase() };
}

async function verify(wallet: { shardA: string }, message: string, signature: unknown, timestamp: unknown) {
  const ts = Number(timestamp);
  if (!Number.isSafeInteger(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > WINDOW_SECONDS) throw new HttpError(400, "A fresh Shard A authorization is required");
  if (typeof signature !== "string" || !isHex(signature) || signature.length !== 132) throw new HttpError(400, "A valid Shard A signature is required");
  const signer = await recoverMessageAddress({ message, signature });
  if (signer.toLowerCase() !== wallet.shardA) throw new HttpError(403, "Signature does not match this wallet's Shard A");
  return signature;
}

async function consume(wallet: string, signature: string) {
  const r = await query("INSERT INTO wallet_alert_authorizations (signature, wallet_address) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING signature", [signature.toLowerCase(), wallet]);
  if (!r.rows.length) throw new HttpError(409, "This authorization has already been used");
  await query("DELETE FROM wallet_alert_authorizations WHERE created_at < now() - interval '1 day'");
}

function fail(res: Response, error: unknown, fallback: string) {
  if (error instanceof HttpError) { res.status(error.status).json({ error: error.message }); return; }
  res.status(500).json({ error: error instanceof Error ? error.message : fallback });
}

async function state(wallet: string) {
  const [alerts, unread, settings, prices] = await Promise.all([
    query("SELECT id, type, severity, title, body, data, created_at, read_at FROM wallet_alerts WHERE wallet_address = $1 ORDER BY id DESC LIMIT 60", [wallet]),
    query<{ n: number }>("SELECT count(*)::int AS n FROM wallet_alerts WHERE wallet_address = $1 AND read_at IS NULL", [wallet]),
    query<{ incoming: boolean; rules: boolean; prices: boolean }>("SELECT incoming, rules, prices FROM wallet_alert_settings WHERE wallet_address = $1", [wallet]),
    query("SELECT id, asset, direction, price_usdg, armed, last_price, last_triggered_at, created_at FROM wallet_price_alerts WHERE wallet_address = $1 ORDER BY id", [wallet]),
  ]);
  return {
    alerts: alerts.rows.map((a) => ({ id: String(a.id), type: a.type, severity: a.severity, title: a.title, body: a.body, data: a.data, createdAt: a.created_at, read: a.read_at !== null })),
    unread: unread.rows[0]?.n ?? 0,
    settings: { incoming: settings.rows[0]?.incoming ?? true, rules: settings.rows[0]?.rules ?? true, prices: settings.rows[0]?.prices ?? true, security: true },
    priceAlerts: prices.rows.map((p) => ({ id: String(p.id), asset: p.asset, direction: p.direction, priceUsdg: p.price_usdg, armed: p.armed, lastPriceRaw: p.last_price, lastTriggeredAt: p.last_triggered_at, createdAt: p.created_at })),
    priceAssets: PRICE_ASSETS,
  };
}

/** GET / — feed, unread count, settings and price alerts. Opening Alerts turns on incoming-transfer scanning. */
alertsRouter.get("/", async (req, res) => {
  try {
    const wallet = await walletOf(req);
    await verify(wallet, alertsReadMessage(wallet.address, Number(req.header("x-veilora-timestamp"))), req.header("x-veilora-signature"), req.header("x-veilora-timestamp"));
    await query("INSERT INTO wallet_alert_settings (wallet_address) VALUES ($1) ON CONFLICT DO NOTHING", [wallet.address]);
    res.json(await state(wallet.address));
  } catch (error) { fail(res, error, "Failed to load alerts"); }
});

/** POST /change — { action, payload, timestamp, shardASignature }. */
alertsRouter.post("/change", async (req, res) => {
  try {
    const wallet = await walletOf(req);
    const action = String(req.body?.action ?? "");
    const payload = String(req.body?.payload ?? "");
    const signature = await verify(wallet, alertsChangeMessage(wallet.address, action, payload, Number(req.body?.timestamp)), req.body?.shardASignature, req.body?.timestamp);

    if (action === "read-all") {
      if (payload !== "all") throw new HttpError(400, "read-all takes payload 'all'");
      await consume(wallet.address, signature);
      await query("UPDATE wallet_alerts SET read_at = now() WHERE wallet_address = $1 AND read_at IS NULL", [wallet.address]);
    } else if (action === "read-one" || action === "unread-one") {
      if (!/^\d{1,18}$/.test(payload)) throw new HttpError(400, `${action} takes the alert ID`);
      await consume(wallet.address, signature);
      const readAt = action === "read-one" ? "now()" : "NULL";
      const r = await query(`UPDATE wallet_alerts SET read_at = ${readAt} WHERE id = $1 AND wallet_address = $2 RETURNING id`, [payload, wallet.address]);
      if (!r.rows.length) throw new HttpError(404, "Alert not found");
    } else if (action === "settings") {
      const m = /^incoming=([01]);rules=([01]);prices=([01])$/.exec(payload);
      if (!m) throw new HttpError(400, "settings payload must be incoming=0|1;rules=0|1;prices=0|1");
      await consume(wallet.address, signature);
      await query(
        `INSERT INTO wallet_alert_settings (wallet_address, incoming, rules, prices) VALUES ($1, $2, $3, $4)
         ON CONFLICT (wallet_address) DO UPDATE SET incoming = EXCLUDED.incoming, rules = EXCLUDED.rules, prices = EXCLUDED.prices, updated_at = now()`,
        [wallet.address, m[1] === "1", m[2] === "1", m[3] === "1"],
      );
    } else if (action === "price-add") {
      const m = /^([A-Z]{1,10}):(above|below):((?:0|[1-9]\d{0,11})(?:\.\d{1,6})?)$/.exec(payload);
      if (!m || !PRICE_ASSETS.includes(m[1])) throw new HttpError(400, "Choose a supported asset, above or below, and a price in USDG");
      if (parseUnits(m[3], 6) <= 0n) throw new HttpError(400, "The price must be greater than zero");
      const count = await query<{ n: number }>("SELECT count(*)::int AS n FROM wallet_price_alerts WHERE wallet_address = $1", [wallet.address]);
      if (count.rows[0].n >= MAX_PRICE_ALERTS) throw new HttpError(409, `You can have up to ${MAX_PRICE_ALERTS} price alerts`);
      await consume(wallet.address, signature);
      await query("INSERT INTO wallet_price_alerts (wallet_address, asset, direction, price_usdg) VALUES ($1, $2, $3, $4)", [wallet.address, m[1], m[2], m[3]]);
    } else if (action === "price-remove") {
      if (!/^\d{1,18}$/.test(payload)) throw new HttpError(400, "price-remove takes the alert ID");
      await consume(wallet.address, signature);
      const r = await query("DELETE FROM wallet_price_alerts WHERE id = $1 AND wallet_address = $2 RETURNING id", [payload, wallet.address]);
      if (!r.rows.length) throw new HttpError(404, "Price alert not found");
    } else {
      throw new HttpError(400, "Unknown action");
    }
    res.json(await state(wallet.address));
  } catch (error) { fail(res, error, "Failed to update alerts"); }
});
