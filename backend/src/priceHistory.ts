import { Router } from "express";
import { db, query } from "./db/index";
import { RULE_ASSETS } from "./rules/spec";
import { quoteUsdgPrice } from "./rules/prices";

/**
 * Price history for the dashboard's 24-hour change. One background loop samples
 * every asset's USDG price into 15-minute buckets; a public endpoint serves the
 * samples. Prices are public data, so a request reveals nothing about a wallet.
 */
export const SAMPLE_MINUTES = 15;
export const RETENTION_DAYS = 8;
const LOCK_KEY = "veilora:prices:sampler";
const TICK_MS = Math.max(60_000, Number(process.env.PRICE_SAMPLER_TICK_MS) || 5 * 60_000);
const MAX_HOURS = 7 * 24;
const PRICED = Object.keys(RULE_ASSETS).filter((symbol) => symbol !== "USDG");

export const bucketStart = (date: Date) => new Date(Math.floor(date.getTime() / (SAMPLE_MINUTES * 60_000)) * SAMPLE_MINUTES * 60_000);

/** Record one sample per asset for the current bucket. Assets without a live quote are skipped. */
export async function samplePrices(now = new Date(), price: (symbol: string) => Promise<bigint> = quoteUsdgPrice): Promise<number> {
  const bucket = bucketStart(now);
  const results = await Promise.allSettled(PRICED.map(async (symbol) => [symbol, await price(symbol)] as const));
  const rows = results.flatMap((r) => (r.status === "fulfilled" && r.value[1] > 0n ? [r.value] : []));
  for (const [symbol, raw] of rows) {
    await query("INSERT INTO price_samples (symbol, sampled_at, price_raw) VALUES ($1, $2, $3) ON CONFLICT (symbol, sampled_at) DO NOTHING", [symbol, bucket, raw.toString()]);
  }
  await query("DELETE FROM price_samples WHERE sampled_at < $1", [new Date(now.getTime() - RETENTION_DAYS * 86_400_000)]);
  return rows.length;
}

export type PricePoint = { t: string; price: string };
export async function priceHistory(symbols: string[], hours: number, now = new Date()): Promise<Record<string, PricePoint[]>> {
  const since = new Date(now.getTime() - hours * 3_600_000);
  const result = await query<{ symbol: string; sampled_at: Date; price_raw: string }>(
    "SELECT symbol, sampled_at, price_raw::text FROM price_samples WHERE symbol = ANY($1) AND sampled_at >= $2 ORDER BY sampled_at",
    [symbols, since],
  );
  const history: Record<string, PricePoint[]> = Object.fromEntries(symbols.map((s) => [s, []]));
  for (const row of result.rows) history[row.symbol].push({ t: row.sampled_at.toISOString(), price: row.price_raw });
  return history;
}

export const pricesRouter = Router();

/** GET /v1/prices/history?symbols=ETH,NVDA&hours=24 — raw USDG prices (6 decimals) per 15-minute bucket. */
pricesRouter.get("/history", async (req, res) => {
  const symbols = [...new Set(String(req.query.symbols ?? "").split(",").map((s) => s.trim()).filter(Boolean))];
  const hours = Number(req.query.hours ?? 24);
  if (!symbols.length || symbols.length > 60 || symbols.some((s) => !PRICED.includes(s)) || !Number.isInteger(hours) || hours < 1 || hours > MAX_HOURS) {
    res.status(400).json({ error: "Ask for supported symbols and 1 to 168 hours" });
    return;
  }
  try {
    res.set("Cache-Control", "public, max-age=60");
    res.json({ intervalMinutes: SAMPLE_MINUTES, prices: await priceHistory(symbols, hours) });
  } catch {
    res.status(500).json({ error: "Price history is unavailable" });
  }
});

/** Background loop; an advisory lock keeps one sampler active across replicas. */
export function startPriceSampler(): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    const client = await db.connect().catch(() => null);
    if (!client) { running = false; return; }
    try {
      const lock = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock(hashtext($1)) AS ok", [LOCK_KEY]);
      if (!lock.rows[0]?.ok) return;
      try { await samplePrices(); } finally { await client.query("SELECT pg_advisory_unlock(hashtext($1))", [LOCK_KEY]); }
    } catch (error) {
      console.warn(JSON.stringify({ msg: "price sampler tick failed", error: error instanceof Error ? error.message : String(error) }));
    } finally {
      client.release();
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), TICK_MS);
  void tick();
  return () => clearInterval(timer);
}
