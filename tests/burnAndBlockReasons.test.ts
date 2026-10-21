import { describe, expect, test } from 'bun:test';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
 getItem: (key: string) => storage.get(key) ?? null,
 setItem: (key: string, value: string) => { storage.set(key, value); },
 removeItem: (key: string) => { storage.delete(key); },
} });

const wallet = '0x1111111111111111111111111111111111111111';
const scam = '0x3333333333333333333333333333333333333333';
const base = { wallet, contacts: [], history: [], tokenContracts: [] };

describe('burn addresses and block reasons', async () => {
 const check = await import('../src/lib/recipientCheck');
 const list = await import('../src/lib/addressBlocklist');

 test('well-known burn and precompile addresses are flagged as lost for good', () => {
  for (const r of ['0x000000000000000000000000000000000000dEaD', '0x0000000000000000000000000000000000000001', '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE']) {
   const a = check.assessRecipient({ ...base, recipient: r });
   expect(a.items.find(i => i.code === 'burn-address')?.text).toContain('gone for good');
   expect(a.level).toBe('danger');
  }
  expect(check.assessRecipient({ ...base, recipient: scam }).items.some(i => i.code === 'burn-address')).toBe(false);
 });

 test('reasons are kept with the blocklist and shown in the check', () => {
  list.saveBlockedAddresses(wallet, [scam]);
  list.saveBlockReason(wallet, scam, '  Scam DM\non Telegram ');
  expect(list.getBlockReasons(wallet)).toEqual({ [scam]: 'Scam DM on Telegram' });
  const a = check.assessRecipient({ ...base, recipient: scam, blockedAddresses: [scam], blockReasons: list.getBlockReasons(wallet) });
  expect(a.items.find(i => i.code === 'user-blocked')?.text).toContain('“Scam DM on Telegram”');
  list.saveBlockedAddresses(wallet, []);
  expect(list.getBlockReasons(wallet)).toEqual({});
 });
});
