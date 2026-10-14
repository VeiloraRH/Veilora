import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowDownLeft, Bell, CheckCheck, ExternalLink, Loader2, Plus, ShieldAlert, Target, Trash2, Workflow } from 'lucide-react';
import { formatUnits, type Hex } from 'viem';
import { PageTitle } from '@/components/wallet/WalletUI';
import { useWallet } from '@/lib/walletContext';
import { ROBINHOOD_TOKEN_REGISTRY as TOKENS } from '@/lib/tokens';
import { EXPLORER, quoteSwap } from '@/lib/walletChain';
import { changeAlerts, desktopNotificationsOn, setDesktopNotifications, useAlerts, type AlertItem } from '@/lib/alertsApi';
export const Route=createFileRoute('/app/alerts')({component:AlertsScreen});

const TYPE_ICON={incoming:ArrowDownLeft,price:Target,rule:Workflow,security:ShieldAlert} as const;
const ago=(iso:string)=>{const s=Math.max(1,Math.floor((Date.now()-Date.parse(iso))/1000));return s<60?`${s}s ago`:s<3600?`${Math.floor(s/60)}m ago`:s<86400?`${Math.floor(s/3600)}h ago`:new Date(iso).toLocaleDateString(undefined,{month:'short',day:'numeric'});};

function AlertsScreen() {
 const {walletAddress,getStoredDeviceKey}=useWallet(); const alerts=useAlerts(); const cache=useQueryClient();
 const [busy,setBusy]=useState(''); const [error,setError]=useState(''); const [filter,setFilter]=useState<'all'|AlertItem['type']>('all');
 const [desktop,setDesktop]=useState(desktopNotificationsOn);
 const data=alerts.data; const items=(data?.alerts??[]).filter(a=>filter==='all'||a.type===filter);
 async function act(action:'read-all'|'settings'|'price-add'|'price-remove',payload:string,label:string){const key=getStoredDeviceKey();if(!key){setError('Unlock your device key first.');return false;}setBusy(label);setError('');try{cache.setQueryData(['alerts',walletAddress],await changeAlerts(walletAddress,key as Hex,action,payload));return true;}catch(e){setError(e instanceof Error?e.message:'Could not update alerts.');return false;}finally{setBusy('');}}
 return <><PageTitle title="Alerts" description="Price targets, money coming in, rule runs and anything that touches your account's security." action={data&&data.unread>0?<button className="wallet-soft-button" disabled={!!busy} onClick={()=>void act('read-all','all','read')}><CheckCheck size={15}/>Mark all read</button>:undefined}/>
 {error&&<p role="alert" className="wallet-error mb-5">{error}</p>}
 {alerts.isError&&<p role="alert" className="wallet-error mb-5">{alerts.error instanceof Error?alerts.error.message:'Alerts are unavailable right now.'}</p>}
 <div className="rules-layout"><div className="rules-main"><section>
  <div className="alerts-filters" role="tablist">{(['all','incoming','price','rule','security'] as const).map(f=><button key={f} role="tab" aria-selected={filter===f} className={filter===f?'on':''} onClick={()=>setFilter(f)}>{f==='all'?'All':f==='incoming'?'Incoming':f==='price'?'Prices':f==='rule'?'Rules':'Security'}</button>)}</div>
  {alerts.isPending?<div className="wallet-panel wallet-empty"><Loader2 className="animate-spin"/><h3>Loading alerts</h3></div>
  :!items.length?<div className="wallet-panel wallet-empty"><span className="wallet-empty-icon"><Bell/></span><h3>{filter==='all'?'No alerts yet':'Nothing here yet'}</h3><p>Money coming in, price targets you set, rule runs and security events will show up here.</p></div>
  :<div className="wallet-panel alerts-feed">{items.map(a=>{const Icon=TYPE_ICON[a.type];return <article key={a.id} className={`alert-item ${a.severity} ${a.read?'':'unread'}`}><span className={`alert-icon ${a.severity}`}><Icon size={16}/></span><div className="min-w-0 flex-1"><strong>{a.title}</strong><p>{a.body}</p><small>{ago(a.createdAt)}{a.data?.txHash&&<> · <a href={`${EXPLORER}/tx/${a.data.txHash}`} target="_blank" rel="noreferrer">Transaction <ExternalLink size={11}/></a></>}{a.type==='rule'&&<> · <Link to="/app/rules">Open Wallet Rules</Link></>}{a.type==='security'&&<> · <Link to="/app/security">Quorum & recovery</Link></>}</small></div>{!a.read&&<span className="alert-dot" aria-label="Unread"/>}</article>;})}</div>}
 </section></div>
 <aside className="rules-aside">
  <PriceAlerts busy={!!busy} onAdd={payload=>act('price-add',payload,'price')} onRemove={id=>void act('price-remove',id,`remove-${id}`)} busyLabel={busy}/>
  <div className="wallet-panel rules-aside-card"><h3 className="!mt-0">What to alert me about</h3>
   <div className="alerts-settings">
    <Toggle label="Money coming in" hint="Every token transfer into your account, and a warning for zero-value transfers used in address poisoning." on={data?.settings.incoming??true} disabled={!data||!!busy} onChange={v=>void act('settings',`incoming=${v?1:0};rules=${data?.settings.rules?1:0}`,'settings')}/>
    <Toggle label="Rule runs" hint="When a rule needs your approval or is skipped." on={data?.settings.rules??true} disabled={!data||!!busy} onChange={v=>void act('settings',`incoming=${data?.settings.incoming?1:0};rules=${v?1:0}`,'settings')}/>
    <Toggle label="Security events" hint="Freezes, unfreezes and refused transactions. Always on." on disabled onChange={()=>{}}/>
    <Toggle label="Desktop notifications" hint="Pop-ups while Veilora is open in a tab. In privacy mode they say only “New alert”." on={desktop} disabled={!!busy} onChange={v=>void setDesktopNotifications(v).then(setDesktop).catch(e=>setError(e instanceof Error?e.message:'Notifications are unavailable.'))}/>
   </div>
   <p className="alerts-note">Alerts are checked about once a minute. Incoming alerts cover tokens, not plain ETH transfers, and start from when you first open this page.</p></div>
 </aside></div></>;
}

function Toggle({label,hint,on,disabled,onChange}:{label:string;hint:string;on:boolean;disabled?:boolean;onChange:(v:boolean)=>void}) {
 return <div className="wallet-settings-row !mt-0 !border-t-0 !pt-0"><div><strong>{label}</strong><p>{hint}</p></div><button role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={`wallet-toggle-switch ${on?'on':''}`} onClick={()=>onChange(!on)}><span/></button></div>;
}

function PriceAlerts({busy,busyLabel,onAdd,onRemove}:{busy:boolean;busyLabel:string;onAdd:(payload:string)=>Promise<boolean>;onRemove:(id:string)=>void}) {
 const alerts=useAlerts(); const assets=alerts.data?.priceAssets??['ETH','NVDA'];
 const [asset,setAsset]=useState('NVDA');const [direction,setDirection]=useState<'above'|'below'>('below');const [price,setPrice]=useState('');const [current,setCurrent]=useState<string|null>(null);
 useEffect(()=>{setCurrent(null);const t=TOKENS[asset];if(!t)return;let active=true;void quoteSwap(t,TOKENS.USDG,10n**BigInt(t.decimals),50).then(q=>{if(active){const v=Number(formatUnits(q.amountOut,6));setCurrent(v.toLocaleString(undefined,{maximumFractionDigits:2}));setPrice(p=>p||String(Math.round(v*(direction==='below'?0.95:1.05)*100)/100));}}).catch(()=>{if(active)setCurrent('unavailable');});return()=>{active=false;};},[asset]);
 const valid=/^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/.test(price)&&Number(price)>0;
 const list=alerts.data?.priceAlerts??[];
 return <div className="wallet-panel rules-aside-card"><h3 className="!mt-0">Price alerts</h3><p className="alerts-note !mt-0">Get an alert when an asset crosses a price on Uniswap. Each alert fires once per crossing.</p>
  <div className="alerts-price-form"><select className="wallet-select" aria-label="Asset" value={asset} onChange={e=>{setAsset(e.target.value);setPrice('');}}>{assets.map(a=><option key={a}>{a}</option>)}</select><select className="wallet-select" aria-label="Direction" value={direction} onChange={e=>setDirection(e.target.value as 'above'|'below')}><option value="below">falls to</option><option value="above">rises to</option></select><input className="builder-input" aria-label="Price in USDG" inputMode="decimal" placeholder="Price" value={price} onChange={e=>setPrice(e.target.value.replace(/[^\d.]/g,''))}/><button className="wallet-icon-button" aria-label="Add price alert" disabled={busy||!valid||list.length>=10} onClick={()=>void onAdd(`${asset}:${direction}:${price}`).then(ok=>{if(ok)setPrice('');})}>{busyLabel==='price'?<Loader2 size={16} className="animate-spin"/>:<Plus size={16}/>}</button></div>
  <p className="alerts-note">Now: {current===null?'checking…':current==='unavailable'?'unavailable':`${current} USDG`}</p>
  {list.length>0&&<ul className="alerts-price-list">{list.map(p=><li key={p.id}><Target size={13}/><span>{p.asset} {p.direction==='below'?'falls to':'rises to'} <b>{Number(p.priceUsdg).toLocaleString()} USDG</b></span>{!p.armed&&<em>reached</em>}<button className="wallet-icon-button" aria-label={`Remove ${p.asset} alert`} disabled={busy} onClick={()=>onRemove(p.id)}>{busyLabel===`remove-${p.id}`?<Loader2 size={14} className="animate-spin"/>:<Trash2 size={14}/>}</button></li>)}</ul>}
 </div>;
}

