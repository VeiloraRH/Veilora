import { describe, expect, test } from 'bun:test';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
} });

const wallet = '0x5555555555555555555555555555555555555555';

describe('payment link keys on this device', async () => {
  const links = await import('../src/lib/paymentLinks');

  test('are encrypted with the device key and only it can open them', async () => {
    const deviceKey = generatePrivateKey();
    const linkKey = generatePrivateKey();
    const linkAddress = privateKeyToAccount(linkKey).address;
    await links.storeLinkKey(wallet, deviceKey, linkKey);
    const saved = storage.get(`veilora:payment-links:${wallet}`)!;
    expect(saved).not.toContain(linkKey.slice(2));
    expect(links.hasLinkKey(wallet, linkAddress)).toBe(true);
    expect(await links.readLinkKey(wallet, deviceKey, linkAddress)).toBe(linkKey);
    expect(await links.readLinkKey(wallet, generatePrivateKey(), linkAddress)).toBeNull();
    expect(await links.readLinkKey(wallet, deviceKey, privateKeyToAccount(generatePrivateKey()).address)).toBeNull();
  });

  test('sign the same create message the co-signer checks', () => {
    expect(links.createLinkMessage(wallet, '0x6666666666666666666666666666666666666666', 'USDG', '', 'Rent', 1_800_000_000))
      .toBe('Veilora payment link create\nwallet:0x5555555555555555555555555555555555555555\nlink:0x6666666666666666666666666666666666666666\nasset:USDG\namount:any\nnote:Rent\ntimestamp:1800000000');
  });
});
