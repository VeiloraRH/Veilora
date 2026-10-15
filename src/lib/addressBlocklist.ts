import { useEffect, useState } from 'react';
import { getAddress, isAddress, zeroAddress } from 'viem';

const eventName = 'veilora:address-blocklist:changed';
const keyFor = (wallet: string) => `veilora:address-blocklist:${wallet.toLowerCase()}`;

export function getBlockedAddresses(wallet: string): `0x${string}`[] {
  if (!wallet) return [];
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(keyFor(wallet)) || '[]');
    if (!Array.isArray(stored)) return [];
    const addresses = stored.filter((item): item is string => typeof item === 'string' && isAddress(item) && item.toLowerCase() !== zeroAddress);
    return [...new Map(addresses.map((address) => [address.toLowerCase(), getAddress(address)])).values()];
  } catch {
    return [];
  }
}

export function saveBlockedAddresses(wallet: string, addresses: string[]) {
  if (!wallet) throw new Error('Connect a wallet before managing blocked addresses.');
  const normalized = [...new Set(addresses.filter((address) => isAddress(address) && address.toLowerCase() !== zeroAddress).map((address) => getAddress(address)))];
  if (normalized.length > 100) throw new Error('You can block up to 100 addresses per wallet.');
  localStorage.setItem(keyFor(wallet), JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(eventName, { detail: { wallet: wallet.toLowerCase() } }));
}

export function clearBlockedAddresses(wallet: string) {
  if (!wallet) return;
  localStorage.removeItem(keyFor(wallet));
  window.dispatchEvent(new CustomEvent(eventName, { detail: { wallet: wallet.toLowerCase() } }));
}

export function useWalletBlocklist(wallet: string) {
  const [addresses, setAddresses] = useState<`0x${string}`[]>(() => getBlockedAddresses(wallet));
  useEffect(() => {
    const sync = (event?: Event) => {
      const changedWallet = (event as CustomEvent<{ wallet?: string }> | undefined)?.detail?.wallet;
      if (!changedWallet || changedWallet === wallet.toLowerCase()) setAddresses(getBlockedAddresses(wallet));
    };
    window.addEventListener(eventName, sync);
    window.addEventListener('storage', sync);
    sync();
    return () => {
      window.removeEventListener(eventName, sync);
      window.removeEventListener('storage', sync);
    };
  }, [wallet]);
  return addresses;
}
