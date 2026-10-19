import { getAddress, isAddress, zeroAddress } from 'viem';
import type { WalletTransaction } from './walletQueries';
import type { WalletContact } from './contacts';

export type RecentRecipient = { address: `0x${string}`; name: string | null; lastSentAt: string };

/**
 * People this wallet recently sent to, newest first, from its own confirmed
 * history. Blocked addresses, the wallet itself and bridge deposits are left
 * out. Picking one only fills the address; every Send check still runs.
 */
export function recentRecipients(transactions: WalletTransaction[], wallet: string, contacts: WalletContact[], blocked: string[], limit = 5): RecentRecipient[] {
 const skip = new Set([wallet.toLowerCase(), zeroAddress, ...blocked.map(a => a.toLowerCase())]);
 const names = new Map(contacts.map(c => [c.address.toLowerCase(), c.name]));
 const seen = new Set<string>();
 const result: RecentRecipient[] = [];
 const sent = transactions.filter(t => t.direction === 'sent' && t.status === 'confirmed' && t.kind !== 'bridge' && isAddress(t.to))
  .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
 for (const t of sent) {
  const key = t.to.toLowerCase();
  if (skip.has(key) || seen.has(key)) continue;
  seen.add(key);
  result.push({ address: getAddress(t.to), name: names.get(key) ?? null, lastSentAt: t.timestamp });
  if (result.length >= limit) break;
 }
 return result;
}
