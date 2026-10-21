import { describe, expect, test } from 'bun:test';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
 getItem: (key: string) => storage.get(key) ?? null,
 setItem: (key: string, value: string) => { storage.set(key, value); },
 removeItem: (key: string) => { storage.delete(key); },
} });

const wallet = '0x1111111111111111111111111111111111111111';
const other = '0x2222222222222222222222222222222222222222';
const passphrase = 'correct horse battery staple';

describe('device backup', async () => {
 const b = await import('../src/lib/deviceBackup');

 test('round trips every kept section and never includes keys', async () => {
  storage.clear();
  storage.set(`veilora:contacts:${wallet}`, JSON.stringify([{ id: '1', name: 'Maya', address: other, starred: true }]));
  storage.set(`veilora:approved-recipients:${wallet}`, JSON.stringify([{ address: other, label: 'Maya' }]));
  storage.set(`veilora:transaction-tags:${wallet}`, JSON.stringify({ '0xabc': 'rent' }));
  storage.set('veilora:privacy-mode', '1');
  storage.set(`veilora:watch:${wallet}`, '[]');
  storage.set('veilora:shardA:encrypted', 'device-key-ciphertext');
  storage.set(`veilora:passkey-unlock:${wallet}`, 'passkey');
  storage.set(`veilora:veily:credential:${wallet}`, 'api-key');
  storage.set(`veilora:recovery:${wallet}`, 'drill');
  const file = await b.createDeviceBackup(wallet, passphrase);
  for (const secret of ['device-key-ciphertext', 'passkey', 'api-key', 'Maya', 'rent']) expect(file).not.toContain(secret);

  const opened = await b.openDeviceBackup(file, wallet, passphrase);
  expect(Object.keys(opened.items).sort()).toEqual(['approved', 'contacts', 'privacy-mode', 'tags']);
  expect(b.sectionSize(opened.items.contacts)).toBe(1);
  expect(b.sectionSize('{"minutes":15,"onHidden":true}', 'auto-lock')).toBeNull();
  expect(b.sectionSize(opened.items.contacts, 'contacts')).toBe(1);

  storage.clear();
  b.restoreDeviceBackup(wallet, opened);
  expect(JSON.parse(storage.get(`veilora:contacts:${wallet}`)!)[0].starred).toBe(true);
  expect(storage.get('veilora:privacy-mode')).toBe('1');
  expect(storage.has('veilora:shardA:encrypted')).toBe(false);
 });

 test('refuses another wallet, a wrong passphrase and other files', async () => {
  const file = await b.createDeviceBackup(wallet, passphrase, { theme: 'dark' });
  await expect(b.openDeviceBackup(file, other, passphrase)).rejects.toThrow('different wallet');
  await expect(b.openDeviceBackup(file, wallet, 'wrong passphrase!!')).rejects.toThrow();
  await expect(b.openDeviceBackup('{"format":"veilora-address-book-backup"}', wallet, passphrase)).rejects.toThrow('not a supported');
  expect(b.isDeviceBackupFile(file)).toBe(true);
  expect(b.isDeviceBackupFile('{"format":"veilora-address-book-backup"}')).toBe(false);
 });
});
