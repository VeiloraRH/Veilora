import { formatUnits } from "viem";
import { query } from "./db/index";
import { RULE_ASSETS } from "./rules/spec";

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
