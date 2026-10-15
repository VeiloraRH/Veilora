import { getAddress, isAddress, zeroAddress } from 'viem';
import type { WalletContact } from './contacts';
import { decryptTextWithPassphrase, encryptTextWithPassphrase } from './deviceKeyVault';

const FORMAT = 'veilora-address-book-backup';
const VERSION = 1;
const MAX_FILE_BYTES = 1_000_000;
const MAX_CONTACTS = 500;

export type AddressBookData = { contacts: WalletContact[]; blockedAddresses: `0x${string}`[] };

function normalizeAddress(value: unknown): `0x${string}` {
  if (typeof value !== 'string' || !isAddress(value) || value.toLowerCase() === zeroAddress) {
    throw new Error('The backup contains an invalid wallet address.');
  }
  return getAddress(value);
}

export async function createAddressBookBackup(wallet: string, data: AddressBookData, passphrase: string): Promise<string> {
  if (!isAddress(wallet)) throw new Error('Connect a valid wallet before creating a backup.');
  if (data.contacts.length > MAX_CONTACTS || data.blockedAddresses.length > 100) throw new Error('Your address book exceeds the backup size limits.');
  const plaintext = JSON.stringify({
    version: VERSION,
    walletAddress: getAddress(wallet),
    createdAt: new Date().toISOString(),
    contacts: data.contacts,
    blockedAddresses: data.blockedAddresses,
  });
  const encrypted = await encryptTextWithPassphrase(plaintext, passphrase);
  return JSON.stringify({ format: FORMAT, version: VERSION, encrypted }, null, 2);
}

export async function openAddressBookBackup(fileText: string, wallet: string, passphrase: string): Promise<AddressBookData> {
  if (fileText.length > MAX_FILE_BYTES) throw new Error('This backup file is too large.');
  let envelope: unknown;
  try { envelope = JSON.parse(fileText); } catch { throw new Error('This is not a valid Veilora address book backup.'); }
  if (!envelope || typeof envelope !== 'object' || (envelope as any).format !== FORMAT || (envelope as any).version !== VERSION || typeof (envelope as any).encrypted !== 'string') {
    throw new Error('This is not a supported Veilora address book backup.');
  }
  let record: any;
  try { record = JSON.parse(await decryptTextWithPassphrase((envelope as any).encrypted, passphrase)); }
  catch (error) { throw error instanceof Error ? error : new Error('Could not decrypt this backup.'); }
  if (!record || record.version !== VERSION || typeof record.walletAddress !== 'string' || !isAddress(record.walletAddress)) {
    throw new Error('The decrypted file has an invalid backup structure.');
  }
  if (record.walletAddress.toLowerCase() !== wallet.toLowerCase()) throw new Error('This backup belongs to a different wallet.');
  if (!Array.isArray(record.contacts) || record.contacts.length > MAX_CONTACTS || !Array.isArray(record.blockedAddresses) || record.blockedAddresses.length > 100) {
    throw new Error('The backup has invalid address book data or exceeds the supported limits.');
  }

  const seenContacts = new Set<string>();
  const contacts = record.contacts.map((item: any): WalletContact => {
    if (!item || typeof item.name !== 'string' || !item.name.trim() || item.name.trim().length > 40) throw new Error('The backup contains an invalid contact name.');
    const address = normalizeAddress(item.address);
    if (seenContacts.has(address.toLowerCase())) throw new Error('The backup contains duplicate contacts.');
    seenContacts.add(address.toLowerCase());
    return { id: crypto.randomUUID(), name: item.name.trim(), address };
  });
  const blockedAddresses = [...new Set<string>(record.blockedAddresses.map((item: unknown) => normalizeAddress(item).toLowerCase()))]
    .map((address) => getAddress(address));
  if (blockedAddresses.length !== record.blockedAddresses.length) throw new Error('The backup contains duplicate blocked addresses.');
  return { contacts, blockedAddresses };
}
