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

let weth: Address | undefined;

/**
 * Best Uniswap v3 quote for one whole unit of `symbol`, in raw USDG (6 decimals).
 * This is the same venue the wallet swaps through, so a price rule fires on the
 * price the owner would actually be quoted.
 */
export async function quoteUsdgPrice(symbol: string): Promise<bigint> {
  const asset = RULE_ASSETS[symbol];
  const usdg = RULE_ASSETS.USDG;
  if (!asset || !usdg.address) throw new Error(`Unsupported asset ${symbol}`);
  if (symbol === "USDG") return parseUnits("1", 6);
  weth ??= getAddress(await publicClient.readContract({ address: SWAP_ROUTER, abi: routerAbi, functionName: "WETH9" }));
  const tokenIn = asset.native ? weth : asset.address!;
  const amountIn = parseUnits("1", asset.decimals);
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
