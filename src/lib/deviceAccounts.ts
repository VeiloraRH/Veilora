import { useSyncExternalStore } from 'react';
import { getAddress, isAddress } from 'viem';

/**
 * Other Veilora accounts kept on this device. The active account stays in the
 * original keys, so existing sessions need no migration; switching moves the
 * active account into this list and another one out. Every device key stays
 * encrypted with its own passphrase, and each account keeps its own three
 * keys. Nothing here is sent to Veilora.
 */
export type StoredAccount = { address: `0x${string}`; shardA: `0x${string}`; encryptedDeviceKey: string; addedAt: string };
export const MAX_STORED_ACCOUNTS = 9;

const ACTIVE_ADDRESS = 'veilora:wallet_address';
const ACTIVE_ENCRYPTED_KEY = 'veilora:shardA:encrypted';
const ACTIVE_SHARD_A = 'veilora:shardA:address';
const LEGACY_KEY = 'veilora:shardA:privateKey';
const STORE = 'veilora:accounts';

const listeners = new Set<() => void>();
let cache: StoredAccount[] | null = null;
const notify = () => listeners.forEach(listener => listener());

function read(): StoredAccount[] {
 try {
  const parsed: unknown = JSON.parse(localStorage.getItem(STORE) || '[]');
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((a): a is StoredAccount => !!a && typeof a.address === 'string' && isAddress(a.address) &&
   typeof a.shardA === 'string' && isAddress(a.shardA) && typeof a.encryptedDeviceKey === 'string' && a.encryptedDeviceKey.length > 0)
   .map(a => ({ ...a, address: getAddress(a.address), shardA: getAddress(a.shardA) }));
 } catch { return []; }
}

export function getStoredAccounts(): StoredAccount[] {
 if (!cache) cache = read();
 return cache;
}

function save(list: StoredAccount[]) {
 cache = list;
 localStorage.setItem(STORE, JSON.stringify(list));
 notify();
}

/**
 * Move the active account into the stored list and leave the active slot empty,
 * ready to create or import another account. Returns an error message or null.
 */
export function stashActiveAccount(replacing = ''): string | null {
 const address = localStorage.getItem(ACTIVE_ADDRESS) || '';
 const encryptedDeviceKey = localStorage.getItem(ACTIVE_ENCRYPTED_KEY) || '';
 const shardA = localStorage.getItem(ACTIVE_SHARD_A) || '';
 if (!isAddress(address)) return 'There is no account on this device to keep.';
 if (!encryptedDeviceKey) return localStorage.getItem(LEGACY_KEY)
  ? 'Unlock your device key once so it is protected with a passphrase, then add another account.'
  : 'This account has no device key on this device, so it cannot be kept for switching.';
 if (!isAddress(shardA)) return 'This account’s device key address is missing. Unlock it once, then try again.';
 const rest = getStoredAccounts().filter(a => a.address.toLowerCase() !== address.toLowerCase());
 if (rest.filter(a => a.address.toLowerCase() !== replacing.toLowerCase()).length >= MAX_STORED_ACCOUNTS) return `This device can keep up to ${MAX_STORED_ACCOUNTS + 1} accounts. Remove one first.`;
 save([...rest, { address: getAddress(address), shardA: getAddress(shardA), encryptedDeviceKey, addedAt: new Date().toISOString() }]);
 localStorage.removeItem(ACTIVE_ADDRESS);
 localStorage.removeItem(ACTIVE_ENCRYPTED_KEY);
 localStorage.removeItem(ACTIVE_SHARD_A);
 return null;
}

/** Make a stored account active; the current one, if any, is kept in the list. Returns an error message or null. */
export function activateStoredAccount(address: string): string | null {
 const target = getStoredAccounts().find(a => a.address.toLowerCase() === address.toLowerCase());
 if (!target) return 'That account is no longer on this device.';
 if (localStorage.getItem(ACTIVE_ADDRESS)) {
  const error = stashActiveAccount(target.address);
  if (error) return error;
 }
 localStorage.setItem(ACTIVE_ADDRESS, target.address);
 localStorage.setItem(ACTIVE_ENCRYPTED_KEY, target.encryptedDeviceKey);
 localStorage.setItem(ACTIVE_SHARD_A, target.shardA);
 save(getStoredAccounts().filter(a => a.address.toLowerCase() !== target.address.toLowerCase()));
 return null;
}

export function useStoredAccounts(): StoredAccount[] {
 return useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, getStoredAccounts, getStoredAccounts);
}

