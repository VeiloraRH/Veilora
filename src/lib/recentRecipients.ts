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

export type RecipientSuggestion = { address: `0x${string}`; name: string | null; note?: string; source: 'contact' | 'recent' };

/**
 * Matches for what is typed in a recipient field: saved contacts by name, note
 * or address, then recent recipients by address. Nothing is suggested once a
 * full address is typed, so a pasted address is never swapped for another.
 */
export function suggestRecipients(query: string, contacts: WalletContact[], recent: RecentRecipient[], limit = 5): RecipientSuggestion[] {
 const q = query.trim().toLowerCase();
 if (!q || isAddress(q)) return [];
 const words = q.split(/\s+/);
 const seen = new Set<string>();
 const out: RecipientSuggestion[] = [];
 for (const c of contacts) {
  const text = `${c.name} ${c.note ?? ''} ${c.address}`.toLowerCase();
  if (words.every(w => text.includes(w)) && !seen.has(c.address.toLowerCase())) { seen.add(c.address.toLowerCase()); out.push({ address: c.address, name: c.name, note: c.note, source: 'contact' }); }
 }
 for (const r of recent) {
  if (!seen.has(r.address.toLowerCase()) && r.address.toLowerCase().includes(q)) { seen.add(r.address.toLowerCase()); out.push({ address: r.address, name: r.name, source: 'recent' }); }
 }
 return out.slice(0, limit);
}
