import { expect, test } from 'bun:test';
import type { WalletTransaction } from '../src/lib/walletQueries';
import { recentRecipients } from '../src/lib/recentRecipients';

const wallet = '0x1111111111111111111111111111111111111111';
const a = (n: number) => `0x${String(n).repeat(40).slice(0, 40)}`;
const tx = (to: string, day: number, extra: Partial<WalletTransaction> = {}): WalletTransaction => ({
 id: `${to}-${day}`, hash: `0x${day}`, timestamp: `2026-10-${String(day).padStart(2, '0')}T10:00:00Z`, direction: 'sent', symbol: 'USDG', amount: '1', from: wallet, to, status: 'confirmed', ...extra,
});

test('newest distinct recipients with contact names, skipping what should not be suggested', () => {
 const history = [
  tx(a(2), 10), tx(a(3), 12), tx(a(2), 15),
  tx(a(4), 16, { status: 'failed' }),
  tx(a(5), 17, { kind: 'bridge' }),
  tx(a(6), 18, { direction: 'received' }),
  tx(a(7), 14),
  tx(wallet, 19),
 ];
 const result = recentRecipients(history, wallet, [{ id: 'c', name: 'Studio', address: a(3) as `0x${string}` }], [a(7)]);
 expect(result.map(r => [r.address.toLowerCase(), r.name])).toEqual([[a(2), null], [a(3), 'Studio']]);
 expect(result[0].lastSentAt).toBe('2026-10-15T10:00:00Z');
});

test('stops at the limit', () => {
 const history = [2, 3, 4, 5, 6, 7, 8].map((n, i) => tx(a(n), 10 + i));
 expect(recentRecipients(history, wallet, [], [], 3).map(r => r.address.toLowerCase())).toEqual([a(8), a(7), a(6)]);
});

test('suggests contacts by name, note or address, then recent addresses, never for a full address', async () => {
 const { suggestRecipients } = await import('../src/lib/recentRecipients');
 const contacts = [
  { id: '1', name: 'Cold wallet', address: a(3) as `0x${string}` },
  { id: '2', name: 'Maya', address: a(4) as `0x${string}`, note: 'Landlord, rent' },
 ];
 const recent = [{ address: a(5) as `0x${string}`, name: null, lastSentAt: '' }, { address: a(3) as `0x${string}`, name: 'Cold wallet', lastSentAt: '' }];
 expect(suggestRecipients('cold wa', contacts, recent).map(s => s.name)).toEqual(['Cold wallet']);
 expect(suggestRecipients('RENT', contacts, recent).map(s => s.source)).toEqual(['contact']);
 expect(suggestRecipients('0x5555', contacts, recent)).toEqual([{ address: a(5), name: null, source: 'recent' }]);
 expect(suggestRecipients('0x3333', contacts, recent)).toHaveLength(1);
 expect(suggestRecipients('', contacts, recent)).toEqual([]);
 expect(suggestRecipients(a(3), contacts, recent)).toEqual([]);
});
