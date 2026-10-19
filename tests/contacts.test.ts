import { describe, expect, test } from 'bun:test';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
} });

const wallet = '0x1111111111111111111111111111111111111111';

describe('contact notes and search', async () => {
  const contacts = await import('../src/lib/contacts');
  const book = [
    { id: '1', name: 'Alex', address: '0xabc0000000000000000000000000000000000001' as const, note: 'Pays rent monthly' },
    { id: '2', name: 'Studio', address: '0x2222222222222222222222222222222222222222' as const, note: 'Design invoices' },
    { id: '3', name: 'Cold wallet', address: '0x3333333333333333333333333333333333333333' as const },
  ];

  test('cleans notes to one short line', () => {
    expect(contacts.cleanContactNote('  Rent\nfor May  ')).toBe('Rent for May');
    expect(contacts.cleanContactNote('   ')).toBeUndefined();
    expect(contacts.cleanContactNote(42)).toBeUndefined();
    expect(contacts.cleanContactNote('x'.repeat(500))).toHaveLength(contacts.MAX_CONTACT_NOTE);
  });

  test('searches name, note and address, every word must match', () => {
    expect(contacts.searchContacts(book, '').map(c => c.id)).toEqual(['1', '2', '3']);
    expect(contacts.searchContacts(book, 'rent').map(c => c.id)).toEqual(['1']);
    expect(contacts.searchContacts(book, 'INVOICES').map(c => c.id)).toEqual(['2']);
    expect(contacts.searchContacts(book, '0xabc').map(c => c.id)).toEqual(['1']);
    expect(contacts.searchContacts(book, 'cold 3333').map(c => c.id)).toEqual(['3']);
    expect(contacts.searchContacts(book, 'cold rent')).toEqual([]);
  });

  test('keeps notes when reading saved contacts', () => {
    contacts.saveWalletContacts(wallet, book);
    const saved = contacts.getWalletContacts(wallet);
    expect(saved[0].note).toBe('Pays rent monthly');
    expect(saved[2]).not.toHaveProperty('note');
  });
});

describe('contact names in text', async () => {
  const { labelAddresses } = await import('../src/lib/contacts');
  test('labels full addresses of saved contacts only', () => {
    const contacts = [{ id: '1', name: 'Maya', address: '0x4444444444444444444444444444444444444444' as const }];
    expect(labelAddresses('You sent 2,400 USDG to 0x4444444444444444444444444444444444444444 and 80 USDG to 0x2222222222222222222222222222222222222222.', contacts))
      .toBe('You sent 2,400 USDG to Maya (0x4444…4444) and 80 USDG to 0x2222222222222222222222222222222222222222.');
    expect(labelAddresses(`hash 0x${'44'.repeat(32)}`, contacts)).toBe(`hash 0x${'44'.repeat(32)}`);
    expect(labelAddresses('no contacts', [])).toBe('no contacts');
  });
});
