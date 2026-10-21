import { formatUnits, getAddress, isAddress } from "viem";
import { query } from "./db/index";
import { RULE_ASSETS } from "./rules/spec";
import { ROBINHOOD_TOKEN_REGISTRY } from "./tokens";

/**
 * Read-only lookups behind Veily's wallet tools. Nothing here signs, approves
 * or changes anything; approving a pending run still needs the owner's 2-of-3
 * signature in the Rules screen.
 */
const amount = (raw: string, symbol: string) => formatUnits(BigInt(raw), RULE_ASSETS[symbol]?.decimals ?? 18);

/** Rule runs waiting for the owner's approval, soonest to expire first. */
export async function pendingReviews(wallet: string) {
  const rows = await query<{ id: string; rule_name: string; source_asset: string; total_raw: string; legs: unknown[]; trigger_detail: Record<string, unknown>; created_at: Date; expires_at: Date }>(
    `SELECT e.id::text, r.name AS rule_name, e.source_asset, e.total_raw::text, e.legs, e.trigger_detail, e.created_at, e.expires_at
     FROM wallet_rule_executions e JOIN wallet_rules r ON r.id = e.rule_id
     WHERE e.wallet_address = $1 AND e.status = 'pending' AND e.expires_at > now()
     ORDER BY e.expires_at ASC LIMIT 20`,
    [wallet.toLowerCase()],
  );
  return {
    pending: rows.rows.map((row) => ({
      id: row.id,
      rule: row.rule_name,
      amount: `${amount(row.total_raw, row.source_asset)} ${row.source_asset}`,
      steps: Array.isArray(row.legs) ? row.legs.length : 0,
      trigger: typeof row.trigger_detail?.type === "string" ? row.trigger_detail.type : null,
      waitingSince: row.created_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
    })),
    howToApprove: "Approve or decline each run in Rules. Approving still needs your device key and Veilora's co-signer; Veily cannot approve anything.",
  };
}

type ExplorerItem = { from?: { hash?: string } | null; to?: { hash?: string } | null; timestamp?: string };

/** Well-known addresses where anything sent is lost (kept in step with the app's recipient check). */
const BURN = new Set([
  "0x0000000000000000000000000000000000000000", "0x000000000000000000000000000000000000dead",
  "0xdead000000000000000042069420694206942069", "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  ...Array.from({ length: 9 }, (_, i) => `0x${(i + 1).toString(16).padStart(40, "0")}`),
]);
const TOKENS = new Map(Object.values(ROBINHOOD_TOKEN_REGISTRY).map((t) => [t.address.toLowerCase(), t.symbol]));

/**
 * Public facts about an address from this wallet's point of view. The owner's
 * contacts, blocklist and approved list stay on their device; the app adds
 * those checks itself, so they never reach the AI provider.
 */
export function addressFacts(walletAddress: string, address: string, code: string | null, items: ExplorerItem[]) {
  if (!isAddress(address)) return { error: "That is not a valid address" };
  const wallet = walletAddress.toLowerCase();
  const target = address.toLowerCase();
  let sent = 0, received = 0, first: string | null = null, last: string | null = null;
  for (const item of items) {
    const from = item.from?.hash?.toLowerCase(); const to = item.to?.hash?.toLowerCase();
    const outgoing = from === wallet && to === target; const incoming = from === target && to === wallet;
    if (!outgoing && !incoming) continue;
    if (outgoing) sent += 1; else received += 1;
    if (item.timestamp) { if (!first || item.timestamp < first) first = item.timestamp; if (!last || item.timestamp > last) last = item.timestamp; }
  }
  return {
    address: getAddress(address),
    isYourAccount: target === wallet,
    burnAddress: BURN.has(target),
    tokenContract: TOKENS.get(target) ?? null,
    isContract: code == null ? null : code !== "0x",
    transfersSentToIt: sent,
    transfersReceivedFromIt: received,
    firstSeen: first,
    lastSeen: last,
    note: "Counts cover the explorer's latest transfers for this wallet. Your contacts, blocklist and approved list are checked in the app, on your device.",
  };
}
