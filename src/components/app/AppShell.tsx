import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { LayoutDashboard, ChartNoAxesCombined, ArrowLeftRight, Cable, History, Workflow, Search, Moon, Sun, ChevronDown, Copy, ShieldCheck, LogOut, Wallet, Check, Settings2, Eye, EyeOff, Lock, KeyRound, Binoculars, UserPlus } from 'lucide-react';
import { useWallet } from '@/lib/walletContext';
import { useTheme } from '@/lib/theme';
import { togglePrivacyMode, usePrivacyMode } from '@/lib/privacyMode';
import { Logo } from '@/components/ui';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { RemoveWalletModal } from './RemoveWalletModal';
import { AlertsBell } from './AlertsBell';
import { AwayCover } from './AwayCover';
import { useWatchList } from '@/lib/watchList';
import { useStoredAccounts } from '@/lib/deviceAccounts';
import { AccountDialog, type AccountAction } from './AccountDialog';
import { shortAddress } from '@/components/wallet/WalletUI';
import { useWalletRules } from '@/lib/rulesApi';
import { VeilyAssistant } from './VeilyAssistant';
import { InstallAppButton } from './InstallAppButton';
import { BridgeCompletionMonitor } from './BridgeCompletionMonitor';
import { UniversalSearch } from './UniversalSearch';
import '@/components/wallet/wallet.css';
const navigation=[{to:'/app',label:'Dashboard',icon:LayoutDashboard},{to:'/app/market',label:'Market',icon:ChartNoAxesCombined},{to:'/app/swap',label:'Swap',icon:ArrowLeftRight},{to:'/app/bridge',label:'Bridge',icon:Cable},{to:'/app/rules',label:'Rules',icon:Workflow},{to:'/app/activity',label:'History',icon:History},{to:'/app/settings',label:'Settings',icon:Settings2}] as const;
export function AppShell({children}:{children:ReactNode}) {
 const {walletAddress,removeWallet,lockDeviceKey}=useWallet();
 const {theme,toggleTheme}=useTheme(); const privacy=usePrivacyMode(); const watched=useWatchList(walletAddress); const otherAccounts=useStoredAccounts(); const [accountAction,setAccountAction]=useState<AccountAction>(null);
 const path=useRouterState({select:s=>s.location.pathname});
 const navigate=useNavigate();
 const rules=useWalletRules(); const pendingRuns=(rules.data?.executions??[]).filter(e=>e.status==='pending').length;
 const [universalSearchOpen,setUniversalSearchOpen]=useState(false); const [disconnect,setDisconnect]=useState(false); const [copied,setCopied]=useState(false);
 const nav=<>{navigation.map(item=>{const active=item.to==='/app' ? /^\/app\/?$/.test(path) : path.startsWith(item.to);return <Link key={item.to} to={item.to} activeOptions={{exact:true}} search={item.to === "/app/market" ? {q:""} : item.to === "/app/swap" ? {buy:"NVDA"} : {}} className={`wallet-nav-link ${active?'active':''}`} aria-current={active?'page':undefined}><item.icon size={21}/><span>{item.label}</span>{item.to==='/app/rules'&&pendingRuns>0&&<b className="wallet-nav-badge" aria-label={`${pendingRuns} waiting for approval`}>{pendingRuns}</b>}</Link>})}</>;
 return <div className="wallet-app"><AwayCover/><div className="wallet-frame">
  <aside className="wallet-sidebar"><Link to="/app" className="wallet-brand"><Logo size={36}/></Link><nav aria-label="Main navigation">{nav}</nav><div className="wallet-sidebar-bottom"><div className="wallet-network"><img src="/robinhood-logo.png" alt=""/><div><strong>Robinhood Chain</strong><span>Mainnet</span></div></div><button className="wallet-theme" onClick={toggleTheme} aria-label={theme==='dark'?'Switch to light mode':'Switch to dark mode'}>{theme==='dark'?<Moon size={18}/>:<Sun size={18}/>}<span>Dark mode</span><span className={`wallet-toggle ${theme==='dark'?'on':''}`}/></button><p className="wallet-sidebar-note">Your assets. Your control.</p></div></aside>
  <div className="wallet-workspace"><header className="wallet-header"><Link to="/app" className="wallet-mobile-brand"><Logo size={28} wordmark={false}/></Link><button type="button" className="wallet-search universal-search-trigger" aria-label="Open Universal Search" onClick={()=>setUniversalSearchOpen(true)}><Search size={20}/><span>Universal Search</span><kbd>⌘ K</kbd></button><InstallAppButton/><button className="wallet-icon-button wallet-mobile-theme" onClick={toggleTheme} aria-label="Toggle theme">{theme==='dark'?<Sun size={18}/>:<Moon size={18}/>}</button><AlertsBell/><button className={`wallet-icon-button wallet-privacy-toggle ${privacy?'on':''}`} onClick={togglePrivacyMode} aria-pressed={privacy} aria-label={privacy?'Show balances':'Hide balances (privacy mode)'} title={privacy?'Privacy mode on: balances hidden':'Hide balances'}>{privacy?<EyeOff size={18}/>:<Eye size={18}/>}</button><DropdownMenu><DropdownMenuTrigger asChild><button className="wallet-account"><span className="wallet-account-icon"><Wallet size={19}/></span><span>{shortAddress(walletAddress)}</span><ChevronDown size={15}/></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="min-w-56 rounded-2xl p-2"><DropdownMenuItem onSelect={()=>{void navigator.clipboard.writeText(walletAddress).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});}}>{copied?<Check/>:<Copy/>}{copied?'Copied address':'Copy wallet address'}</DropdownMenuItem><DropdownMenuItem onSelect={()=>void navigate({to:'/app/security'})}><ShieldCheck/>Quorum & recovery</DropdownMenuItem><DropdownMenuItem onSelect={()=>void navigate({to:'/app/approvals'})}><KeyRound/>Token approvals</DropdownMenuItem><DropdownMenuSeparator/>{otherAccounts.map(a=><DropdownMenuItem key={a.address} onSelect={()=>setAccountAction({kind:'switch',address:a.address})}><Wallet/>Switch to {shortAddress(a.address)}</DropdownMenuItem>)}<DropdownMenuItem onSelect={()=>setAccountAction({kind:'add'})}><UserPlus/>Add another account</DropdownMenuItem><DropdownMenuSeparator/>{watched.slice(0,5).map(w=><DropdownMenuItem key={w.id} onSelect={()=>void navigate({to:'/app/watch',search:{address:w.address}})}><Binoculars/><span className="flex-1 truncate">{w.name}</span><span className="text-[10px] text-[var(--w-muted)]">{shortAddress(w.address)}</span></DropdownMenuItem>)}<DropdownMenuItem onSelect={()=>void navigate({to:'/app/watch',search:{address:''}})}><Binoculars/>{watched.length?'All watched addresses':'Watch an address'}</DropdownMenuItem><DropdownMenuItem onSelect={()=>lockDeviceKey('manual')}><Lock/>Lock wallet</DropdownMenuItem><DropdownMenuSeparator/><DropdownMenuItem className="text-red-600" onSelect={()=>setDisconnect(true)}><LogOut/>Delete data & disconnect</DropdownMenuItem></DropdownMenuContent></DropdownMenu></header><main className="wallet-main">{children}</main></div>
  <nav className="wallet-mobile-nav" aria-label="Mobile navigation">{nav}</nav>
 </div><UniversalSearch open={universalSearchOpen} onOpenChange={setUniversalSearchOpen}/><BridgeCompletionMonitor enabled={path !== '/app/bridge'}/><AccountDialog action={accountAction} onClose={()=>setAccountAction(null)}/><RemoveWalletModal open={disconnect} onClose={()=>setDisconnect(false)} onConfirm={removeWallet} walletAddress={walletAddress}/><VeilyAssistant/></div>;
}
