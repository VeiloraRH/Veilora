import { expect, test } from 'bun:test';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
 getItem: (key: string) => storage.get(key) ?? null,
 setItem: (key: string, value: string) => { storage.set(key, value); },
 removeItem: (key: string) => { storage.delete(key); },
} });

const wallet = '0x1111111111111111111111111111111111111111';
const to = '0x2222222222222222222222222222222222222222';

test('drafts are saved newest first, validated, capped and removable', async () => {
 const d = await import('../src/lib/sendDrafts');
 expect(d.addDraft(wallet, { recipient: to, symbol: 'USDG', amount: '25' })).toBeNull();
 expect(d.addDraft(wallet, { recipient: to, symbol: 'ETH', amount: '0.01' })).toBeNull();
 expect(d.getDrafts(wallet).map(x => x.symbol)).toEqual(['ETH', 'USDG']);
 expect(d.addDraft(wallet, { recipient: to, symbol: 'USDG', amount: '0' })).toContain('valid');
 expect(d.addDraft(wallet, { recipient: '0x123' as `0x${string}`, symbol: 'USDG', amount: '5' })).toContain('valid');
 for (let i = 0; i < d.MAX_DRAFTS - 2; i++) d.addDraft(wallet, { recipient: to, symbol: 'USDG', amount: '1' });
 expect(d.addDraft(wallet, { recipient: to, symbol: 'USDG', amount: '1' })).toContain(`up to ${d.MAX_DRAFTS}`);
 const first = d.getDrafts(wallet)[0];
 d.removeDraft(wallet, first.id);
 expect(d.getDrafts(wallet)).toHaveLength(d.MAX_DRAFTS - 1);
 storage.set(`veilora:send-drafts:${wallet}`, JSON.stringify([{ id: 'x', recipient: to, symbol: 'USDG', amount: '1e9', createdAt: '' }]));
 expect(d.getDrafts(wallet)).toEqual([]);
});
