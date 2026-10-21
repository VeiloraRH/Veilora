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

export type HealthCheck = { check: string; status: "ok" | "attention" | "unknown"; detail: string };
type OnChain = { shardA: string; shardB: string; shardC: string } | null;

/**
 * Server-side health of the wallet: keys registered vs. the keys the deployed
 * account accepts, freeze state, authenticator and spending limits. Checks only
 * the device can make (backups, recovery drills) are shown in the app.
 */
export async function walletHealth(wallet: string, readChain: (address: `0x${string}`) => Promise<OnChain>) {
  const rows = await query<{ shard_a_address: string; shard_b_address: string; shard_c_address: string; is_frozen: boolean; frozen_until: Date | null; totp_enabled_at: Date | null; per_transaction_percent: number | null; daily_total_percent: number | null }>(
    `SELECT w.shard_a_address, w.shard_b_address, w.shard_c_address, w.is_frozen, w.frozen_until, w.totp_enabled_at, p.per_transaction_percent, p.daily_total_percent
     FROM wallets w LEFT JOIN wallet_spending_policies p ON p.wallet_address = w.address WHERE w.address = $1`,
    [wallet.toLowerCase()],
  );
  const w = rows.rows[0];
  if (!w) return { error: "Wallet not found" };
  let onChain: OnChain = null; let reachable = true;
  try { onChain = await readChain(getAddress(wallet)); } catch { reachable = false; }
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const frozen = w.is_frozen && (!w.frozen_until || w.frozen_until > new Date());
  const perTx = w.per_transaction_percent ?? 20; const daily = w.daily_total_percent ?? 20;
  const checks: HealthCheck[] = [
    !reachable ? { check: "On-chain account", status: "unknown", detail: "Robinhood Chain could not be reached, so the on-chain keys were not checked." }
      : !onChain ? { check: "On-chain account", status: "attention", detail: "The smart account is not deployed yet." }
      : { check: "On-chain account", status: "ok", detail: "Deployed on Robinhood Chain." },
    ...(onChain ? (["A", "B", "C"] as const).map((k): HealthCheck => {
      const registered = k === "A" ? w.shard_a_address : k === "B" ? w.shard_b_address : w.shard_c_address;
      const live = k === "A" ? onChain!.shardA : k === "B" ? onChain!.shardB : onChain!.shardC;
      const name = k === "A" ? "Device key (Shard A)" : k === "B" ? "Co-signer key (Shard B)" : "Recovery key (Shard C)";
      return same(registered, live) ? { check: name, status: "ok", detail: "Matches the key the account accepts on-chain." }
        : { check: name, status: "attention", detail: "Differs from the key the account accepts on-chain; check Quorum & recovery." };
    }) : []),
    frozen ? { check: "Co-signer", status: "attention", detail: `Frozen${w.frozen_until ? ` until ${w.frozen_until.toISOString()}` : ""}; nothing will be co-signed.` }
      : { check: "Co-signer", status: "ok", detail: "Signing policy-approved requests." },
    w.totp_enabled_at ? { check: "Authenticator freeze", status: "ok", detail: "An authenticator code can freeze the account from any device." }
      : { check: "Authenticator freeze", status: "attention", detail: "Not set up. Adding one lets you freeze from any device without your recovery key." },
    { check: "Spending limits", status: perTx <= 50 && daily <= 50 ? "ok" : "attention", detail: `Up to ${perTx}% of a balance per transaction and ${daily}% per day.` },
  ];
  return { checks, onDeviceChecks: "Backups and the recovery drill are checked on the device; see the dashboard health card.", fixIn: "Quorum & recovery (Security)" };
}
