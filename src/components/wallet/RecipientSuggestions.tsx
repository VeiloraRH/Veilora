import { useMemo } from 'react';
import { ContactRound, History } from 'lucide-react';
import { useTransactions } from '@/lib/walletQueries';
import { useWalletBlocklist } from '@/lib/addressBlocklist';
import { getWalletContacts } from '@/lib/contacts';
import { recentRecipients, suggestRecipients } from '@/lib/recentRecipients';
import { shortAddress } from '@/components/wallet/WalletUI';

/** Contacts and past recipients matching what is typed in the recipient field. Picking one only fills the address. */
export function RecipientSuggestions({ wallet, query, onPick }: { wallet: string; query: string; onPick: (address: string) => void }) {
 const transactions = useTransactions();
 const blocked = useWalletBlocklist(wallet);
 const suggestions = useMemo(() => {
  const recent = recentRecipients(transactions.data ?? [], wallet, getWalletContacts(wallet), blocked, 20);
  return suggestRecipients(query, getWalletContacts(wallet), recent);
 }, [query, transactions.data, wallet, blocked]);
 if (!suggestions.length) return null;
 return <ul className="overflow-hidden rounded-xl border" aria-label="Suggested recipients">
  {suggestions.map(s => <li key={s.address}>
   <button type="button" className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted" onClick={() => onPick(s.address)}>
    {s.source === 'contact' ? <ContactRound size={15} className="shrink-0 text-muted-foreground"/> : <History size={15} className="shrink-0 text-muted-foreground"/>}
    <span className="min-w-0 flex-1">
     <span className="block truncate text-sm">{s.name ?? <span className="font-mono text-xs">{shortAddress(s.address)}</span>}</span>
     <span className="block truncate text-[11px] text-muted-foreground">{s.note ? `${s.note} · ` : ''}<span className="font-mono">{shortAddress(s.address)}</span></span>
    </span>
    <span className="shrink-0 text-[10px] text-muted-foreground">{s.source === 'contact' ? 'Contact' : 'Sent before'}</span>
   </button>
  </li>)}
 </ul>;
}
