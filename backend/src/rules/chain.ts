import { publicClient } from "../config";

/** Overridable in tests so rule creation does not depend on a live RPC. */
export const ruleChain = { latestBlock: () => publicClient.getBlockNumber() };

export async function latestBlockForNewRule(): Promise<bigint> {
  try {
    return await ruleChain.latestBlock();
  } catch {
    throw Object.assign(new Error("Robinhood Chain is unreachable; try adding the rule again shortly"), { status: 503 });
  }
}
