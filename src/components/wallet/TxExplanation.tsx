import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, ExternalLink, Info, KeyRound, Loader2, ShieldAlert, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { explainCalls, explainTransaction, type ExplainFlag, type TxExplanation } from '@/lib/api';
import { EXPLORER, type PlannedCall } from '@/lib/walletChain';

const FLAG_ICON={danger:ShieldAlert,warn:AlertTriangle,info:Info} as const;
const short=(a:string)=>`${a.slice(0,6)}…${a.slice(-4)}`;
export function Flags({flags}:{flags:ExplainFlag[]}) {
 const sorted=[...flags].sort((a,b)=>['danger','warn','info'].indexOf(a.level)-['danger','warn','info'].indexOf(b.level));
 return sorted.length?<ul className="tx-flags">{sorted.map(f=>{const Icon=FLAG_ICON[f.level];return <li key={f.code+f.text} className={f.level}><Icon size={14}/><span>{f.text}</span></li>;})}</ul>:null;
}

/** One decoded transaction: what it does, what moves, and anything unusual. */
export function ExplanationCard({e,step}:{e:TxExplanation;step?:string}) {
 return <div className="tx-explain">{step&&<span className="tx-step">{step}</span>}<strong className="tx-title">{e.title}</strong>
  <ul className="tx-summary">{e.summary.map(s=><li key={s}>{s}</li>)}</ul>
  {e.effects.length>0&&<div className="tx-effects">{e.effects.map((x,i)=>{const Icon=x.direction==='in'?ArrowDownLeft:x.direction==='out'?ArrowUpRight:KeyRound;return <div key={i} className={`tx-effect ${x.direction}`}><Icon size={14}/><span>{x.direction==='in'?'You receive':x.direction==='out'?'You send':'Permission'}</span><b>{x.amount?`${x.direction==='out'?'−':x.direction==='in'?'+':''}${x.amount} ${x.asset}`:x.asset}</b>{x.counterparty&&<small>{short(x.counterparty)}</small>}</div>;})}</div>}
  <Flags flags={e.flags}/></div>;
}

/** "What you're signing" for calls that have not been signed yet. */
export function SignPreview({wallet,calls}:{wallet:string;calls:PlannedCall[]}) {
 const key=calls.map(c=>`${c.target}:${c.value}:${c.data}`).join('|');
 const q=useQuery({queryKey:['explain-calls',wallet,key],enabled:!!wallet&&calls.length>0,staleTime:60000,retry:1,queryFn:()=>explainCalls(wallet,calls)});
 if(!calls.length) return null;
 return <section className={`tx-preview ${q.data?.level??''}`} aria-label="What you're signing"><div className="tx-preview-head"><Sparkles size={14}/>What you're signing{q.data&&calls.length>1&&<span>{calls.length} transactions</span>}</div>
  {q.isPending?<div className="tx-loading"><Loader2 size={14} className="animate-spin"/>Reading the transaction…</div>:q.isError?<p className="tx-muted">The explanation is unavailable right now. Review the details above before signing.</p>:q.data!.explanations.map((e,i)=><ExplanationCard key={i} e={e} step={calls.length>1?`Step ${i+1}`:undefined}/>)}</section>;
}

/** Explain a mined transaction from this wallet's point of view. */
export function TxExplainDialog({wallet,hash,onClose}:{wallet:string;hash:string;onClose:()=>void}) {
 const q=useQuery({queryKey:['explain-tx',wallet,hash],staleTime:Infinity,retry:1,queryFn:()=>explainTransaction(wallet,hash)});
 return <Dialog open onOpenChange={v=>{if(!v)onClose();}}><DialogContent className="wallet-dialog sm:max-w-md"><DialogHeader><DialogTitle>What happened</DialogTitle><DialogDescription>Decoded from Robinhood Chain, from your account's point of view.</DialogDescription></DialogHeader>
  {q.isPending?<div className="tx-loading"><Loader2 size={16} className="animate-spin"/>Reading the transaction…</div>:q.isError?<p className="wallet-error">{q.error instanceof Error?q.error.message:'This transaction could not be explained.'}</p>:<>
   <ExplanationCard e={q.data!}/>
   <div className="send-review"><div><span>Status</span><strong>{q.data!.status==='reverted'?'Failed':'Confirmed'}</strong></div><div><span>Network fee</span><strong>{q.data!.gasPaidBy==='relayer'?'Paid by Veilora’s relayer':q.data!.gasPaidBy==='you'?`${Number(q.data!.feeEth??0).toPrecision(2)} ETH from you`:'Paid by the sender'}</strong></div></div></>}
  <a className="tx-explorer" href={`${EXPLORER}/tx/${hash}`} target="_blank" rel="noreferrer">View on explorer <ExternalLink size={13}/></a></DialogContent></Dialog>;
}
