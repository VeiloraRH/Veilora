import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, KeyRound, Loader2, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { getAddress, type Hex } from 'viem';
import { PageTitle, TokenIcon } from '@/components/wallet/WalletUI';
import { Private } from '@/components/wallet/Private';
import { SignPreview } from '@/components/wallet/TxExplanation';
import { useWallet } from '@/lib/walletContext';
import { EXPLORER, amountText } from '@/lib/walletChain';
import { KNOWN_SPENDERS, readApprovals, revokeApproval, revokeCall, type TokenApproval } from '@/lib/approvals';
export const Route=createFileRoute('/app/approvals')({component:ApprovalsScreen});

const keyOf=(a:TokenApproval)=>`${a.token.address}:${a.spender.address}`;

function ApprovalsScreen() {
 const {walletAddress,getStoredDeviceKey}=useWallet(); const cache=useQueryClient();
 const approvals=useQuery({queryKey:['approvals',walletAddress],enabled:!!walletAddress,staleTime:30000,queryFn:()=>readApprovals(getAddress(walletAddress))});
 const [selected,setSelected]=useState<TokenApproval|null>(null); const [busy,setBusy]=useState(''); const [error,setError]=useState(''); const [done,setDone]=useState<{hash:string;text:string}|null>(null);
 const list=approvals.data??[];
 async function revoke(items:TokenApproval[]){const key=getStoredDeviceKey();if(!key){setError('Unlock your device key first.');return;}setError('');setDone(null);let last='';
  try{for(const [i,a] of items.entries()){setBusy(items.length>1?`Revoking ${i+1} of ${items.length}…`:'Signing revoke…');last=await revokeApproval(getAddress(walletAddress),key as Hex,a);}
   setDone({hash:last,text:items.length>1?`Revoked ${items.length} approvals.`:`Revoked ${items[0].spender.label}'s access to your ${items[0].token.symbol}.`});setSelected(null);}
  catch(e){setError(e instanceof Error?e.message:'The revoke could not be completed.');}
  finally{setBusy('');void cache.invalidateQueries({queryKey:['approvals']});void cache.invalidateQueries({queryKey:['transactions']});}}
 return <><PageTitle title="Token approvals" description="Contracts your account has allowed to move its tokens. Revoke any you no longer need." action={<button className="wallet-icon-button" aria-label="Refresh approvals" onClick={()=>void approvals.refetch()}><RefreshCw size={18} className={approvals.isFetching?'animate-spin':''}/></button>}/>
 {done&&<div className="wallet-notice" role="status"><span>{done.text}</span><a href={`${EXPLORER}/tx/${done.hash}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">View <ExternalLink size={13}/></a></div>}
 {error&&<p role="alert" className="wallet-error mb-5">{error}</p>}
 <div className="rules-layout"><div className="rules-main"><section>
  {approvals.isPending?<div className="wallet-panel wallet-empty"><Loader2 className="animate-spin"/><h3>Reading approvals</h3><p>Checking every token against the contracts Veilora works with.</p></div>
  :approvals.isError?<div className="wallet-panel wallet-empty"><h3>Approvals are unavailable</h3><p>{approvals.error instanceof Error?approvals.error.message:'Try again shortly.'}</p><button className="wallet-soft-button" onClick={()=>void approvals.refetch()}><RefreshCw size={15}/>Try again</button></div>
  :!list.length?<div className="wallet-panel wallet-empty"><span className="wallet-empty-icon"><ShieldCheck/></span><h3>No open approvals</h3><p>No contract can move your tokens right now. Veilora approves only the exact amount a swap or bridge needs, so approvals are normally used up straight away.</p></div>
  :<><div className="wallet-section-heading"><h2>Open approvals <span className="rules-count">{list.length}</span></h2>{list.length>1&&<button className="rule-button danger" disabled={!!busy} onClick={()=>void revoke(list)}>{busy&&busy.includes('of')?<Loader2 size={14} className="animate-spin"/>:<Trash2 size={14}/>}Revoke all</button>}</div>
   <div className="rules-stack">{list.map(a=>{const open=selected&&keyOf(selected)===keyOf(a);return <article key={keyOf(a)} className="wallet-panel approval-row"><div className="approval-row-main"><TokenIcon token={a.token} size={36}/><div className="min-w-0 flex-1"><strong>{a.token.symbol} <span>→ {a.spender.label}</span></strong><small>{a.spender.purpose} · <a href={`${EXPLORER}/address/${a.spender.address}`} target="_blank" rel="noreferrer">{a.spender.address.slice(0,6)}…{a.spender.address.slice(-4)}</a></small></div><div className="approval-amount"><span className={a.unlimited?'unlimited':''}>{a.unlimited?'Unlimited':<Private>{amountText(a.amount,a.token.decimals)}</Private>}</span><small>can be moved</small></div>{!open&&<button className="rule-button danger" disabled={!!busy} onClick={()=>{setSelected(a);setError('');}}><Trash2 size={14}/>Revoke</button>}</div>
    {open&&<div className="approval-confirm"><SignPreview wallet={walletAddress} calls={[revokeCall(a)]}/><div className="review-actions"><button className="rule-button" disabled={!!busy} onClick={()=>setSelected(null)}>Cancel</button><button className="wallet-primary-button" disabled={!!busy} onClick={()=>void revoke([a])}>{busy?<><Loader2 size={16} className="animate-spin"/>{busy}</>:'Revoke & sign'}</button></div></div>}
   </article>;})}</div></>}
 </section></div>
 <aside className="rules-aside"><div className="wallet-panel rules-aside-card"><span className="rules-aside-icon"><KeyRound size={20}/></span><h3>What an approval is</h3><p>An approval lets a contract move up to a set amount of one token from your account, usually so a swap or bridge can take what it needs. One that is left open after a failed or cancelled transaction is a permission nobody is using.</p>
  <ol className="rules-steps">{[['Exact amounts','Veilora approves only what each swap or bridge needs.'],['Known contracts only',`The co-signer allows approvals to ${KNOWN_SPENDERS.length} contracts: Uniswap v3, Uniswap v4 and Relay.`],['Free to revoke','Revoking is signed like any action, and Veilora’s relayer pays the gas.']].map(([t,d],i)=><li key={t}><span>{i+1}</span><div><strong>{t}</strong><p>{d}</p></div></li>)}</ol></div></aside></div>
 </>;
}
