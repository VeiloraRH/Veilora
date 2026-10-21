import { FilePen, Trash2 } from 'lucide-react';
import { getWalletContacts } from '@/lib/contacts';
import { removeDraft, useDrafts, useOnline, type SendDraft } from '@/lib/sendDrafts';
import { Private } from '@/components/wallet/Private';
import { shortAddress } from '@/components/wallet/WalletUI';

/** Saved, unsigned sends. Opening one runs the full Send flow and its checks. */
export function SendDraftsCard({ wallet, onOpen }: { wallet: string; onOpen: (draft: SendDraft) => void }) {
 const drafts = useDrafts(wallet);
 const online = useOnline();
 if (!drafts.length) return null;
 const names = new Map(getWalletContacts(wallet).map(c => [c.address.toLowerCase(), c.name]));
 return <section className="wallet-panel mt-6 space-y-4 p-6" aria-labelledby="drafts-title">
  <div className="flex items-start gap-3"><span className="rules-aside-icon"><FilePen size={17}/></span>
   <div><span className="wallet-health-eyebrow">Not signed yet</span><h2 id="drafts-title" className="text-sm font-medium">Send drafts</h2></div></div>
  <ul className="divide-y">
   {drafts.map(d => <li key={d.id} className="flex items-center gap-3 py-2.5 text-xs">
    <span className="min-w-0 flex-1"><strong className="font-medium"><Private>{d.amount}</Private> {d.symbol}</strong> to {names.get(d.recipient.toLowerCase()) ?? <span className="font-mono">{shortAddress(d.recipient)}</span>}
     <span className="block text-[11px] text-muted-foreground">Saved {new Date(d.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span></span>
    <button type="button" className="wallet-soft-button" disabled={!online} title={online ? undefined : 'Reconnect to review and send'} onClick={() => onOpen(d)}>Review &amp; send</button>
    <button type="button" className="wallet-icon-button" aria-label="Delete draft" onClick={() => removeDraft(wallet, d.id)}><Trash2 size={14}/></button>
   </li>)}
  </ul>
  <p className="text-[11px] text-muted-foreground">Drafts stay on this device. Nothing is signed until you review and confirm, and every check runs again then.</p>
 </section>;
}
