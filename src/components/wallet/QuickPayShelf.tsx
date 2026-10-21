import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { CONTACTS_CHANGED, getWalletContacts, type WalletContact } from '@/lib/contacts';

/** Starred contacts as one-tap shortcuts that open Send with their address filled in. */
export function QuickPayShelf({ wallet, onPay }: { wallet: string; onPay: (address: string) => void }) {
 const read = () => getWalletContacts(wallet).filter(c => c.starred);
 const [starred, setStarred] = useState<WalletContact[]>(read);
 useEffect(() => {
  setStarred(read());
  const sync = () => setStarred(read());
  window.addEventListener(CONTACTS_CHANGED, sync);
  window.addEventListener('storage', sync);
  return () => { window.removeEventListener(CONTACTS_CHANGED, sync); window.removeEventListener('storage', sync); };
 }, [wallet]);
 if (!starred.length) return null;
 return <div className="mt-5 space-y-2" aria-label="Quick pay">
  <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground"><Star size={12} className="fill-amber-400 text-amber-500"/>Quick pay</p>
  <div className="flex flex-wrap justify-center gap-2">
   {starred.map(c => <button key={c.id} type="button" title={c.address} onClick={() => onPay(c.address)}
    className="max-w-32 truncate rounded-full border px-3 py-1.5 text-xs transition-colors hover:bg-muted">{c.name}</button>)}
  </div>
 </div>;
}
