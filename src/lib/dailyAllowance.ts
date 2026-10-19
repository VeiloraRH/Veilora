import type { WalletToken } from './tokens';
import type { SpendingPolicy } from './spendingPolicy';

const NATIVE_ASSET = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

export type AllowanceRow = { token: WalletToken; used: bigint; total: bigint; remaining: bigint; percentUsed: number };

/**
 * Today's co-signer allowance per asset, mirroring the co-signer: the daily
 * total is a percentage of the balance at the start of today's co-signed
 * spending, and resets at 00:00 UTC. Assets with no balance and no spend
 * today are left out; the most-used come first.
 */
export function allowanceRows(holdings: { token: WalletToken; raw: bigint | null }[], policy: SpendingPolicy, limit = 5): AllowanceRow[] {
 const rows: AllowanceRow[] = [];
 for (const { token, raw } of holdings) {
  if (raw == null) continue;
  const daily = policy.dailySpend[(token.native ? NATIVE_ASSET : token.address).toLowerCase()];
  const used = BigInt(daily?.spent ?? '0');
  if (raw === 0n && used === 0n) continue;
  const startBalance = daily?.balance == null ? raw + used : BigInt(daily.balance);
  const total = startBalance * BigInt(policy.dailyTotalPercent) / 100n;
  const remaining = total > used ? total - used : 0n;
  rows.push({ token, used, total, remaining, percentUsed: total > 0n ? Math.min(100, Number(used * 10_000n / total) / 100) : used > 0n ? 100 : 0 });
 }
 return rows.sort((a, b) => b.percentUsed - a.percentUsed || Number(b.total > a.total) - Number(b.total < a.total)).slice(0, limit);
}

export function untilUtcMidnight(now = Date.now()): number {
 const next = new Date(now);
 next.setUTCHours(24, 0, 0, 0);
 return next.getTime() - now;
}

export function resetsIn(ms: number): string {
 const minutes = Math.max(1, Math.ceil(ms / 60_000));
 const h = Math.floor(minutes / 60); const m = minutes % 60;
 return h ? `${h}h ${m}m` : `${m}m`;
}
