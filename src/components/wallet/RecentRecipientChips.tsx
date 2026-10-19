import { useMemo } from 'react';
import { History } from 'lucide-react';
import { useTransactions } from '@/lib/walletQueries';
import { useWalletBlocklist } from '@/lib/addressBlocklist';
import { getWalletContacts } from '@/lib/contacts';
import { recentRecipients } from '@/lib/recentRecipients';
import { shortAddress } from '@/components/wallet/WalletUI';

/** One-tap chips for people this wallet recently sent to. Picking one only fills the address. */
export function RecentRecipientChips({ wallet, selected, onPick }: { wallet: string; selected: string; onPick: (address: string) => void }) {
 const transactions = useTransactions();
 const blocked = useWalletBlocklist(wallet);
 const recent = useMemo(() => recentRecipients(transactions.data ?? [], wallet, getWalletContacts(wallet), blocked), [transactions.data, wallet, blocked]);
 if (!recent.length) return null;
 return <div className="space-y-2">
  <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><History size={13}/>Recent</p>
  <div className="flex flex-wrap gap-2">
   {recent.map(r => <button key={r.address} type="button" aria-pressed={selected.toLowerCase() === r.address.toLowerCase()} title={r.address}
    onClick={() => onPick(r.address)}
    className={`rounded-full border px-3 py-1.5 text-xs transition-colors hover:bg-muted ${selected.toLowerCase() === r.address.toLowerCase() ? 'border-blue-500 bg-blue-500/5' : ''}`}>
    {r.name ?? <span className="font-mono">{shortAddress(r.address)}</span>}
   </button>)}
  </div>
 </div>;
}
