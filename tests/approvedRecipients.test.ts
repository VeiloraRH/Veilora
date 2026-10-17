import { expect, test } from 'bun:test';
import { getAddress } from 'viem';
import { clearApprovedRecipients, getApprovedRecipientPolicy, getApprovedRecipients, saveApprovedRecipientPolicy, saveApprovedRecipients } from '../src/lib/approvedRecipients';

test('approved recipients and strict mode stay wallet-scoped and clear on disconnect', () => {
  const priorStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const priorWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent: () => true } });
  const wallet = '0xeFE2268BcC784301A939DAaee7393ab81af4CC53';
  const otherWallet = '0x0000000000000000000000000000000000000001';
  const recipient = '0xab12000000000000000000000000000000009f3c';
  try {
    saveApprovedRecipients(wallet, [{ address: recipient, label: 'Treasury', addedAt: 1 }]);
    saveApprovedRecipientPolicy(wallet, { requireApproval: true });
    expect(getApprovedRecipients(wallet)).toMatchObject([{ address: getAddress(recipient), label: 'Treasury' }]);
    expect(getApprovedRecipientPolicy(wallet).requireApproval).toBe(true);
    expect(getApprovedRecipients(otherWallet)).toEqual([]);
    expect(getApprovedRecipientPolicy(otherWallet).requireApproval).toBe(false);
    clearApprovedRecipients(wallet);
    expect(getApprovedRecipients(wallet)).toEqual([]);
    expect(getApprovedRecipientPolicy(wallet).requireApproval).toBe(false);
  } finally {
    if (priorStorage) Object.defineProperty(globalThis, 'localStorage', priorStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
    if (priorWindow) Object.defineProperty(globalThis, 'window', priorWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
