import { getAddress, type Hex } from 'viem';
import { privateKeyToAccount, privateKeyToAddress } from 'viem/accounts';
import { freezeWallet, unfreezeWallet } from './api';
import { decryptDeviceKey } from './deviceKeyVault';

/**
 * Recovery helpers. Recovery keys and device keys are only ever used in this
 * browser: they sign a message or are compared with a public address, and are
 * never sent anywhere.
 */
const ENCRYPTED_DEVICE_KEY = 'veilora:shardA:encrypted';
const BACKUP_TYPE = 'veilora-device-key-backup';
export const DRILL_VALID_DAYS = 90;

const flagKey = (wallet: string, flag: 'backup' | 'drill') => `veilora:recovery:${wallet.toLowerCase()}:${flag}`;
export function readFlag(wallet: string, flag: 'backup' | 'drill'): string | null {
 try { return localStorage.getItem(flagKey(wallet, flag)); } catch { return null; }
}
export function writeFlag(wallet: string, flag: 'backup' | 'drill') {
 try { localStorage.setItem(flagKey(wallet, flag), new Date().toISOString()); } catch { /* storage unavailable */ }
}
export const drillIsCurrent = (iso: string | null) => !!iso && Date.now() - Date.parse(iso) < DRILL_VALID_DAYS * 86400000;

export function keyMatches(privateKey: string, address: string): boolean {
 if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey.trim())) return false;
 try { return privateKeyToAddress(privateKey.trim() as Hex).toLowerCase() === address.toLowerCase(); } catch { return false; }
}

/** Download the passphrase-encrypted Shard A exactly as this browser stores it. */
export function downloadDeviceKeyBackup(wallet: string, shardA: string) {
 const encrypted = localStorage.getItem(ENCRYPTED_DEVICE_KEY);
 if (!encrypted) throw new Error('No encrypted device key is stored in this browser.');
 const file = { type: BACKUP_TYPE, version: 1, wallet: getAddress(wallet), shardA: getAddress(shardA), chainId: 4663, encrypted, createdAt: new Date().toISOString() };
 const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }));
 const link = Object.assign(document.createElement('a'), { href: url, download: `veilora-device-key-${wallet.slice(2, 8).toLowerCase()}.json` });
 link.click();
 setTimeout(() => URL.revokeObjectURL(url), 1000);
 writeFlag(wallet, 'backup');
}

export type DeviceKeyBackup = { wallet: string; shardA: string; encrypted: string };
export function parseDeviceKeyBackup(text: string): DeviceKeyBackup {
 let file: Record<string, unknown>;
 try { file = JSON.parse(text); } catch { throw new Error('This file is not a Veilora backup.'); }
 if (file.type !== BACKUP_TYPE || file.version !== 1 || typeof file.wallet !== 'string' || typeof file.shardA !== 'string' || typeof file.encrypted !== 'string') throw new Error('This file is not a Veilora device key backup.');
 return { wallet: getAddress(file.wallet), shardA: getAddress(file.shardA), encrypted: file.encrypted };
}
export async function unlockBackup(backup: DeviceKeyBackup, passphrase: string): Promise<Hex> {
 let key: string;
 try { key = await decryptDeviceKey(backup.encrypted, passphrase); } catch { throw new Error('That passphrase does not unlock this backup.'); }
 if (!keyMatches(key, backup.shardA)) throw new Error('This backup does not contain the device key it claims.');
 return key as Hex;
}

// Must match backend/src/routes/wallets.ts. Either Shard A or Shard C may sign.
export async function freezeWithKey(wallet: string, privateKey: Hex, hours: number, reason: string) {
 const timestamp = Math.floor(Date.now() / 1000);
 const message = `Veilora account security action\nwallet:${getAddress(wallet)}\naction:freeze\nhours:${hours}\nreason:${reason}\ntimestamp:${timestamp}`;
 return freezeWallet(wallet, hours, reason, timestamp, await privateKeyToAccount(privateKey).signMessage({ message }));
}
export async function unfreezeWithKey(wallet: string, privateKey: Hex) {
 const timestamp = Math.floor(Date.now() / 1000);
 const message = `Veilora account security action\nwallet:${getAddress(wallet)}\naction:unfreeze\nhours:0\nreason:\ntimestamp:${timestamp}`;
 return unfreezeWallet(wallet, timestamp, await privateKeyToAccount(privateKey).signMessage({ message }));
}
