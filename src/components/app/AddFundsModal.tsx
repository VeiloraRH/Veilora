import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, CreditCard, ExternalLink, Fuel, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TokenIcon } from '@/components/wallet/WalletUI';
import { createOnrampSession, getOnrampConfig, getOnrampSession, type OnrampAsset, type OnrampSession } from '@/lib/api';
import { ROBINHOOD_TOKEN_REGISTRY as TOKENS } from '@/lib/tokens';
import { EXPLORER } from '@/lib/walletChain';

export const useOnrampConfig=()=>useQuery({queryKey:['onramp-config'],queryFn:getOnrampConfig,staleTime:300000,retry:1});
const STATE_TEXT={waiting:'Waiting for your purchase',delivering:'Bridging to Robinhood Chain',delivered:'Delivered to your account',refunded:'Refunded',failed:'Delivery failed'} as const;

/** Buy USDG or ETH with a card or bank and receive it in this smart account. */
export function AddFundsModal({open,onClose,walletAddress}:{open:boolean;onClose:()=>void;walletAddress:string}) {
 const config=useOnrampConfig(); const cache=useQueryClient();
 const [asset,setAsset]=useState<OnrampAsset>('USDG'); const [amount,setAmount]=useState('100'); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [session,setSession]=useState<OnrampSession|null>(null); const [blocked,setBlocked]=useState(false);
 const assets=config.data?.assets??[]; const route=assets.find(a=>a.asset===asset)??assets[0];
 useEffect(()=>{if(open){setSession(null);setError('');setBlocked(false);}},[open]);
 useEffect(()=>{if(route&&route.asset!==asset)setAsset(route.asset);},[route,asset]);
 const status=useQuery({queryKey:['onramp-session',session?.sessionId],enabled:!!session,refetchInterval:q=>q.state.data?.deliveries.some(d=>d.state==='delivered')?false:10000,queryFn:()=>getOnrampSession(session!.sessionId)});
 const delivered=status.data?.deliveries.some(d=>d.state==='delivered');
 useEffect(()=>{if(delivered)void cache.invalidateQueries({queryKey:['holdings']});},[delivered,cache]);
 const fiat=Number(amount); const validAmount=Number.isFinite(fiat)&&fiat>=20&&fiat<=10000;
 async function start(){if(!route)return;setBusy(true);setError('');setBlocked(false);try{const s=await createOnrampSession(walletAddress,route.asset,validAmount?fiat:undefined);setSession(s);const popup=window.open(s.url,'veilora-add-funds','popup,width=480,height=760');if(!popup)setBlocked(true);}catch(e){setError(e instanceof Error?e.message:'Could not start checkout.');}finally{setBusy(false);}}
 return <Dialog open={open} onOpenChange={v=>{if(!v&&!busy)onClose();}}><DialogContent className="wallet-dialog rule-builder sm:max-w-md"><DialogHeader><DialogTitle>Add funds</DialogTitle><DialogDescription>Buy with a card or bank and receive it straight in this account. No other wallet needed.</DialogDescription></DialogHeader>
  {config.isPending?<div className="review-loading"><Loader2 className="animate-spin" size={18}/>Checking availability…</div>:!assets.length?<p className="wallet-error">Adding funds by card or bank is not available right now. You can still receive assets on Robinhood Chain with your address.</p>:!session?<>
   <div className="builder-segments af-assets" role="radiogroup">{assets.map(a=><button key={a.asset} role="radio" aria-checked={asset===a.asset} className={asset===a.asset?'on':''} onClick={()=>setAsset(a.asset)}><TokenIcon token={TOKENS[a.asset]} size={20}/>{a.asset}</button>)}</div>
   <label className="builder-field"><span>Amount (USD)</span><div className="af-amount"><span>$</span><input inputMode="decimal" aria-label="Amount in US dollars" value={amount} onChange={e=>setAmount(e.target.value.replace(/[^\d.]/g,''))}/></div></label>
   <div className="af-quick">{[50,100,250,500].map(v=><button key={v} className={Number(amount)===v?'on':''} onClick={()=>setAmount(String(v))}>${v}</button>)}</div>
   {!validAmount&&amount!==''&&<p className="builder-hint text-red-500">Enter an amount from $20 to $10,000.</p>}
   <div className="af-route"><div><CreditCard size={16}/><span>Pay with card or bank via {config.data?.provider}</span></div><ArrowRight size={14}/><div><TokenIcon token={TOKENS[route!.asset]} size={16}/><span>{route!.route==='direct'?`${route!.asset} delivered on Robinhood Chain`:`Bought on Base, bridged by Relay to ${route!.asset} on Robinhood Chain`}</span></div></div>
   <ul className="af-points"><li><Fuel size={14}/>No gas to manage. Receiving costs you nothing, and Veilora covers network fees when you use your funds.</li><li><ShieldCheck size={14}/>{route!.route==='direct'?'Delivered to your smart account address.':'Delivered to your smart account automatically, usually within minutes.'} {config.data?.provider} and{route!.route==='relay'?' Relay':''} fees are shown before you pay.</li></ul>
   {config.data?.sandbox&&<p className="builder-hint">Test mode: purchases use {config.data.provider}'s sandbox and no real money.</p>}
   {error&&<p role="alert" className="wallet-error">{error}</p>}
   <button className="wallet-primary-button" disabled={busy||!validAmount} onClick={()=>void start()}>{busy?<><Loader2 size={16} className="animate-spin"/>Opening checkout…</>:`Continue to ${config.data?.provider}`}</button>
   <p className="builder-hint">{config.data?.provider} handles payment and identity checks. Veilora never sees your card or bank details.</p></>:<>
   <div className="af-progress"><span className={`af-step done`}><Check size={13}/></span><div><strong>Checkout opened</strong><small>Finish paying in the {config.data?.provider} window.</small></div></div>
   {blocked&&<a className="wallet-primary-button" href={session.url} target="_blank" rel="noreferrer">Open checkout <ExternalLink size={15}/></a>}
   {session.route==='relay'?<>{(status.data?.deliveries.length?status.data.deliveries:[{requestId:null,state:'waiting' as const,amountOut:null,outTxHash:null,updatedAt:null}]).slice(0,3).map((d,i)=><div key={d.requestId??i} className="af-progress"><span className={`af-step ${d.state==='delivered'?'done':d.state==='failed'||d.state==='refunded'?'bad':'live'}`}>{d.state==='delivered'?<Check size={13}/>:<Loader2 size={13} className={d.state==='failed'||d.state==='refunded'?'':'animate-spin'}/>}</span><div><strong>{STATE_TEXT[d.state]}</strong><small>{d.state==='refunded'?'Relay could not complete the bridge and returned the funds. Contact support with this checkout ID.':d.state==='failed'?'Contact support with this checkout ID; your purchase is recorded.':d.state==='delivered'?'Your balance will update in a moment.':'This updates on its own. You can close this window.'}</small>{d.outTxHash&&<a href={`${EXPLORER}/tx/${d.outTxHash}`} target="_blank" rel="noreferrer">View delivery <ExternalLink size={11}/></a>}</div></div>)}</>:<div className="af-progress"><span className="af-step live"><Loader2 size={13} className="animate-spin"/></span><div><strong>Waiting for {config.data?.provider} to deliver</strong><small>{status.data?.note??'Your balance updates when it lands.'}</small></div></div>}
   <p className="builder-hint">Checkout ID {session.sessionId.slice(0,8)}</p>
   <div className="review-actions"><button className="rule-button" onClick={()=>void status.refetch()}><RefreshCw size={14}/>Refresh</button><button className="wallet-primary-button" onClick={onClose}>{delivered?'Done':'Close, keep tracking'}</button></div></>}
 </DialogContent></Dialog>;
}
