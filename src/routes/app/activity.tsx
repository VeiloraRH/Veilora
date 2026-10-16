import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, Download } from 'lucide-react';
import { useTransactions, type WalletTransaction } from '@/lib/walletQueries';
import { loadBridgeRecords, bridgeTrackingChangedEvent } from '@/lib/bridgeTracking';
import { useWallet } from '@/lib/walletContext';
import { EXPLORER } from '@/lib/walletChain';
import { PageTitle, TransactionsTable } from '@/components/wallet/WalletUI';
import type { BridgeRecord } from '@/lib/bridgeTracking';

export const Route=createFileRoute('/app/activity')({component:ActivityScreen});

function bridgeStatus(status:string):Pick<WalletTransaction,'status'> & {label:string} {
 const normalized=status.toLowerCase();
 if(['success','completed'].includes(normalized))return {status:'confirmed',label:'Confirmed'};
 if(['failure','failed','refund','refunded','rejected','expired'].includes(normalized))return {status:'failed',label:normalized==='refund'||normalized==='refunded'?'Refunded':normalized==='expired'?'Expired':normalized==='rejected'?'Rejected':'Failed'};
 return {status:'pending',label:normalized==='action_required'?'Needs action':normalized==='check_required'?'Check status':normalized==='preparing'?'Preparing':normalized==='submitting'?'Submitting':normalized==='approving'?'Approving':normalized||'Pending'};
}

function toBridgeActivity(record:BridgeRecord,chainTransactions:WalletTransaction[]):WalletTransaction {
 const sourceTx=record.sourceHash?chainTransactions.find(tx=>tx.hash.toLowerCase()===record.sourceHash?.toLowerCase()):undefined;
 const state=bridgeStatus(record.status);
 return {
  id:`bridge:${record.requestId}`,hash:record.sourceHash||'',timestamp:record.createdAt||sourceTx?.timestamp||record.updatedAt||'',
  direction:'sent',symbol:record.sourceSymbol,amount:record.amount,from:sourceTx?.from||'',to:record.recipient,status:state.status,kind:'bridge',
  bridge:{chainName:record.chainName,explorer:record.explorer,requestId:record.requestId,outputSymbol:record.outputSymbol,outputAmount:record.outputAmount,sourceHash:record.sourceHash,destinationHashes:record.destinationHashes,error:record.error,statusLabel:state.label},
 };
}

function ActivityScreen() {
 const {walletAddress}=useWallet();const history=useTransactions();
 const [bridgeRecords,setBridgeRecords]=useState<BridgeRecord[]>([]);
 const [search,setSearch]=useState('');const [type,setType]=useState('all');const [status,setStatus]=useState('all');const [period,setPeriod]=useState('all');const [page,setPage]=useState(1);
 useEffect(()=>{
  const refresh=()=>setBridgeRecords(loadBridgeRecords(walletAddress));
  refresh();
  const changed=(event:Event)=>{const owner=(event as CustomEvent<{wallet?:string}>).detail?.wallet;if(!owner||owner===walletAddress.toLowerCase())refresh();};
  window.addEventListener(bridgeTrackingChangedEvent,changed);window.addEventListener('storage',changed);
  return()=>{window.removeEventListener(bridgeTrackingChangedEvent,changed);window.removeEventListener('storage',changed);};
 },[walletAddress]);

 const transactions=history.data??[];
 const bridges=useMemo(()=>bridgeRecords.map(record=>toBridgeActivity(record,transactions)),[bridgeRecords,transactions]);
 const rows=useMemo(()=>{
  const bridgeHashes=new Set(bridges.flatMap(record=>record.bridge?.sourceHash?[record.bridge.sourceHash.toLowerCase()]:[]));
  const combined=[...transactions.filter(tx=>!bridgeHashes.has(tx.hash.toLowerCase())),...bridges].sort((a,b)=>{
   const aTime=Date.parse(a.timestamp)||0,bTime=Date.parse(b.timestamp)||0;return bTime-aTime;
  });
  const query=search.trim().toLowerCase();const cutoff=period==='all'?0:Date.now()-Number(period)*86400000;
  return combined.filter(tx=>{
   const matchesType=type==='all'||(type==='bridge'?tx.kind==='bridge':tx.kind!=='bridge'&&tx.direction===type);
   const matchesStatus=status==='all'||tx.status===status;
   const parsed=Date.parse(tx.timestamp);const matchesPeriod=cutoff===0||(Number.isFinite(parsed)&&parsed>=cutoff);
   const searchable=[tx.hash,tx.from,tx.to,tx.symbol,tx.direction,tx.bridge?.chainName,tx.bridge?.outputSymbol,tx.bridge?.outputAmount,tx.bridge?.requestId,tx.bridge?.sourceHash,...(tx.bridge?.destinationHashes??[]),tx.bridge?.error].filter(Boolean).join(' ').toLowerCase();
   return matchesType&&matchesStatus&&matchesPeriod&&(!query||searchable.includes(query));
  });
 },[transactions,bridges,type,status,period,search]);
 const pages=Math.max(1,Math.ceil(rows.length/15));const current=Math.min(page,pages);

 const exportCsv=()=>{
  const columns=['Date','Type','Asset sent','Amount sent','Destination chain','Asset received','Amount received','Status','From','To','Source transaction','Destination transactions','Explorer links','Bridge request ID','Details'];
  const safeCell=(value:unknown)=>{const text=String(value??'');const safe=/^[\s]*[=+@\-\t\r]/.test(text)?`'${text}`:text;return `"${safe.replace(/"/g,'""')}"`;};
  const csv=[columns,...rows.map(tx=>tx.kind==='bridge'?[tx.timestamp,'bridge',tx.symbol,tx.amount,tx.bridge?.chainName,tx.bridge?.outputSymbol,tx.bridge?.outputAmount,tx.bridge?.statusLabel,tx.from,tx.to,tx.bridge?.sourceHash,tx.bridge?.destinationHashes.join(' | '),[tx.bridge?.sourceHash?`${EXPLORER}/tx/${tx.bridge.sourceHash}`:'',...(tx.bridge?.destinationHashes??[]).map(hash=>`${tx.bridge!.explorer}/tx/${hash}`)].filter(Boolean).join(' | '),tx.bridge?.requestId,tx.bridge?.error]:[tx.timestamp,tx.direction,tx.symbol,tx.amount,'','','',tx.status,tx.from,tx.to,tx.hash,'',`${EXPLORER}/tx/${tx.hash}`,'',''])].map(row=>row.map(safeCell).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob(['\uFEFF',csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`veilora-activity-${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };

 const explorerError=!!history.error;
 return <><PageTitle title="Transaction history" description="Wallet activity and cross-chain bridges, together." action={<div className="flex gap-2"><button className="wallet-icon-button" aria-label="Refresh history" onClick={()=>void history.refetch()}><RefreshCw size={18} className={history.isFetching?'animate-spin':''}/></button><button className="wallet-soft-button" disabled={!rows.length} onClick={exportCsv}><Download size={15}/>Export CSV</button></div>}/>
 <div className="wallet-toolbar"><div className="wallet-search"><Search size={18}/><input aria-label="Search activity" placeholder="Search asset, address, chain or transaction hash" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/></div><select className="wallet-select" aria-label="Activity type" value={type} onChange={e=>{setType(e.target.value);setPage(1);}}><option value="all">All activity</option><option value="sent">Sent</option><option value="received">Received</option><option value="contract">Contract</option><option value="bridge">Bridges</option></select><select className="wallet-select" aria-label="Activity status" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="all">All statuses</option><option value="confirmed">Confirmed</option><option value="pending">Pending</option><option value="failed">Failed or refunded</option></select><select className="wallet-select" aria-label="Time period" value={period} onChange={e=>{setPeriod(e.target.value);setPage(1);}}><option value="all">All time</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="365">Last year</option></select></div>
 {explorerError&&bridges.length>0&&<p className="wallet-error mb-4" role="status">Explorer history is unavailable right now. Your locally tracked bridge activity is still shown.</p>}
 <div className="wallet-panel"><TransactionsTable records={rows.slice((current-1)*15,current*15)} loading={history.isPending&&!bridges.length} error={bridges.length?undefined:history.error} onRetry={()=>void history.refetch()} partial={!!history.data?.partial||explorerError}/></div>
 {!history.isPending&&(!history.error||bridges.length>0)&&<div className="mt-5 flex items-center justify-between"><span className="wallet-count">{rows.length} activities · bridge details are stored on this device</span>{pages>1&&<div className="flex items-center gap-3 text-xs"><button className="wallet-soft-button" disabled={current===1} onClick={()=>setPage(current-1)}>Previous</button>{current} / {pages}<button className="wallet-soft-button" disabled={current===pages} onClick={()=>setPage(current+1)}>Next</button></div>}</div>}</>;
}
