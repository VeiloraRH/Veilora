import { useEffect, useState } from 'react';
import { getAddress, isAddress } from 'viem';

/**
 * Send drafts: a recipient, asset and amount saved on this device, never
 * signed. Opening one starts the normal Send flow, so every check runs at the
 * moment it is signed. Useful offline, or to prepare payments ahead of time.
 */
export type SendDraft = { id: string; recipient: `0x${string}`; symbol: string; amount: string; createdAt: string };
export const MAX_DRAFTS = 20;
const CHANGED = 'veilora:send-drafts:changed';
const keyFor = (wallet: string) => `veilora:send-drafts:${wallet.toLowerCase()}`;

export function getDrafts(wallet: string): SendDraft[] {
 if (!wallet) return [];
 try {
  const parsed: unknown = JSON.parse(localStorage.getItem(keyFor(wallet)) || '[]');
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((d): d is SendDraft => !!d && typeof d.id === 'string' && typeof d.recipient === 'string' && isAddress(d.recipient) &&
   typeof d.symbol === 'string' && typeof d.amount === 'string' && /^\d+(\.\d+)?$/.test(d.amount) && typeof d.createdAt === 'string')
   .map(d => ({ ...d, recipient: getAddress(d.recipient) }));
 } catch { return []; }
}

function save(wallet: string, drafts: SendDraft[]) {
 localStorage.setItem(keyFor(wallet), JSON.stringify(drafts));
 if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CHANGED));
}

/** Returns an error message, or null when saved. */
export function addDraft(wallet: string, draft: Omit<SendDraft, 'id' | 'createdAt'>): string | null {
 if (!isAddress(draft.recipient) || !/^\d+(\.\d+)?$/.test(draft.amount) || Number(draft.amount) <= 0) return 'Enter a valid recipient and amount first.';
 const drafts = getDrafts(wallet);
 if (drafts.length >= MAX_DRAFTS) return `You can keep up to ${MAX_DRAFTS} drafts. Send or delete one first.`;
 save(wallet, [{ ...draft, recipient: getAddress(draft.recipient), id: crypto.randomUUID(), createdAt: new Date().toISOString() }, ...drafts]);
 return null;
}

export function removeDraft(wallet: string, id: string) {
 save(wallet, getDrafts(wallet).filter(d => d.id !== id));
}

export function useDrafts(wallet: string): SendDraft[] {
 const [drafts, setDrafts] = useState(() => getDrafts(wallet));
 useEffect(() => {
  setDrafts(getDrafts(wallet));
  const sync = () => setDrafts(getDrafts(wallet));
  window.addEventListener(CHANGED, sync); window.addEventListener('storage', sync);
  return () => { window.removeEventListener(CHANGED, sync); window.removeEventListener('storage', sync); };
 }, [wallet]);
 return drafts;
}

export function useOnline(): boolean {
 const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
 useEffect(() => {
  const on = () => setOnline(true); const off = () => setOnline(false);
  window.addEventListener('online', on); window.addEventListener('offline', off);
  return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
 }, []);
 return online;
}
