import { getAddress } from "viem";

export type BlockscoutHistoryKind = "transactions" | "token-transfers" | "internal-transactions";

const DEFAULT_BLOCKSCOUT_API = "https://api.blockscout.com/4663/api/v2";

/** Build a server-only Blockscout URL; credentials never come from the browser query. */
export function buildBlockscoutHistoryUrl(
  address: string,
  kind: BlockscoutHistoryKind,
  apiKey = process.env.BLOCKSCOUT_API_KEY,
): URL {
  const base = (process.env.CHAIN_EXPLORER_API_URL || DEFAULT_BLOCKSCOUT_API).replace(/\/+$/, "");
  const url = new URL(`${base}/addresses/${getAddress(address)}/${kind}`);
  if (kind === "token-transfers") url.searchParams.set("type", "ERC-20");
  if (apiKey) url.searchParams.set("apikey", apiKey);
  return url;
}
