import { getAddress, parseAbi, parseUnits, type Address } from "viem";
import { publicClient } from "../config";
import { RULE_ASSETS } from "./spec";

const SWAP_ROUTER = getAddress("0xcaf681a66d020601342297493863e78c959e5cb2");
const V3_QUOTER = getAddress("0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7");
const FEE_TIERS = [100, 500, 3000, 10000];
const routerAbi = parseAbi(["function WETH9() view returns (address)"]);
const quoterAbi = parseAbi([
  "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)",
]);

const configuredCacheTtl = Number(process.env.QUOTE_PRICE_CACHE_MS);
const CACHE_TTL_MS = Number.isFinite(configuredCacheTtl) && configuredCacheTtl > 0
  ? Math.min(30_000, Math.max(1_000, configuredCacheTtl))
  : 10_000;
const quoteCache = new Map<string, { value: bigint; expiresAt: number }>();
const inFlight = new Map<string, Promise<bigint>>();
let wethPromise: Promise<Address> | undefined;
let metrics = { requests: 0, cacheHits: 0, coalesced: 0, quoteLoads: 0, quoterCalls: 0 };
let lastMetricsLog = Date.now();

function routerWeth(): Promise<Address> {
  wethPromise ??= publicClient.readContract({ address: SWAP_ROUTER, abi: routerAbi, functionName: "WETH9" })
    .then((address) => getAddress(address))
    .catch((error) => { wethPromise = undefined; throw error; });
  return wethPromise;
}

async function loadQuote(symbol: string): Promise<bigint> {
  const asset = RULE_ASSETS[symbol]!;
  const usdg = RULE_ASSETS.USDG!;
  const tokenIn = asset.native ? await routerWeth() : asset.address!;
  const amountIn = parseUnits("1", asset.decimals);
  metrics.quoterCalls += FEE_TIERS.length;
  const quotes = await Promise.allSettled(FEE_TIERS.map(async (fee) => {
    const { result } = await publicClient.simulateContract({
      address: V3_QUOTER,
      abi: quoterAbi,
      functionName: "quoteExactInputSingle",
      args: [{ tokenIn, tokenOut: usdg.address!, amountIn, fee, sqrtPriceLimitX96: 0n }],
    });
    return result[0];
  }));
  const best = quotes.reduce<bigint>((top, q) => (q.status === "fulfilled" && q.value > top ? q.value : top), 0n);
  if (best === 0n) throw new Error(`No live USDG quote for ${symbol}`);
  return best;
}

/** Shared process-local quote counters, drained into Render logs at most once a minute. */
export function reportQuotePerformance(reporter: string, durationMs: number): void {
  const now = Date.now();
  if (now - lastMetricsLog < 60_000) return;
  const snapshot = metrics;
  metrics = { requests: 0, cacheHits: 0, coalesced: 0, quoteLoads: 0, quoterCalls: 0 };
  lastMetricsLog = now;
  console.info(JSON.stringify({ msg: "shared quote performance", reporter, evaluation_ms: Math.round(durationMs), cache_ttl_ms: CACHE_TTL_MS, ...snapshot }));
}

/**
 * Best Uniswap v3 quote for one whole unit of `symbol`, in raw USDG (6 decimals).
 * This is the same venue the wallet swaps through, so a price rule fires on the
 * price the owner would actually be quoted.
 */
export async function quoteUsdgPrice(symbol: string): Promise<bigint> {
  const asset = RULE_ASSETS[symbol];
  const usdg = RULE_ASSETS.USDG;
  if (!asset || !usdg.address) throw new Error(`Unsupported asset ${symbol}`);
  metrics.requests += 1;
  if (symbol === "USDG") return parseUnits("1", 6);
  const cached = quoteCache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) {
    metrics.cacheHits += 1;
    return cached.value;
  }
  const pending = inFlight.get(symbol);
  if (pending) {
    metrics.coalesced += 1;
    return pending;
  }

  metrics.quoteLoads += 1;
  const loading = loadQuote(symbol);
  inFlight.set(symbol, loading);
  try {
    const value = await loading;
    quoteCache.set(symbol, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  } finally {
    if (inFlight.get(symbol) === loading) inFlight.delete(symbol);
  }
}
