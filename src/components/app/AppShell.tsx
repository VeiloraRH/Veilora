import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { LayoutDashboard, ChartNoAxesCombined, ArrowLeftRight, Cable, History, Workflow, Search, Moon, Sun, ChevronDown, Copy, ShieldCheck, LogOut, Wallet, Check } from 'lucide-react';
import { useWallet } from '@/lib/walletContext';
import { useTheme } from '@/lib/theme';
import { Logo } from '@/components/ui';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { RemoveWalletModal } from './RemoveWalletModal';
import { shortAddress } from '@/components/wallet/WalletUI';
import { useWalletRules } from '@/lib/rulesApi';
import { VeilyAssistant } from './VeilyAssistant';
import { InstallAppButton } from './InstallAppButton';
import '@/components/wallet/wallet.css';
const navigation=[{to:'/app',label:'Dashboard',icon:LayoutDashboard},{to:'/app/market',label:'Market',icon:ChartNoAxesCombined},{to:'/app/swap',label:'Swap',icon:ArrowLeftRight},{to:'/app/bridge',label:'Bridge',icon:Cable},{to:'/app/rules',label:'Rules',icon:Workflow},{to:'/app/activity',label:'History',icon:History}] as const;
export function AppShell({children}:{children:ReactNode}) {
 const {walletAddress,removeWallet}=useWallet();
 const {theme,toggleTheme}=useTheme();
 const path=useRouterState({select:s=>s.location.pathname});
 const navigate=useNavigate();
 const rules=useWalletRules(); const pendingRuns=(rules.data?.executions??[]).filter(e=>e.status==='pending').length;
 const [search,setSearch]=useState(''); const [disconnect,setDisconnect]=useState(false); const [copied,setCopied]=useState(false);
 const nav=<>{navigation.map(item=>{const active=item.to==='/app' ? /^\/app\/?$/.test(path) : path.startsWith(item.to);return <Link key={item.to} to={item.to} activeOptions={{exact:true}} search={item.to === "/app/market" ? {q:""} : item.to === "/app/swap" ? {buy:"NVDA"} : {}} className={`wallet-nav-link ${active?'active':''}`} aria-current={active?'page':undefined}><item.icon size={21}/><span>{item.label}</span>{item.to==='/app/rules'&&pendingRuns>0&&<b className="wallet-nav-badge" aria-label={`${pendingRuns} waiting for approval`}>{pendingRuns}</b>}</Link>})}</>;
 return <div className="wallet-app"><div className="wallet-frame">
  <aside className="wallet-sidebar"><Link to="/app" className="wallet-brand"><Logo size={36}/></Link><nav aria-label="Main navigation">{nav}</nav><div className="wallet-sidebar-bottom"><div className="wallet-network"><img src="/robinhood-logo.png" alt=""/><div><strong>Robinhood Chain</strong><span>Mainnet</span></div></div><button className="wallet-theme" onClick={toggleTheme} aria-label={theme==='dark'?'Switch to light mode':'Switch to dark mode'}>{theme==='dark'?<Moon size={18}/>:<Sun size={18}/>}<span>Dark mode</span><span className={`wallet-toggle ${theme==='dark'?'on':''}`}/></button><p className="wallet-sidebar-note">Your assets. Your control.</p></div></aside>
  <div className="wallet-workspace"><header className="wallet-header"><Link to="/app" className="wallet-mobile-brand"><Logo size={28} wordmark={false}/></Link><form className="wallet-search" onSubmit={e=>{e.preventDefault();void navigate({to:'/app/market',search:{q:search}});}}><Search size={20}/><input aria-label="Search tokens" placeholder="Search tokens or assets" value={search} onChange={e=>setSearch(e.target.value)}/><kbd>↵</kbd></form><InstallAppButton/><button className="wallet-icon-button wallet-mobile-theme" onClick={toggleTheme} aria-label="Toggle theme">{theme==='dark'?<Sun size={18}/>:<Moon size={18}/>}</button><DropdownMenu><DropdownMenuTrigger asChild><button className="wallet-account"><span className="wallet-account-icon"><Wallet size={19}/></span><span>{shortAddress(walletAddress)}</span><ChevronDown size={15}/></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="min-w-56 rounded-2xl p-2"><DropdownMenuItem onSelect={()=>{void navigator.clipboard.writeText(walletAddress).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});}}>{copied?<Check/>:<Copy/>}{copied?'Copied address':'Copy wallet address'}</DropdownMenuItem><DropdownMenuItem onSelect={()=>void navigate({to:'/app/security'})}><ShieldCheck/>Quorum & recovery</DropdownMenuItem><DropdownMenuSeparator/><DropdownMenuItem className="text-red-600" onSelect={()=>setDisconnect(true)}><LogOut/>Delete data & disconnect</DropdownMenuItem></DropdownMenuContent></DropdownMenu></header><main className="wallet-main">{children}</main></div>
  <nav className="wallet-mobile-nav" aria-label="Mobile navigation">{nav}</nav>
 </div><RemoveWalletModal open={disconnect} onClose={()=>setDisconnect(false)} onConfirm={removeWallet} walletAddress={walletAddress}/><VeilyAssistant/></div>;
}
