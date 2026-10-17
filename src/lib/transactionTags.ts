import { useEffect, useState } from 'react';

export type TransactionTag = { tag: string; costCenter: string; updatedAt: string };
export type TransactionTags = Record<string, TransactionTag>;

export const transactionTagsChangedEvent = 'veilora:transaction-tags-changed';

function storageKey(wallet: string) {
  return `veilora:transaction-tags:${wallet.toLowerCase()}`;
}

function isTag(value: unknown): value is TransactionTag {
  return !!value && typeof value === 'object'
    && typeof (value as TransactionTag).tag === 'string'
    && typeof (value as TransactionTag).costCenter === 'string'
    && typeof (value as TransactionTag).updatedAt === 'string';
}

export function transactionTagKey(transaction: { id: string; hash: string }) {
  return transaction.hash ? `tx:${transaction.hash.toLowerCase()}` : `local:${transaction.id}`;
}

export function loadTransactionTags(wallet: string): TransactionTags {
  if (!wallet) return {};
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey(wallet)) || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([key, value]) => key.length <= 180 && isTag(value)));
  } catch {
    return {};
  }
}

export function saveTransactionTag(wallet: string, key: string, values: Pick<TransactionTag, 'tag' | 'costCenter'>) {
  if (!wallet || !key) return;
  const tag = values.tag.trim().slice(0, 48);
  const costCenter = values.costCenter.trim().slice(0, 60);
  const all = loadTransactionTags(wallet);
  if (!tag && !costCenter) delete all[key];
  else all[key] = { tag, costCenter, updatedAt: new Date().toISOString() };
  localStorage.setItem(storageKey(wallet), JSON.stringify(all));
  window.dispatchEvent(new CustomEvent(transactionTagsChangedEvent, { detail: { wallet: wallet.toLowerCase() } }));
}

export function useTransactionTags(wallet: string) {
  const [tags, setTags] = useState<TransactionTags>(() => loadTransactionTags(wallet));
  useEffect(() => {
    const refresh = () => setTags(loadTransactionTags(wallet));
    const onChange = (event: Event) => {
      const owner = (event as CustomEvent<{ wallet?: string }>).detail?.wallet;
      if (!owner || owner === wallet.toLowerCase()) refresh();
    };
    refresh();
    window.addEventListener(transactionTagsChangedEvent, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(transactionTagsChangedEvent, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [wallet]);
  return tags;
}
