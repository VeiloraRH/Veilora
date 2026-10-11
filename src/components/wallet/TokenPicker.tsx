import { useState } from 'react';
import { Search } from 'lucide-react';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from '@/components/ui/dialog';
import { WALLET_TOKENS,type WalletToken } from '@/lib/tokens';
import { TokenIcon } from './WalletUI';
export function TokenPicker({open,onClose,onPick,exclude}:{open:boolean;onClose:()=>void;onPick:(token:WalletToken)=>void;exclude?:string}) {
 const [search,setSearch]=useState('');
 return <Dialog open={open} onOpenChange={v=>{if(!v){setSearch('');onClose();}}}><DialogContent className="wallet-dialog sm:max-w-md"><DialogHeader><DialogTitle>Select an asset</DialogTitle><DialogDescription>Available on Robinhood Chain</DialogDescription></DialogHeader><div className="flex items-center gap-3 rounded-xl bg-muted p-3"><Search size={18} className="text-muted-foreground"/><input autoFocus className="min-w-0 flex-1 bg-transparent text-sm outline-none" aria-label="Search assets" placeholder="Search name or symbol" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="max-h-80 space-y-1 overflow-y-auto">{WALLET_TOKENS.filter(t=>t.symbol!==exclude&&`${t.symbol} ${t.name}`.toLowerCase().includes(search.toLowerCase())).map(t=><button className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-muted" key={t.symbol} onClick={()=>{onPick(t);setSearch('');onClose();}}><TokenIcon token={t}/><span><strong className="block text-sm font-medium">{t.symbol}</strong><small className="text-muted-foreground">{t.name}</small></span></button>)}</div></DialogContent></Dialog>;
}
