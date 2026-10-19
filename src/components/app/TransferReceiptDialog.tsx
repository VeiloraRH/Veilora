import { useState } from 'react';
import { Check, CheckCircle2, Copy, Download, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Private } from '@/components/wallet/Private';
import { shortAddress } from '@/components/wallet/WalletUI';
import { EXPLORER_TX, receiptImage, receiptText, type TransferReceipt } from '@/lib/transferReceipt';

export function TransferReceiptDialog({ receipt, onClose }: { receipt: TransferReceipt | null; onClose: () => void }) {
 const [copied, setCopied] = useState(false);
 const [error, setError] = useState('');
 async function copy() {
  if (!receipt) return;
  try { await navigator.clipboard.writeText(receiptText(receipt)); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  catch { setError('Could not copy. Use the transaction link instead.'); }
 }
 async function save() {
  if (!receipt) return;
  try {
   const url = URL.createObjectURL(await receiptImage(receipt));
   const link = document.createElement('a');
   link.href = url; link.download = `veilora-receipt-${receipt.hash.slice(2, 10)}.png`; link.click();
   setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save the image.'); }
 }
 return <Dialog open={!!receipt} onOpenChange={open => { if (!open) { setError(''); onClose(); } }}>
  <DialogContent className="wallet-dialog completion-dialog sm:max-w-sm">
   <span className="completion-dialog-icon"><CheckCircle2 size={25}/></span>
   <DialogHeader className="text-center">
    <DialogTitle>Transfer confirmed</DialogTitle>
    <DialogDescription>Your receipt for this transfer.</DialogDescription>
   </DialogHeader>
   {receipt && <>
    <p className="text-center text-2xl font-medium tracking-tight"><Private>{receipt.what}</Private></p>
    <div className="send-review">
     <div><span>To</span><strong className="text-right font-normal">{receipt.recipientName ?? <span className="font-mono text-xs">{shortAddress(receipt.recipient)}</span>}</strong></div>
     {receipt.recipientName && <div><span>Address</span><strong className="font-mono text-xs font-normal">{shortAddress(receipt.recipient)}</strong></div>}
     <div><span>Date</span><strong className="font-normal">{new Date(receipt.sentAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</strong></div>
     <div><span>Network fee</span><strong className="font-normal">Paid by Veilora</strong></div>
     <div><span>Transaction</span><a className="inline-flex items-center gap-1 font-mono text-xs" href={EXPLORER_TX(receipt.hash)} target="_blank" rel="noreferrer">{shortAddress(receipt.hash)}<ExternalLink size={12}/></a></div>
    </div>
    <div className="flex gap-2">
     <button type="button" className="wallet-soft-button flex-1" onClick={() => void copy()}>{copied ? <Check size={14}/> : <Copy size={14}/>}{copied ? 'Copied' : 'Copy receipt'}</button>
     <button type="button" className="wallet-soft-button flex-1" onClick={() => void save()}><Download size={14}/>Save image</button>
    </div>
    {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
   </>}
   <button className="wallet-primary-button completion-dialog-done" onClick={() => { setError(''); onClose(); }}>Done</button>
  </DialogContent>
 </Dialog>;
}
