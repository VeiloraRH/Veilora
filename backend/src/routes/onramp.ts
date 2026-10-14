import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { getAddress, isAddress } from "viem";
import { query } from "../db/index";
import { getFreezeState } from "../freeze";
import {
  onrampRelay,
  readOnrampConfig,
  relayDepositAddress,
  routeFor,
  signWidgetUrl,
  summarizeRelayRequests,
  type OnrampAsset,
} from "../onramp";

export const onrampRouter = Router();

const SESSIONS_PER_HOUR = 20;
const ASSETS: OnrampAsset[] = ["USDG", "ETH"];

function safeConfig() {
  try { return readOnrampConfig(); } catch (error) {
    console.error("[onramp]", error instanceof Error ? error.message : error);
    return null;
  }
}

/** GET /v1/onramp/config — which assets can be bought and how they are delivered. */
onrampRouter.get("/config", (_req: Request, res: Response) => {
  const config = safeConfig();
  const routes = config ? ASSETS.map((asset) => routeFor(config, asset)).filter((r) => r !== null) : [];
  res.json({
    enabled: routes.length > 0,
    provider: "MoonPay",
    sandbox: config?.widgetBaseUrl.includes("sandbox") ?? false,
    assets: routes.map((r) => ({ asset: r.asset, route: r.kind, network: r.network })),
  });
});

/** POST /v1/onramp/session — a signed MoonPay checkout that delivers to the wallet. */
onrampRouter.post("/session", async (req: Request, res: Response): Promise<void> => {
  try {
    const config = safeConfig();
    const asset = req.body?.asset as OnrampAsset;
    if (!ASSETS.includes(asset)) { res.status(400).json({ error: "Choose USDG or ETH" }); return; }
    const route = config && routeFor(config, asset);
    if (!config || !route) { res.status(503).json({ error: "Adding funds by card or bank is not available right now" }); return; }
    const raw = String(req.body?.walletAddress ?? "");
    if (!isAddress(raw)) { res.status(400).json({ error: "A valid smart account address is required" }); return; }
    const wallet = getAddress(raw);
    const fiat = req.body?.fiatAmount === undefined ? null : Number(req.body.fiatAmount);
    if (fiat !== null && (!Number.isFinite(fiat) || fiat < 20 || fiat > 10_000)) { res.status(400).json({ error: "Enter an amount from $20 to $10,000" }); return; }

    const registered = await query("SELECT address FROM wallets WHERE address = $1", [wallet.toLowerCase()]);
    if (!registered.rows.length) { res.status(404).json({ error: "Wallet not found" }); return; }
    if ((await getFreezeState(wallet)).frozen) { res.status(403).json({ error: "This account is frozen. Lift the freeze before adding funds." }); return; }
    const recent = await query<{ n: number }>("SELECT count(*)::int AS n FROM onramp_sessions WHERE wallet_address = $1 AND created_at > now() - interval '1 hour'", [wallet.toLowerCase()]);
    if (recent.rows[0].n >= SESSIONS_PER_HOUR) { res.status(429).json({ error: "Too many checkouts started. Try again in an hour." }); return; }

    let deliverTo: string = wallet;
    let relay: Awaited<ReturnType<typeof relayDepositAddress>> | null = null;
    if (route.kind === "relay") {
      relay = await relayDepositAddress(route, wallet, config.refundAddress!);
      deliverTo = relay.depositAddress;
    }

    const id = randomUUID();
    const frontend = (process.env.FRONTEND_URL || "https://veilorarh.com").replace(/\/$/, "");
    const params: Record<string, string> = {
      apiKey: config.publishableKey,
      currencyCode: route.currencyCode,
      walletAddress: deliverTo,
      baseCurrencyCode: "usd",
      externalTransactionId: id,
      redirectURL: `${frontend}/app?funds=${id}`,
    };
    if (fiat !== null) params.baseCurrencyAmount = fiat.toFixed(2);
    const url = signWidgetUrl(config.widgetBaseUrl, params, config.secretKey);

    await query(
      `INSERT INTO onramp_sessions (id, wallet_address, asset, route, currency_code, deposit_address, relay_request_id, fiat_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, wallet.toLowerCase(), asset, route.kind, route.currencyCode, relay?.depositAddress.toLowerCase() ?? null, relay?.requestId ?? null, fiat],
    );
    res.status(201).json({
      sessionId: id,
      url,
      asset,
      route: route.kind,
      network: route.network,
      depositAddress: relay?.depositAddress ?? null,
      timeEstimateSeconds: relay?.timeEstimate ?? null,
    });
  } catch (error) {
    console.warn("[onramp] session failed", error instanceof Error ? error.message : error);
    res.status(502).json({ error: "Could not start checkout. Try again shortly." });
  }
});

/** GET /v1/onramp/session/:id — delivery progress. Relay-routed sessions report bridge status. */
onrampRouter.get("/session/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    if (!/^[0-9a-f-]{36}$/i.test(id)) { res.status(400).json({ error: "Invalid session" }); return; }
    const rows = await query("SELECT * FROM onramp_sessions WHERE id = $1", [id]);
    if (!rows.rows.length) { res.status(404).json({ error: "Session not found" }); return; }
    const session = rows.rows[0];
    const base = { sessionId: id, asset: session.asset, route: session.route, walletAddress: getAddress(session.wallet_address), createdAt: session.created_at };
    if (session.route !== "relay" || !session.deposit_address) {
      res.json({ ...base, deliveries: [], note: "MoonPay delivers straight to your account. Your balance updates when it lands." });
      return;
    }
    let deliveries: ReturnType<typeof summarizeRelayRequests> = [];
    try {
      deliveries = summarizeRelayRequests(await onrampRelay.request(`/requests/v3?depositAddress=${getAddress(session.deposit_address)}`));
    } catch {
      res.json({ ...base, depositAddress: getAddress(session.deposit_address), deliveries: [], note: "Delivery status is temporarily unavailable. Your purchase is not affected." });
      return;
    }
    res.json({ ...base, depositAddress: getAddress(session.deposit_address), deliveries, note: null });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to read session" });
  }
});
