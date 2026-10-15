import type { WalletToken } from './tokens';
import type { SpendingPolicy } from './spendingPolicy';

const NATIVE_ASSET = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

/** Mirrors the co-signer's per-transaction and UTC-day allowance calculation. */
export function spendingAllowance(token: WalletToken, balance: bigint | null | undefined, policy: SpendingPolicy | undefined) {
  if (balance == null || !policy) return null;
  const key = (token.native ? NATIVE_ASSET : token.address).toLowerCase();
  const daily = policy.dailySpend[key];
  const spent = BigInt(daily?.spent ?? '0');
  const startBalance = daily?.balance == null ? balance + spent : BigInt(daily.balance);
  const perTransaction = balance * BigInt(policy.perTransactionPercent) / 100n;
  const dailyTotal = startBalance * BigInt(policy.dailyTotalPercent) / 100n;
  const dailyRemaining = dailyTotal > spent ? dailyTotal - spent : 0n;
  return {
    perTransaction,
    dailyRemaining,
    max: perTransaction < dailyRemaining ? perTransaction : dailyRemaining,
  };
}
