import { copyAddress } from '@/lib/clipboardGuard';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Check, Copy, ExternalLink, Eye, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { PageTitle, TokenIcon, TransactionsTable, shortAddress } from '@/components/wallet/WalletUI';
import { Private } from '@/components/wallet/Private';
import { useWallet } from '@/lib/walletContext';
import { usePortfolioValue, useTransactions } from '@/lib/walletQueries';
import { EXPLORER, amountText } from '@/lib/walletChain';
import { MAX_WATCHED, addWatched, removeWatched, renameWatched, useWatchList, type WatchedAddress } from '@/lib/watchList';
export const Route=createFileRoute('/app/watch')({validateSearch:(s:Record<string,unknown>)=>({address:typeof s.address==='string'?s.address:''}),component:WatchScreen});

const usd=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);

function WatchScreen() {
 const {walletAddress}=useWallet(); const list=useWatchList(walletAddress); const {address}=Route.useSearch(); const navigate=useNavigate();
 const selected=list.find(w=>w.address.toLowerCase()===address.toLowerCase())??list[0]??null;
 const [adding,setAdding]=useState(false);
 return <><PageTitle title="Watch-only" description="Follow other addresses' balances and history. You can't sign for them; nothing here can move funds." action={list.length<MAX_WATCHED?<button className="wallet-soft-button" onClick={()=>setAdding(true)}><Plus size={15}/>Watch an address</button>:undefined}/>
 {adding&&<AddWatch owner={walletAddress} onDone={a=>{setAdding(false);if(a)void navigate({to:'/app/watch',search:{address:a}});}}/>}
 {!list.length&&!adding?<div className="wallet-panel wallet-empty"><span className="wallet-empty-icon"><Eye/></span><h3>Nothing watched yet</h3><p>Add a second wallet, a treasury, or any Robinhood Chain address to see its balances and activity here. The list is saved on this device only.</p><button className="wallet-soft-button" onClick={()=>setAdding(true)}><Plus size={15}/>Watch an address</button></div>
 :list.length>0&&<div className="watch-layout"><nav className="watch-list" aria-label="Watched addresses">{list.map(w=><button key={w.id} className={`watch-chip ${selected?.id===w.id?'on':''}`} onClick={()=>void navigate({to:'/app/watch',search:{address:w.address}})}><Eye size={14}/><span><strong>{w.name}</strong><small>{shortAddress(w.address)}</small></span></button>)}</nav>
  {selected&&<WatchedView key={selected.id} owner={walletAddress} watched={selected}/>}</div>}
 </>;
}

function AddWatch({owner,onDone}:{owner:string;onDone:(address:string|null)=>void}) {
 const [name,setName]=useState('');const [address,setAddress]=useState('');const [error,setError]=useState('');
 return <form className="wallet-panel watch-add" onSubmit={e=>{e.preventDefault();const err=addWatched(owner,name,address);if(err)setError(err);else onDone(address.trim());}}>
  <label className="builder-field"><span>Name</span><input className="builder-input" maxLength={40} placeholder="e.g. Treasury" value={name} onChange={e=>setName(e.target.value)}/></label>
  <label className="builder-field"><span>Address on Robinhood Chain</span><input className="builder-input font-mono" autoFocus spellCheck={false} placeholder="0x…" value={address} onChange={e=>{setAddress(e.target.value.trim());setError('');}}/></label>
  {error&&<p role="alert" className="wallet-error">{error}</p>}
  <div className="review-actions"><button type="button" className="rule-button" onClick={()=>onDone(null)}>Cancel</button><button className="wallet-primary-button" disabled={!address}>Start watching</button></div></form>;
}

function WatchedView({owner,watched}:{owner:string;watched:WatchedAddress}) {
 const {holdings,prices}=usePortfolioValue(watched.address); const history=useTransactions(watched.address); const navigate=useNavigate();
 const [editing,setEditing]=useState(false);const [name,setName]=useState(watched.name);const [copied,setCopied]=useState(false);const [confirmRemove,setConfirmRemove]=useState(false);
 const held=(holdings.data??[]).filter(h=>h.raw!=null&&h.raw>0n);
 return <section className="watch-view"><div className="wallet-panel watch-header">
  <div className="watch-title">{editing?<form className="flex items-center gap-2" onSubmit={e=>{e.preventDefault();renameWatched(owner,watched.id,name);setEditing(false);}}><input className="builder-input" autoFocus maxLength={40} value={name} onChange={e=>setName(e.target.value)}/><button className="wallet-icon-button" aria-label="Save name"><Check size={16}/></button><button type="button" className="wallet-icon-button" aria-label="Cancel" onClick={()=>{setName(watched.name);setEditing(false);}}><X size={16}/></button></form>
   :<><h2>{watched.name}</h2><button className="wallet-icon-button" aria-label="Rename" onClick={()=>setEditing(true)}><Pencil size={14}/></button></>}<span className="watch-badge"><Eye size={12}/>Watch-only</span></div>
  <div className="watch-address"><span className="font-mono">{watched.address}</span><button className="wallet-icon-button" aria-label="Copy address" onClick={()=>void copyAddress(watched.address).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),1500);})}>{copied?<Check size={14}/>:<Copy size={14}/>}</button><a className="wallet-icon-button" href={`${EXPLORER}/address/${watched.address}`} target="_blank" rel="noreferrer" aria-label="View on explorer"><ExternalLink size={14}/></a></div>
  <div className="watch-total"><span>Estimated value</span><strong><Private mask="••••••">{holdings.isPending||prices.isPending?'—':holdings.isError?'Unavailable':usd(prices.data?.total??0)}</Private></strong>{prices.data?.partial&&<small>Some assets could not be priced</small>}</div>
  <div className="watch-actions"><button className="rule-button" onClick={()=>{void holdings.refetch();void history.refetch();}}><RefreshCw size={14}/>Refresh</button>{confirmRemove?<><span className="text-[11px] text-[var(--w-muted)]">Stop watching?</span><button className="rule-button danger" onClick={()=>{removeWatched(owner,watched.id);void navigate({to:'/app/watch',search:{address:''}});}}><Check size={14}/>Remove</button><button className="rule-button" onClick={()=>setConfirmRemove(false)}>Keep</button></>:<button className="rule-button danger" onClick={()=>setConfirmRemove(true)}><Trash2 size={14}/>Stop watching</button>}</div>
 </div>
 <div className="wallet-section-heading"><h2>Holdings</h2></div>
 <div className="wallet-panel watch-holdings">{holdings.isPending?<p className="rc-muted p-5">Loading balances…</p>:!held.length?<p className="rc-muted p-5">No supported assets at this address.</p>:held.map(h=><div key={h.token.symbol} className="watch-holding"><TokenIcon token={h.token} size={30}/><span><strong>{h.token.symbol}</strong><small>{h.token.name}</small></span><b><Private>{amountText(h.raw!,h.token.decimals)}</Private></b></div>)}</div>
 <div className="wallet-section-heading"><h2>Activity</h2></div>
 <div className="wallet-panel"><TransactionsTable records={(history.data??[]).slice(0,25)} loading={history.isPending} error={history.error} onRetry={()=>void history.refetch()} partial={!!history.data?.partial} perspective={watched.address}/></div>
 </section>;
}
