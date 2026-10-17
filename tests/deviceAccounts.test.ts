import { describe, expect, test } from 'bun:test';
import { getAddress } from 'viem';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
} });

const address = (n: number) => getAddress(`0x${n.toString(16).padStart(40, '0')}`);
function makeActive(n: number) {
  storage.set('veilora:wallet_address', address(n));
  storage.set('veilora:shardA:encrypted', `encrypted-key-${n}`);
  storage.set('veilora:shardA:address', address(1000 + n));
}
const active = () => ({ address: storage.get('veilora:wallet_address'), key: storage.get('veilora:shardA:encrypted'), shardA: storage.get('veilora:shardA:address') });

// These run in order and share one device's storage, like a real browser.
describe('accounts on this device', async () => {
  const accounts = await import('../src/lib/deviceAccounts');
  const stored = () => accounts.getStoredAccounts().map(a => a.address);

  test('keeps the active account and frees the slot for another', () => {
    expect(accounts.stashActiveAccount()).toContain('no account');
    makeActive(1);
    expect(accounts.stashActiveAccount()).toBeNull();
    expect(active()).toEqual({ address: undefined, key: undefined, shardA: undefined });
    expect(stored()).toEqual([address(1)]);
    expect(accounts.getStoredAccounts()[0].encryptedDeviceKey).toBe('encrypted-key-1');
  });

  test('switches both ways without losing either device key', () => {
    makeActive(3);
    expect(accounts.activateStoredAccount(address(1))).toBeNull();
    expect(active()).toEqual({ address: address(1), key: 'encrypted-key-1', shardA: address(1001) });
    expect(stored()).toEqual([address(3)]);
    expect(accounts.activateStoredAccount(address(3))).toBeNull();
    expect(active().key).toBe('encrypted-key-3');
    expect(stored()).toEqual([address(1)]);
    expect(accounts.activateStoredAccount(address(9))).toContain('no longer on this device');
    expect(accounts.stashActiveAccount()).toBeNull();
    expect(stored()).toEqual([address(1), address(3)]);
  });

  test('never stores a device key that is not passphrase-protected', () => {
    storage.set('veilora:wallet_address', address(4));
    storage.set('veilora:shardA:privateKey', `0x${'11'.repeat(32)}`);
    expect(accounts.stashActiveAccount()).toContain('protected with a passphrase');
    expect(storage.get('veilora:wallet_address')).toBe(address(4));
    expect(stored()).toEqual([address(1), address(3)]);
    storage.delete('veilora:wallet_address');
    storage.delete('veilora:shardA:privateKey');
  });

  test(`holds up to ${accounts.MAX_STORED_ACCOUNTS + 1} accounts and can still switch when full`, () => {
    for (let n = 10; stored().length < accounts.MAX_STORED_ACCOUNTS; n++) { makeActive(n); expect(accounts.stashActiveAccount()).toBeNull(); }
    makeActive(50);
    expect(accounts.stashActiveAccount()).toContain('up to 10 accounts');
    expect(accounts.activateStoredAccount(address(10))).toBeNull();
    expect(active().address).toBe(address(10));
    expect(stored()).toContain(address(50));
    expect(stored()).toHaveLength(accounts.MAX_STORED_ACCOUNTS);
  });
});
