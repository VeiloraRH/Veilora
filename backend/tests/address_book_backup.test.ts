import { describe, expect, test } from 'bun:test';
import { createAddressBookBackup, openAddressBookBackup } from '../../src/lib/addressBookBackup';

const wallet = '0x1111111111111111111111111111111111111111';
const contactAddress = '0x2222222222222222222222222222222222222222';
const blockedAddress = '0x3333333333333333333333333333333333333333';
const passphrase = 'correct horse battery staple';

describe('encrypted address book backup', () => {
  test('round trips contacts and blocked addresses for the same wallet', async () => {
    const backup = await createAddressBookBackup(wallet, {
      contacts: [{ id: 'local-id', name: 'Cold wallet', address: contactAddress }],
      blockedAddresses: [blockedAddress],
    }, passphrase);
    const restored = await openAddressBookBackup(backup, wallet, passphrase);
    expect(restored.contacts).toHaveLength(1);
    expect(restored.contacts[0]).toMatchObject({ name: 'Cold wallet', address: contactAddress });
    expect(restored.contacts[0].id).not.toBe('local-id');
    expect(restored.blockedAddresses).toEqual([blockedAddress]);
    expect(backup).not.toContain('Cold wallet');
  });

  test('keeps contact notes through a backup', async () => {
    const backup = await createAddressBookBackup(wallet, {
      contacts: [{ id: 'local-id', name: 'Studio', address: contactAddress, note: 'Design invoices', starred: true }],
      blockedAddresses: [],
    }, passphrase);
    expect(backup).not.toContain('Design invoices');
    const restored = await openAddressBookBackup(backup, wallet, passphrase);
    expect(restored.contacts[0].note).toBe('Design invoices');
    expect(restored.contacts[0].starred).toBe(true);
  });

  test('rejects a wrong passphrase', async () => {
    const backup = await createAddressBookBackup(wallet, { contacts: [], blockedAddresses: [] }, passphrase);
    await expect(openAddressBookBackup(backup, wallet, 'a different passphrase')).rejects.toThrow('Could not decrypt this file');
  });

  test('rejects a backup for a different wallet', async () => {
    const backup = await createAddressBookBackup(wallet, { contacts: [], blockedAddresses: [] }, passphrase);
    await expect(openAddressBookBackup(backup, '0x4444444444444444444444444444444444444444', passphrase)).rejects.toThrow('different wallet');
  });

  test('rejects malformed or unsupported backup files', async () => {
    await expect(openAddressBookBackup('not json', wallet, passphrase)).rejects.toThrow('not a valid');
    await expect(openAddressBookBackup(JSON.stringify({ format: 'other', version: 1, encrypted: '{}' }), wallet, passphrase)).rejects.toThrow('not a supported');
  });
});
