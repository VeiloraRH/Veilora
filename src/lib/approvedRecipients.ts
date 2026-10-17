import { useEffect, useState } from 'react';
import { getAddress, isAddress, zeroAddress, type Address } from 'viem';

export type ApprovedRecipient = { address: Address; label: string; addedAt: number };
export type ApprovedRecipientPolicy = { requireApproval: boolean };

const eventName = 'veilora:approved-recipients:changed';
const listKey = (wallet: string) => `veilora:approved-recipients:${wallet.toLowerCase()}`;
const policyKey = (wallet: string) => `veilora:approved-recipients-policy:${wallet.toLowerCase()}`;

export function getApprovedRecipients(wallet: string): ApprovedRecipient[] {
  if (!wallet) return [];
  try {
    const value: unknown = JSON.parse(localStorage.getItem(listKey(wallet)) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
      .filter((entry) => typeof entry.address === 'string' && isAddress(entry.address) && entry.address.toLowerCase() !== zeroAddress)
      .map((entry) => ({
        address: getAddress(entry.address as string),
        label: typeof entry.label === 'string' && entry.label.trim() ? entry.label.trim().slice(0, 60) : 'Approved recipient',
        addedAt: typeof entry.addedAt === 'number' && Number.isFinite(entry.addedAt) ? entry.addedAt : 0,
      }));
  } catch { return []; }
}

export function getApprovedRecipientPolicy(wallet: string): ApprovedRecipientPolicy {
  if (!wallet) return { requireApproval: false };
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(policyKey(wallet)) || '{}');
    return { requireApproval: !!parsed && typeof parsed === 'object' && 'requireApproval' in parsed && parsed.requireApproval === true };
  } catch { return { requireApproval: false }; }
}

function changed(wallet: string) {
  window.dispatchEvent(new CustomEvent(eventName, { detail: { wallet: wallet.toLowerCase() } }));
}

export function saveApprovedRecipientPolicy(wallet: string, policy: ApprovedRecipientPolicy) {
  if (!wallet) throw new Error('Connect a wallet before changing recipient approvals.');
  localStorage.setItem(policyKey(wallet), JSON.stringify({ requireApproval: policy.requireApproval }));
  changed(wallet);
}

export function saveApprovedRecipients(wallet: string, entries: ApprovedRecipient[]) {
  if (!wallet) throw new Error('Connect a wallet before managing recipient approvals.');
  if (entries.length > 100) throw new Error('You can approve up to 100 recipients per wallet.');
  const deduplicated = new Map<string, ApprovedRecipient>();
  for (const entry of entries) {
    if (!isAddress(entry.address) || entry.address.toLowerCase() === zeroAddress) continue;
    const address = getAddress(entry.address);
    const label = entry.label.trim().slice(0, 60);
    if (!label) throw new Error('Give each approved recipient a name.');
    deduplicated.set(address.toLowerCase(), { ...entry, address, label });
  }
  localStorage.setItem(listKey(wallet), JSON.stringify([...deduplicated.values()]));
  changed(wallet);
}

export function clearApprovedRecipients(wallet: string) {
  if (!wallet) return;
  localStorage.removeItem(listKey(wallet));
  localStorage.removeItem(policyKey(wallet));
  changed(wallet);
}

export function useWalletApprovedRecipients(wallet: string) {
  const [, setRevision] = useState(0);
  useEffect(() => {
    const sync = (event?: Event) => {
      const changedWallet = (event as CustomEvent<{ wallet?: string }> | undefined)?.detail?.wallet;
      if (!changedWallet || changedWallet === wallet.toLowerCase()) setRevision((revision) => revision + 1);
    };
    window.addEventListener(eventName, sync);
    window.addEventListener('storage', sync);
    sync();
    return () => { window.removeEventListener(eventName, sync); window.removeEventListener('storage', sync); };
  }, [wallet]);
  return { entries: getApprovedRecipients(wallet), policy: getApprovedRecipientPolicy(wallet) };
}
