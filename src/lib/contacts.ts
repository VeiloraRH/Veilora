import { getAddress, isAddress, zeroAddress } from 'viem';

export type WalletContact = { id: string; name: string; address: `0x${string}`; note?: string; starred?: boolean };
export const MAX_STARRED = 6;
export const CONTACTS_CHANGED = 'veilora:contacts:changed';
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
    ).map(({ note, starred, ...item }) => ({ ...item, address: getAddress(item.address), ...(cleanContactNote(note) ? { note: cleanContactNote(note) } : {}), ...(starred === true ? { starred: true } : {}) }));
  } catch {
    return [];
  }
}

export function saveWalletContacts(wallet: string, contacts: WalletContact[]) {
  localStorage.setItem(keyFor(wallet), JSON.stringify(contacts));
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CONTACTS_CHANGED, { detail: { wallet: wallet.toLowerCase() } }));
}

/** Star or unstar a contact. Returns an error message when the starred list is full, else null. */
export function toggleStarred(contacts: WalletContact[], id: string): { contacts: WalletContact[]; error: string | null } {
  const target = contacts.find((c) => c.id === id);
  if (!target) return { contacts, error: null };
  if (!target.starred && contacts.filter((c) => c.starred).length >= MAX_STARRED) return { contacts, error: `You can star up to ${MAX_STARRED} contacts.` };
  return { contacts: contacts.map((c) => (c.id === id ? (c.starred ? (({ starred: _s, ...rest }) => rest)(c) : { ...c, starred: true }) : c)), error: null };
}

/**
 * Show saved contact names next to full addresses in text, e.g. a Veily answer.
 * Display only, on this device; the text itself (and any receipt for it) is unchanged.
 */
export function labelAddresses(text: string, contacts: WalletContact[]): string {
  if (!contacts.length) return text;
  const names = new Map(contacts.map((c) => [c.address.toLowerCase(), c.name]));
  return text.replace(/0x[0-9a-fA-F]{40}(?![0-9a-fA-F])/g, (address) => {
    const name = names.get(address.toLowerCase());
    return name ? `${name} (${address.slice(0, 6)}…${address.slice(-4)})` : address;
  });
}
