/**
 * The receipt shown after a transfer: what moved, to whom, when, and the
 * transaction to check it against. Built from the confirmed transaction the
 * wallet just submitted; nothing here is sent anywhere.
 */
export type TransferReceipt = {
 what: string;
 recipient: `0x${string}`;
 recipientName?: string | null;
 from: `0x${string}`;
 hash: `0x${string}`;
 sentAt: string;
};

export const EXPLORER_TX = (hash: string) => `https://robinhoodchain.blockscout.com/tx/${hash}`;
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function receiptRows(r: TransferReceipt): [string, string][] {
 return [
  ['Sent', r.what],
  ['To', r.recipientName ? `${r.recipientName} (${r.recipient})` : r.recipient],
  ['From', r.from],
  ['Date', when(r.sentAt)],
  ['Network', 'Robinhood Chain'],
  ['Network fee', 'Paid by Veilora'],
  ['Transaction', r.hash],
 ];
}

export function receiptText(r: TransferReceipt): string {
 return ['Veilora transfer receipt', ...receiptRows(r).map(([label, value]) => `${label}: ${value}`), EXPLORER_TX(r.hash)].join('\n');
}

/** Draw the receipt onto a canvas and return it as a PNG blob (browser only). */
export async function receiptImage(r: TransferReceipt): Promise<Blob> {
 const scale = 2; const width = 640; const height = 560;
 const canvas = document.createElement('canvas');
 canvas.width = width * scale; canvas.height = height * scale;
 const ctx = canvas.getContext('2d');
 if (!ctx) throw new Error('Could not draw the receipt image.');
 ctx.scale(scale, scale);
 const font = getComputedStyle(document.body).fontFamily || 'sans-serif';
 ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
 ctx.fillStyle = '#eaba65'; ctx.fillRect(0, 0, width, 8);
 ctx.fillStyle = '#202638'; ctx.font = `600 22px ${font}`; ctx.fillText('Veilora', 40, 60);
 ctx.fillStyle = '#8891a4'; ctx.font = `400 14px ${font}`; ctx.fillText('Transfer receipt', 40, 84);
 ctx.fillStyle = '#202638'; ctx.font = `600 32px ${font}`; ctx.fillText(r.what, 40, 140, width - 80);
 let y = 190;
 for (const [label, value] of receiptRows(r).slice(1)) {
  ctx.fillStyle = '#8891a4'; ctx.font = `400 13px ${font}`; ctx.fillText(label, 40, y);
  ctx.fillStyle = '#202638'; ctx.font = `500 13px ${label === 'To' || label === 'From' || label === 'Transaction' ? 'ui-monospace, monospace' : font}`;
  const text = value.length > 66 ? `${value.slice(0, 32)}…${value.slice(-32)}` : value;
  ctx.fillText(text, 40, y + 20, width - 80); y += 52;
 }
 ctx.fillStyle = '#8891a4'; ctx.font = `400 11px ${font}`; ctx.fillText('Check it on robinhoodchain.blockscout.com', 40, height - 24);
 return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not create the image.')), 'image/png'));
}
