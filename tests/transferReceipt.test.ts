import { expect, test } from 'bun:test';
import { EXPLORER_TX, receiptRows, receiptText, type TransferReceipt } from '../src/lib/transferReceipt';

const receipt: TransferReceipt = {
 what: '25 USDG',
 recipient: '0x2222222222222222222222222222222222222222',
 recipientName: 'Studio',
 from: '0x1111111111111111111111111111111111111111',
 hash: `0x${'ab'.repeat(32)}`,
 sentAt: '2026-10-19T09:30:00.000Z',
};

test('lists what moved, who received it and the transaction to check', () => {
 const rows = Object.fromEntries(receiptRows(receipt));
 expect(rows.Sent).toBe('25 USDG');
 expect(rows.To).toBe('Studio (0x2222222222222222222222222222222222222222)');
 expect(rows['Network fee']).toBe('Paid by Veilora');
 expect(rows.Transaction).toBe(receipt.hash);
 expect(Object.fromEntries(receiptRows({ ...receipt, recipientName: null })).To).toBe(receipt.recipient);
});

test('copies as plain text ending with the explorer link', () => {
 const text = receiptText(receipt).split('\n');
 expect(text[0]).toBe('Veilora transfer receipt');
 expect(text).toContain('From: 0x1111111111111111111111111111111111111111');
 expect(text.at(-1)).toBe(EXPLORER_TX(receipt.hash));
 expect(text.at(-1)).toBe(`https://robinhoodchain.blockscout.com/tx/${receipt.hash}`);
});
