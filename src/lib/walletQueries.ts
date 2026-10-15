import { useQuery } from '@tanstack/react-query';
import { getAddress, formatUnits } from 'viem';
import { useWallet } from './walletContext';
import { readHoldings, quoteSwap } from './walletChain';
import { ROBINHOOD_TOKEN_REGISTRY } from './tokens';
import { API_BASE } from './api';
import { getRpcOverride } from './rpcSettings';
/** Balances for your wallet, or for another address (watch-only) when one is given. */
export function useHoldings(address?: string) {
 const {walletAddress:own} = useWallet(); const walletAddress=address ?? own;
 return useQuery({queryKey:['holdings',walletAddress,getRpcOverride() || 'veilora-gateway'],queryFn:()=>readHoldings(getAddress(walletAddress)),enabled:!!walletAddress,refetchInterval:30000});
}
export function usePortfolioValue(address?: string) {
 const holdings=useHoldings(address);
 const key=holdings.data?.map(h=>`${h.token.symbol}:${h.raw}`).join('|');
 const prices=useQuery({queryKey:['portfolio-value',key],enabled:!!holdings.data,staleTime:30000,queryFn:async()=> {
  const values=await Promise.all((holdings.data ?? []).map(async h=> {
   if(h.raw === null) return null;
   if(h.raw === 0n) return 0;
   if(h.token.symbol==='USDG') return Number(formatUnits(h.raw,6));
   try { const q=await quoteSwap(h.token,ROBINHOOD_TOKEN_REGISTRY.USDG,h.raw,50); return Number(formatUnits(q.amountOut,6)); } catch {return null;}
  }));
  return {total:values.reduce<number>((sum,value)=>sum+(value ?? 0),0),partial:values.includes(null)};
 }});
 return {holdings,prices};
}
export type WalletTransaction={id:string;hash:string;timestamp:string;direction:'sent'|'received'|'contract';symbol:string;amount:string;from:string;to:string;status:'confirmed'|'failed'|'pending'};
type ExplorerItem={hash?:string;transaction_hash?:string;timestamp?:string;from?:{hash?:string};to?:{hash?:string};value?:string;status?:string;result?:string;error?:string|null;success?:boolean;index?:number;log_index?:number;total?:{value?:string;decimals?:string};token?:{symbol?:string;decimals?:string}};
/** History rows; `partial` is set when some history types could not be loaded and the list is incomplete. */
export type TransactionList=WalletTransaction[]&{partial?:boolean};
export function useTransactions(address?: string) {
 const {walletAddress:own}=useWallet(); const walletAddress=address ?? own;
 return useQuery({queryKey:['transactions',walletAddress],enabled:!!walletAddress,staleTime:30000,retry:1,structuralSharing:false,queryFn:async({signal}):Promise<TransactionList>=> {
  const wallet=walletAddress.toLowerCase();
  const loadKind=async(kind:string)=> {
   let cursor: Record<string,string> | null=null;
   const result: WalletTransaction[]=[];
   const seen=new Set<string>();
   do {
    const params: URLSearchParams=new URLSearchParams({kind,...(cursor ? {cursor:JSON.stringify(cursor)} : {})});
    const response: Response=await fetch(`${API_BASE}/v1/wallets/${walletAddress}/transactions?${params}`,{signal});
    const body: {items: ExplorerItem[];next_page_params: Record<string,string>|null;error?:string}=await response.json();
    if(!response.ok) throw new Error(body.error || 'Transaction history is temporarily unavailable.');
    for(const [i,item] of (body.items as ExplorerItem[]).entries()) {
     const from=item.from?.hash ?? ''; const to=item.to?.hash ?? '';
     const hash=item.transaction_hash || item.hash || '';
     if(!hash) continue;
     const raw=item.total?.value ?? item.value ?? '0';
     if(kind==='internal-transactions' && raw==='0') continue;
     const direction=from.toLowerCase()===wallet ? 'sent' : to.toLowerCase()===wallet ? 'received' : 'contract';
     result.push({id:`${kind}:${hash}:${item.log_index ?? item.index ?? i}`,hash,from,to,timestamp:item.timestamp ?? '',direction:kind==='transactions' && raw==='0' ? 'contract' : direction,symbol:item.token?.symbol || 'ETH',amount:formatUnits(BigInt(raw),Number(item.total?.decimals ?? item.token?.decimals ?? 18)),status:item.status==='error'||item.result==='error'||item.error||item.success===false ? 'failed' : item.timestamp ? 'confirmed' : 'pending'});
    }
    cursor=body.next_page_params;
    if(cursor) {const key=JSON.stringify(cursor); if(seen.has(key)) throw new Error('History pagination stalled. Please refresh.'); seen.add(key);}
   } while(cursor && !signal.aborted);
   return result;
  };
  // One explorer hiccup should not blank the whole list: retry a failed type once, then show what loaded.
  const kinds=['transactions','token-transfers','internal-transactions'];
  const settled=await Promise.all(kinds.map(async kind=>{try{return await loadKind(kind);}catch{if(signal.aborted)return null;await new Promise(r=>setTimeout(r,1500));try{return await loadKind(kind);}catch{return null;}}}));
  const loaded=settled.filter((rows):rows is WalletTransaction[]=>rows!==null);
  if(!loaded.length) throw new Error('Transaction history is temporarily unavailable. Your transactions are still on-chain.');
  const list:TransactionList=loaded.flat().sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp));
  list.partial=loaded.length<kinds.length;
  return list;
 }});
}
