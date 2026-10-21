import { getAddress, isAddress } from 'viem';
import { decryptTextWithPassphrase, encryptTextWithPassphrase } from './deviceKeyVault';

/**
 * One encrypted file with everything this device keeps for a wallet, so a new
 * browser can pick up where this one left off. Each section is copied exactly
 * as stored; its own loader still validates it when read back. Keys are never
 * included: the device key has its own backup, and the recovery key never
 * touches this app's storage.
 */
const FORMAT = 'veilora-device-backup';
const VERSION = 1;
const MAX_FILE_BYTES = 5_000_000;
const MAX_SECTION_BYTES = 1_500_000;

type Section = { id: string; label: string; key: (wallet: string) => string };
const w = (prefix: string) => (wallet: string) => `veilora:${prefix}:${wallet.toLowerCase()}`;
const device = (key: string) => () => `veilora:${key}`;

export const BACKUP_SECTIONS: Section[] = [
 { id: 'contacts', label: 'Contacts, notes and stars', key: w('contacts') },
 { id: 'blocklist', label: 'Blocked addresses', key: w('address-blocklist') },
 { id: 'blocklist-reasons', label: 'Reasons for blocked addresses', key: w('address-blocklist-reasons') },
 { id: 'approved', label: 'Approved recipients', key: w('approved-recipients') },
 { id: 'approved-policy', label: 'Approved-recipient mode', key: w('approved-recipients-policy') },
 { id: 'watch', label: 'Watched addresses', key: w('watch') },
 { id: 'bridge', label: 'Bridge history', key: w('bridge:tracking') },
 { id: 'bridge-notifications', label: 'Bridge notifications', key: w('bridge:notifications') },
 { id: 'tags', label: 'Transaction tags', key: w('transaction-tags') },
 { id: 'payment-links', label: 'Payment link keys (encrypted to your device key)', key: w('payment-links') },
 { id: 'veily', label: 'Veily conversations', key: w('veily:history') },
 { id: 'market-watchlist', label: 'Market watchlist', key: device('market:watchlist') },
 { id: 'privacy-mode', label: 'Privacy mode', key: device('privacy-mode') },
 { id: 'hide-when-away', label: 'Hide when away', key: device('hide-when-away') },
 { id: 'auto-lock', label: 'Auto-lock', key: device('auto-lock') },
 { id: 'rpc', label: 'Custom Robinhood Chain RPC', key: device('rpc:url') },
 { id: 'theme', label: 'Theme', key: device('theme') },
];

export type DeviceBackupData = { walletAddress: `0x${string}`; createdAt: string; items: Record<string, string> };

/** Read what this device holds for the wallet; sections with nothing stored are left out. */
export function collectDeviceData(wallet: string): Record<string, string> {
 const items: Record<string, string> = {};
 for (const s of BACKUP_SECTIONS) {
  const value = localStorage.getItem(s.key(wallet));
  if (value != null && value !== '' && value !== '[]' && value !== '{}') items[s.id] = value;
 }
 return items;
}

export async function createDeviceBackup(wallet: string, passphrase: string, items = collectDeviceData(wallet)): Promise<string> {
 if (!isAddress(wallet)) throw new Error('Connect a valid wallet before creating a backup.');
 const plaintext = JSON.stringify({ version: VERSION, walletAddress: getAddress(wallet), createdAt: new Date().toISOString(), items });
 return JSON.stringify({ format: FORMAT, version: VERSION, encrypted: await encryptTextWithPassphrase(plaintext, passphrase) }, null, 2);
}

export const isDeviceBackupFile = (text: string) => { try { return JSON.parse(text)?.format === FORMAT; } catch { return false; } };

export async function openDeviceBackup(fileText: string, wallet: string, passphrase: string): Promise<DeviceBackupData> {
 if (fileText.length > MAX_FILE_BYTES) throw new Error('This backup file is too large.');
 let envelope: { format?: unknown; version?: unknown; encrypted?: unknown };
 try { envelope = JSON.parse(fileText); } catch { throw new Error('This is not a valid Veilora backup.'); }
 if (envelope?.format !== FORMAT || envelope.version !== VERSION || typeof envelope.encrypted !== 'string') throw new Error('This is not a supported Veilora device backup.');
 const record = JSON.parse(await decryptTextWithPassphrase(envelope.encrypted, passphrase)) as { version?: unknown; walletAddress?: unknown; createdAt?: unknown; items?: unknown };
 if (record?.version !== VERSION || typeof record.walletAddress !== 'string' || !isAddress(record.walletAddress) || typeof record.createdAt !== 'string' || !record.items || typeof record.items !== 'object') {
  throw new Error('The decrypted file has an invalid backup structure.');
 }
 if (record.walletAddress.toLowerCase() !== wallet.toLowerCase()) throw new Error('This backup belongs to a different wallet.');
 const known = new Set(BACKUP_SECTIONS.map(s => s.id));
 const items: Record<string, string> = {};
 for (const [id, value] of Object.entries(record.items as Record<string, unknown>)) {
  if (!known.has(id)) continue;
  if (typeof value !== 'string' || value.length > MAX_SECTION_BYTES) throw new Error('The backup contains an invalid section.');
  items[id] = value;
 }
 return { walletAddress: getAddress(record.walletAddress), createdAt: record.createdAt, items };
}

/** Rough size of a section for the restore preview: items in a list or map, else stored. */
export function sectionSize(value: string): number | null {
 try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? parsed.length : parsed && typeof parsed === 'object' ? Object.keys(parsed).length : null; }
 catch { return null; }
}

/** Write the backup's sections for this wallet, putting everything back if any write fails. */
export function restoreDeviceBackup(wallet: string, data: DeviceBackupData) {
 const previous = new Map<string, string | null>();
 try {
  for (const s of BACKUP_SECTIONS) {
   if (!(s.id in data.items)) continue;
   const key = s.key(wallet);
   previous.set(key, localStorage.getItem(key));
   localStorage.setItem(key, data.items[s.id]);
  }
 } catch (cause) {
  for (const [key, value] of previous) { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* best effort */ } }
  throw cause;
 }
}
