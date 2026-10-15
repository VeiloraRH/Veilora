import { useSyncExternalStore } from 'react';
import { getAddress, isAddress, zeroAddress } from 'viem';

/**
 * Watch-only addresses: other addresses whose balances and history you want
 * to follow, such as a second wallet or a treasury. Nothing can be signed for
 * them. Saved on this device only, never sent to Veilora.
 */
export type WatchedAddress = { id: string; name: string; address: `0x${string}`; addedAt: string };
export const MAX_WATCHED = 20;

const keyFor = (owner: string) => `veilora:watch:${owner.toLowerCase()}`;
const listeners = new Set<() => void>();
const cache = new Map<string, WatchedAddress[]>();

function load(owner: string): WatchedAddress[] {
 try {
  const parsed: unknown = JSON.parse(localStorage.getItem(keyFor(owner)) || '[]');
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((w): w is WatchedAddress => !!w && typeof w.id === 'string' && typeof w.name === 'string' && typeof w.address === 'string' && isAddress(w.address))
   .map(w => ({ ...w, address: getAddress(w.address) }));
 } catch { return []; }
}

export function getWatchList(owner: string): WatchedAddress[] {
 if (!owner) return [];
 if (!cache.has(owner)) cache.set(owner, load(owner));
 return cache.get(owner)!;
}

function save(owner: string, list: WatchedAddress[]) {
 cache.set(owner, list);
 try { localStorage.setItem(keyFor(owner), JSON.stringify(list)); } catch { /* storage unavailable */ }
 listeners.forEach(l => l());
}

/** Returns an error message, or null when the address was added. */
export function addWatched(owner: string, name: string, address: string): string | null {
 const clean = address.trim();
 if (!isAddress(clean) || clean.toLowerCase() === zeroAddress) return 'Enter a valid, non-zero address.';
 if (clean.toLowerCase() === owner.toLowerCase()) return 'That is your own wallet; it is already on your dashboard.';
 const list = getWatchList(owner);
 if (list.some(w => w.address.toLowerCase() === clean.toLowerCase())) return 'You are already watching this address.';
 if (list.length >= MAX_WATCHED) return `You can watch up to ${MAX_WATCHED} addresses.`;
 const label = name.trim().slice(0, 40) || `Watched ${list.length + 1}`;
 save(owner, [...list, { id: crypto.randomUUID(), name: label, address: getAddress(clean), addedAt: new Date().toISOString() }]);
 return null;
}

export function removeWatched(owner: string, id: string) { save(owner, getWatchList(owner).filter(w => w.id !== id)); }
export function renameWatched(owner: string, id: string, name: string) {
 save(owner, getWatchList(owner).map(w => (w.id === id ? { ...w, name: name.trim().slice(0, 40) || w.name } : w)));
}
export function clearWatchList(owner: string) { cache.delete(owner); try { localStorage.removeItem(keyFor(owner)); } catch { /* storage unavailable */ } listeners.forEach(l => l()); }

export function useWatchList(owner: string): WatchedAddress[] {
 return useSyncExternalStore(l => { listeners.add(l); return () => { listeners.delete(l); }; }, () => getWatchList(owner), () => []);
}
