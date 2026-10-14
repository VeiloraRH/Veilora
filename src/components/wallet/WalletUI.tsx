import { useState, type ReactNode } from 'react';
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, ExternalLink, RefreshCw, SearchX, Sparkles } from 'lucide-react';
import { EXPLORER } from '@/lib/walletChain';
import { ROBINHOOD_TOKEN_REGISTRY, type WalletToken } from '@/lib/tokens';
import type { WalletTransaction } from '@/lib/walletQueries';
import { useWallet } from '@/lib/walletContext';
import { TxExplainDialog } from './TxExplanation';
export const shortAddress=(address:string)=>`${address.slice(0,6)}…${address.slice(-4)}`;
export function TokenIcon({token,size=40}:{token:WalletToken;size?:number}) {
 const [failed,setFailed]=useState(false);
 return <span className="token-icon" style={{width:size,height:size}}>{!failed ? <img src={token.logo} alt="" onError={()=>setFailed(true)} /> : token.symbol.slice(0,2)}</span>;
}
export function PageTitle({title,description,action}:{title:string;description:string;action?:ReactNode}) {
 return <div className="wallet-page-title"><div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}
export function TransactionsTable({records,loading,error,onRetry,compact=false}:{records:WalletTransaction[];loading:boolean;error:unknown;onRetry:()=>void;compact?:boolean}) {
 const {walletAddress}=useWallet(); const [explain,setExplain]=useState<string|null>(null);
 if(loading) return <div className="wallet-empty" role="status"><RefreshCw className="animate-spin"/><h3>Loading transactions</h3><p>Gathering your on-chain activity.</p></div>;
 if(error) return <div className="wallet-empty"><SearchX/><h3>History is unavailable</h3><p>{error instanceof Error ? error.message : 'Please try again.'}</p><button className="wallet-soft-button" onClick={onRetry}><RefreshCw size={15}/>Try again</button></div>;
 if(!records.length) return <div className="wallet-empty"><span className="wallet-empty-icon"><ArrowLeftRight/></span><h3>{compact?'Your story starts here':'No transactions found'}</h3><p>{compact?'Send or receive assets and your activity will appear here.':'Your on-chain transactions will appear here. Try changing your filters.'}</p></div>;
 return <div className="wallet-table-scroll">{explain&&<TxExplainDialog wallet={walletAddress} hash={explain} onClose={()=>setExplain(null)}/>}<table className="wallet-table"><thead><tr><th>Transaction</th><th>Date</th><th>Amount</th><th>Status</th><th><span className="sr-only">Explorer</span></th></tr></thead><tbody>{records.map(tx=>{
 const Icon=tx.direction==='received'?ArrowDownLeft:tx.direction==='sent'?ArrowUpRight:ArrowLeftRight;
 const token=ROBINHOOD_TOKEN_REGISTRY[tx.symbol];
 return <tr key={tx.id}><td><div className="wallet-cell"><span className={`tx-icon ${tx.direction}`}><Icon size={18}/></span><div><strong>{tx.direction==='received'?'Received':tx.direction==='sent'?'Sent':'Contract interaction'}</strong><small>{tx.direction==='contract'?shortAddress(tx.hash):`${tx.symbol} · ${shortAddress(tx.direction==='received'?tx.from:tx.to)}`}</small></div></div></td><td className="whitespace-nowrap">{tx.timestamp?new Date(tx.timestamp).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'Pending'}</td><td className="whitespace-nowrap"><span className={tx.direction==='received'?'wallet-positive':''}>{tx.direction==='received'?'+':tx.direction==='sent'?'−':''}{Number(tx.amount).toLocaleString(undefined,{maximumFractionDigits:6})} {token?.symbol || tx.symbol}</span></td><td><span className={`wallet-status ${tx.status}`}>{tx.status}</span></td><td className="whitespace-nowrap"><button className="wallet-icon-button" onClick={()=>setExplain(tx.hash)} aria-label="Explain this transaction" title="What happened?"><Sparkles size={15}/></button><a className="wallet-icon-button" href={`${EXPLORER}/tx/${tx.hash}`} target="_blank" rel="noreferrer" aria-label="View transaction in explorer"><ExternalLink size={15}/></a></td></tr>;
 })}</tbody></table></div>;
}
