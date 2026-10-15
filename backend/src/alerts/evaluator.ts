import { formatUnits, getAddress, parseAbiItem, parseUnits, type Address } from "viem";
import { publicClient } from "../config";
import { db, query } from "../db/index";
import { quoteUsdgPrice, reportQuotePerformance } from "../rules/prices";
import { ROBINHOOD_TOKEN_REGISTRY } from "../tokens";
import { recordAlert } from "./store";

const TICK_MS = Math.max(15_000, Number(process.env.ALERTS_TICK_MS) || 60_000);
const MAX_BLOCKS_PER_SCAN = 2_000n;
const WALLETS_PER_QUERY = 50;
const LOCK_KEY = "veilora:alerts:evaluator";
const transferEvent = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
const tokens = Object.values(ROBINHOOD_TOKEN_REGISTRY);
const byAddress = new Map(tokens.map((t) => [t.address.toLowerCase(), t]));

export type IncomingLog = { token: Address; from: Address; to: Address; value: bigint; txHash: string; logIndex: number };
export type AlertDeps = {
  now: () => Date;
  latestBlock: () => Promise<bigint>;
  incoming: (wallets: Address[], fromBlock: bigint, toBlock: bigint) => Promise<IncomingLog[]>;
  usdgPrice: (symbol: string) => Promise<bigint>;
};

export const alertChainDeps: AlertDeps = {
  now: () => new Date(),
  latestBlock: () => publicClient.getBlockNumber(),
  incoming: async (wallets, fromBlock, toBlock) => {
    const logs = await publicClient.getLogs({ address: tokens.map((t) => t.address), event: transferEvent, args: { to: wallets }, fromBlock, toBlock });
    return logs.map((l) => ({ token: l.address, from: l.args.from!, to: l.args.to!, value: l.args.value ?? 0n, txHash: l.transactionHash ?? "", logIndex: l.logIndex ?? 0 }));
  },
  usdgPrice: quoteUsdgPrice,
};

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const amount = (raw: bigint, decimals: number) => Number(formatUnits(raw, decimals)).toLocaleString("en-US", { maximumFractionDigits: 6 });

/** One shared scan: every registered token, every wallet that has Alerts set up, since the last block seen. */
async function scanIncoming(deps: AlertDeps): Promise<number> {
  const rows = await query<{ wallet_address: string }>("SELECT wallet_address FROM wallet_alert_settings WHERE incoming = true");
  if (!rows.rows.length) return 0;
  const latest = await deps.latestBlock();
  const cursor = await query<{ block: string }>("SELECT block::text FROM alert_scan_cursor WHERE name = 'incoming'");
  // First run starts at the current block: alerts cover transfers from now on.
  const from = cursor.rows.length ? BigInt(cursor.rows[0].block) + 1n : latest;
  if (from > latest) return 0;
  const to = from + MAX_BLOCKS_PER_SCAN - 1n < latest ? from + MAX_BLOCKS_PER_SCAN - 1n : latest;
  let created = 0;
  const wallets = rows.rows.map((r) => getAddress(r.wallet_address));
  for (let i = 0; i < wallets.length; i += WALLETS_PER_QUERY) {
    for (const log of await deps.incoming(wallets.slice(i, i + WALLETS_PER_QUERY), from, to)) {
      const token = byAddress.get(log.token.toLowerCase());
      if (!token) continue;
      // Zero-value "transfers" from strangers are the address-poisoning pattern.
      const alert = log.value === 0n
        ? { type: "incoming" as const, severity: "warn" as const, title: `Suspicious 0 ${token.symbol} transfer`, body: `${short(log.from)} sent you a zero-value transfer. This is a common address-poisoning trick: never copy an address from it.` }
        : { type: "incoming" as const, severity: "success" as const, title: `Received ${amount(log.value, token.decimals)} ${token.symbol}`, body: `From ${short(log.from)}. It's in your account now.` };
      if (await recordAlert(log.to, { ...alert, ref: `incoming:${log.txHash}:${log.logIndex}`, data: { txHash: log.txHash, from: log.from, token: token.symbol, raw: log.value.toString() } })) created += 1;
    }
  }
  await query(
    `INSERT INTO alert_scan_cursor (name, block) VALUES ('incoming', $1)
     ON CONFLICT (name) DO UPDATE SET block = EXCLUDED.block, updated_at = now()`,
    [to.toString()],
  );
  return created;
}

/** Price alerts fire once per crossing, then re-arm when the price moves back. */
async function checkPrices(deps: AlertDeps): Promise<number> {
  const rows = await query<{ id: string; wallet_address: string; asset: string; direction: "above" | "below"; price_usdg: string; armed: boolean }>(
    "SELECT id, wallet_address, asset, direction, price_usdg, armed FROM wallet_price_alerts ORDER BY id LIMIT 2000",
  );
  const prices = new Map<string, bigint | null>();
  let created = 0;
  for (const row of rows.rows) {
    if (!prices.has(row.asset)) prices.set(row.asset, await deps.usdgPrice(row.asset).catch(() => null));
    const price = prices.get(row.asset);
    if (price == null) continue;
    const target = parseUnits(row.price_usdg, 6);
    const met = row.direction === "above" ? price >= target : price <= target;
    const now = deps.now();
    if (met && row.armed && await recordAlert(row.wallet_address, {
      type: "price", severity: "info",
      title: `${row.asset} is ${row.direction} ${Number(row.price_usdg).toLocaleString("en-US")} USDG`,
      body: `${row.asset} is now ${amount(price, 6)} USDG on Uniswap. Your alert will fire again after the price moves back.`,
      ref: `price:${row.id}:${now.toISOString()}`, data: { asset: row.asset, priceRaw: price.toString(), alertId: row.id },
    })) created += 1;
    await query("UPDATE wallet_price_alerts SET armed = $2, last_price = $3, last_checked_at = $4, last_triggered_at = CASE WHEN $5 THEN $4 ELSE last_triggered_at END WHERE id = $1",
      [row.id, !met, price.toString(), now, met && row.armed]);
  }
  return created;
}

export async function evaluateAlerts(deps: AlertDeps = alertChainDeps): Promise<number> {
  const started = performance.now();
  let created = 0;
  try {
    try { created += await scanIncoming(deps); } catch (error) {
      console.warn(JSON.stringify({ msg: "incoming alert scan failed", error: error instanceof Error ? error.message : String(error) }));
    }
    try { created += await checkPrices(deps); } catch (error) {
      console.warn(JSON.stringify({ msg: "price alert check failed", error: error instanceof Error ? error.message : String(error) }));
    }
    return created;
  } finally {
    const duration = performance.now() - started;
    console.info(JSON.stringify({ msg: "alerts evaluator pass", duration_ms: Math.round(duration), alerts_created: created }));
    reportQuotePerformance("alerts", duration);
  }
}

/** Background loop; a session advisory lock keeps one evaluator active across replicas. */
export function startAlertsEvaluator(deps: AlertDeps = alertChainDeps): () => void {
  let stopped = false;
  let running = false;
  const tick = async () => {
    if (running || stopped) return;
    running = true;
    const client = await db.connect().catch(() => null);
    if (!client) { running = false; return; }
    try {
      const lock = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock(hashtext($1)) AS ok", [LOCK_KEY]);
      if (!lock.rows[0]?.ok) return;
      try { await evaluateAlerts(deps); } finally { await client.query("SELECT pg_advisory_unlock(hashtext($1))", [LOCK_KEY]); }
    } catch (error) {
      console.warn(JSON.stringify({ msg: "alerts evaluator tick failed", error: error instanceof Error ? error.message : String(error) }));
    } finally {
      client.release();
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), TICK_MS);
  void tick();
  return () => { stopped = true; clearInterval(timer); };
}
