import { getAddress, isAddress, zeroAddress } from 'viem';

export type WalletContact = { id: string; name: string; address: `0x${string}`; note?: string };
export const MAX_CONTACT_NOTE = 120;

/** One line, trimmed, at most MAX_CONTACT_NOTE characters; undefined when empty. */
export function cleanContactNote(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const note = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, MAX_CONTACT_NOTE);
  return note || undefined;
}

/** Contacts whose name, note or address contains every word of the query. */
export function searchContacts(contacts: WalletContact[], query: string): WalletContact[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return contacts;
  return contacts.filter((contact) => {
    const text = `${contact.name} ${contact.note ?? ''} ${contact.address}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

const keyFor = (wallet: string) => `veilora:contacts:${wallet.toLowerCase()}`;

export function getWalletContacts(wallet: string): WalletContact[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(keyFor(wallet)) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is WalletContact =>
      !!item && typeof item.id === 'string' && typeof item.name === 'string' &&
      typeof item.address === 'string' && isAddress(item.address) && item.address.toLowerCase() !== zeroAddress,
    ).map(({ note, ...item }) => ({ ...item, address: getAddress(item.address), ...(cleanContactNote(note) ? { note: cleanContactNote(note) } : {}) }));
  } catch {
    return [];
  }
}

export function saveWalletContacts(wallet: string, contacts: WalletContact[]) {
  localStorage.setItem(keyFor(wallet), JSON.stringify(contacts));
}
