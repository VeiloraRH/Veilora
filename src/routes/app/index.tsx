import { createFileRoute, Link } from '@tanstack/react-router';
import { Private } from '@/components/wallet/Private';
import { togglePrivacyMode, usePrivacyMode } from '@/lib/privacyMode';
import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Plus, Eye, EyeOff, RefreshCw, ArrowRight, Wallet } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@/lib/walletContext';
import { usePortfolioValue, useTransactions } from '@/lib/walletQueries';
import { PortfolioChange } from '@/components/wallet/PortfolioChange';
import { PageTitle, TransactionsTable } from '@/components/wallet/WalletUI';
import { DepositModal } from '@/components/app/DepositModal';
import { AddFundsModal, useOnrampConfig } from '@/components/app/AddFundsModal';
import { SendModal } from '@/components/dashboard/SendModal';
import { CompletionDialog, type CompletionNotice } from '@/components/app/CompletionDialog';
import { WalletHealthCard } from '@/components/app/WalletHealthCard';
export const Route=createFileRoute('/app/')({component:CommandCenter});
export function CommandCenter() {
 const {walletAddress}=useWallet(); const {holdings,prices}=usePortfolioValue(); const activity=useTransactions(); const cache=useQueryClient();
 const onramp=useOnrampConfig(); const [addFunds,setAddFunds]=useState(false);
 const masked=usePrivacyMode();const [receive,setReceive]=useState(false); const [send,setSend]=useState(false);const [completion,setCompletion]=useState<CompletionNotice|null>(null);
 const balance=(symbol:string)=>{const h=holdings.data?.find(h=>h.token.symbol===symbol);return h?.raw != null ? Number(h.raw)/10**h.token.decimals : 0;};
 return <><PageTitle title="Dashboard" description="A little clarity for your everyday money." action={<button className="wallet-icon-button" aria-label="Refresh wallet" onClick={()=>{void holdings.refetch();void activity.refetch();}}><RefreshCw size={18} className={holdings.isFetching?'animate-spin':''}/></button>}/>
 <div className="wallet-dashboard-grid"><section className="wallet-activity-section"><div className="wallet-section-heading"><h2>Recent activity</h2><Link to="/app/activity">View all <ArrowUpRight size={16}/></Link></div><div className="wallet-panel wallet-activity-panel"><TransactionsTable compact records={(activity.data??[]).slice(0,6)} loading={activity.isPending} error={activity.error} onRetry={()=>void activity.refetch()} partial={!!activity.data?.partial}/></div><div className="wallet-quiet-link"><span>Make your next move.</span><Link to="/app/market" search={{q:""}}>Explore assets <ArrowRight size={16}/></Link></div><WalletHealthCard /></section>
 <section className="wallet-balance-card" aria-label="Wallet balance"><div className="wallet-art" aria-hidden="true"><div className="wallet-art-card"><span/><i/></div><div className="wallet-art-body"><div className="wallet-art-seam"/><div className="wallet-art-clasp"><i/></div><Wallet size={26}/></div><span className="wallet-art-dot"/></div><div className="wallet-balance-label">Total balance<button className="wallet-icon-button" aria-label={masked?'Show balance':'Hide balance'} onClick={togglePrivacyMode}>{masked?<EyeOff size={16}/>:<Eye size={16}/>}</button></div><h2 className="wallet-balance-value">{masked?<Private mask='••••••'>{holdings.isPending||prices.isPending?'—':holdings.isError?'Unavailable':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(prices.data?.total??0)}</Private>:holdings.isPending||prices.isPending?'—':holdings.isError?'Unavailable':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(prices.data?.total??0)}</h2><p className="wallet-balance-sub">{holdings.isError?'Could not load balances':prices.data?.partial?'Estimated value · some assets unpriced':'Estimated value in USD'}</p><PortfolioChange holdings={holdings.data}/><div className="wallet-actions">{onramp.data?.enabled&&<button onClick={()=>setAddFunds(true)}><span><Plus/></span>Add funds</button>}<button onClick={()=>setSend(true)}><span><ArrowUpRight/></span>Send</button><button onClick={()=>setReceive(true)}><span><ArrowDownLeft/></span>Receive</button><Link to="/app/swap" search={{buy:"NVDA"}}><span><ArrowLeftRight/></span>Swap</Link></div><div className="wallet-balance-foot"><img src="/robinhood-logo.png" alt=""/>Robinhood Chain</div></section></div>
 <AddFundsModal open={addFunds} onClose={()=>setAddFunds(false)} walletAddress={walletAddress}/><DepositModal open={receive} onClose={()=>setReceive(false)} accountAddress={walletAddress}/><SendModal open={send} onClose={()=>setSend(false)} publicUsdg={balance('USDG')} ethBalance={balance('ETH')} onSuccess={message=>{setCompletion({title:'Transfer confirmed',description:message});void cache.invalidateQueries({queryKey:['holdings']});void cache.invalidateQueries({queryKey:['transactions']});}}/><CompletionDialog notice={completion} onClose={()=>setCompletion(null)}/></>;
}
