import { getAddress, isAddress, zeroAddress } from 'viem';

export type WalletContact = { id: string; name: string; address: `0x${string}` };

const keyFor = (wallet: string) => `veilora:contacts:${wallet.toLowerCase()}`;

export function getWalletContacts(wallet: string): WalletContact[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(keyFor(wallet)) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is WalletContact =>
      !!item && typeof item.id === 'string' && typeof item.name === 'string' &&
      typeof item.address === 'string' && isAddress(item.address) && item.address.toLowerCase() !== zeroAddress,
    ).map((item) => ({ ...item, address: getAddress(item.address) }));
  } catch {
    return [];
  }
}

export function saveWalletContacts(wallet: string, contacts: WalletContact[]) {
  localStorage.setItem(keyFor(wallet), JSON.stringify(contacts));
}
