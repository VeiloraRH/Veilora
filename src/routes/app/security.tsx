import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, CircleDashed, Copy, Download, Eye, Fingerprint, KeyRound, Laptop, Loader2, Lock, RefreshCw, Server, ShieldAlert, ShieldCheck, Smartphone, Snowflake, Unlock, X } from 'lucide-react';
import type { Hex } from 'viem';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DevicePassphraseDialog } from '@/components/app/DevicePassphraseDialog';
import { PageTitle, shortAddress } from '@/components/wallet/WalletUI';
import { CompletionDialog, type CompletionNotice } from '@/components/app/CompletionDialog';
import { getQuorumStatus } from '@/lib/api';
import { useWallet } from '@/lib/walletContext';
import { saveSpendingPolicy, useSpendingPolicy } from '@/lib/spendingPolicy';
import { DRILL_VALID_DAYS, downloadDeviceKeyBackup, drillIsCurrent, freezeWithKey, keyMatches, readFlag, unfreezeWithKey, writeFlag } from '@/lib/recovery';
export const Route=createFileRoute('/app/security')({component:RecoveryCenter});

const day=(iso:string)=>new Date(iso).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
const when=(iso:string)=>new Date(iso).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});

export function RecoveryCenter() {
 const {wallet,walletAddress,deviceKeyPresent,deviceKeyUnlocked,getStoredDeviceKey,auditTrail,refresh}=useWallet();
 const quorum=useQuery({queryKey:['quorum',walletAddress],enabled:!!walletAddress,refetchInterval:30000,queryFn:()=>getQuorumStatus(walletAddress)});
 const [flags,setFlags]=useState(()=>({backup:readFlag(walletAddress,'backup'),drill:readFlag(walletAddress,'drill')}));
 const syncFlags=()=>setFlags({backup:readFlag(walletAddress,'backup'),drill:readFlag(walletAddress,'drill')});
 const [dialog,setDialog]=useState<null|'drill'|'recovery-freeze'|'device-freeze'|'view-key'|'import-key'>(null);
 const [completion,setCompletion]=useState<CompletionNotice|null>(null);const [error,setError]=useState('');
 const q=quorum.data; const freeze=q?.freeze; const shardC=q?.onChain?.shardC??wallet?.shardC??'';
 const after=(message:string,title='Security update complete')=>{setDialog(null);setCompletion({title,description:message});syncFlags();void quorum.refetch();void refresh();};

 function backup(){setError('');try{downloadDeviceKeyBackup(walletAddress,wallet?.shardA??'');syncFlags();setCompletion({title:'Encrypted backup downloaded',description:'Keep it somewhere other than this device. You will need its passphrase to restore it.'});}catch(e){setError(e instanceof Error?e.message:'Could not create the backup.');}}
 async function liftWithDevice(){const key=getStoredDeviceKey();if(!key){setError('Unlock your device key first.');return;}setError('');try{await unfreezeWithKey(walletAddress,key as Hex);after('Freeze lifted. The co-signer is signing again.');}catch(e){setError(e instanceof Error?e.message:'Could not lift the freeze.');}}

 const checks:Check[]=[
  {id:'device',label:'Device key is on this device',detail:deviceKeyPresent?'Encrypted with your passphrase in this browser.':'This browser has no device key. Import it to sign here.',state:deviceKeyPresent?'ok':'bad',action:!deviceKeyPresent?{label:'Import key',run:()=>setDialog('import-key')}:undefined},
  {id:'backup',label:'Device key is backed up',detail:flags.backup?`Backup saved ${day(flags.backup)}.`:'If this device is lost, a backup lets you sign from a new one in minutes.',state:flags.backup?'ok':'warn',action:deviceKeyPresent?{label:flags.backup?'Download again':'Download backup',run:backup}:undefined},
  {id:'drill',label:'Recovery key verified',detail:drillIsCurrent(flags.drill)?`Checked ${day(flags.drill!)}. Repeat every ${DRILL_VALID_DAYS} days.`:flags.drill?`Last checked ${day(flags.drill)}. Check it again.`:'Prove you can find your offline recovery key before you need it.',state:drillIsCurrent(flags.drill)?'ok':'warn',action:{label:'Run drill',run:()=>setDialog('drill')}},
  {id:'chain',label:'Account shards match on-chain',detail:!q?'Checking Robinhood Chain…':q.chainError?q.chainError:!q.deployed?'Your account deploys on its first transaction.':q.matches&&Object.values(q.matches).every(Boolean)?'The deployed account accepts exactly these three keys.':'The deployed account does not match this registration. Freeze and contact support.',state:!q||q.chainError||!q.deployed?'wait':q.matches&&Object.values(q.matches).every(Boolean)?'ok':'bad'},
  {id:'cosigner',label:'Co-signer is signing',detail:freeze?.frozen?`Frozen until ${when(freeze.frozenUntil!)}${freeze.initiatedBy==='recovery'?' with your recovery key':''}.`:'Shard B co-signs requests you authorize, within its policy limits.',state:!q?'wait':freeze?.frozen?'warn':'ok'},
 ];
 const score=checks.filter(c=>c.state==='ok').length;

 const shards=[
  {id:'A',name:'Device key',icon:Laptop,address:wallet?.shardA,match:q?.matches?.shardA,status:!deviceKeyPresent?['Missing here','bad']:deviceKeyUnlocked?['Unlocked','ok']:['Locked','warn'],where:'This browser, encrypted with your passphrase',actions:<>{deviceKeyPresent&&<button className="rule-button" onClick={backup}><Download size={14}/>Backup</button>}{deviceKeyPresent?<button className="rule-button" disabled={!deviceKeyUnlocked} onClick={()=>setDialog('view-key')}><Eye size={14}/>View</button>:<button className="rule-button" onClick={()=>setDialog('import-key')}><KeyRound size={14}/>Import</button>}</>},
  {id:'B',name:'Veilora co-signer',icon:Server,address:wallet?.shardB,match:q?.matches?.shardB,status:!q?['Checking','wait']:q.coSigner.signing?['Signing','ok']:['Paused by freeze','warn'],where:q?`${q.coSigner.approvals30d} approved · ${q.coSigner.rejections30d} refused in 30 days`:'Encrypted on Veilora’s backend',actions:null},
  {id:'C',name:'Recovery key',icon:Fingerprint,address:wallet?.shardC,match:q?.matches?.shardC,status:drillIsCurrent(flags.drill)?['Verified','ok']:['Not verified','warn'],where:'Offline. Shown once when you created the account',actions:<button className="rule-button" onClick={()=>setDialog('drill')}><ShieldCheck size={14}/>Run drill</button>},
 ] as const;

 return <><PageTitle title="Quorum & recovery" description="Which keys guard your account, and how you get back in if a device is lost." action={<button className="wallet-icon-button" aria-label="Refresh status" onClick={()=>{void quorum.refetch();void refresh();syncFlags();}}><RefreshCw size={18} className={quorum.isFetching?'animate-spin':''}/></button>}/>
 {error&&<p role="alert" className="wallet-error mb-5">{error}</p>}
 {freeze?.frozen&&<div className="rc-frozen" role="status"><Snowflake size={20}/><div><strong>Account frozen until {when(freeze.frozenUntil!)}</strong><p>{freeze.initiatedBy==='recovery'?'Set with your recovery key. Only the recovery key can lift it, so a stolen device cannot undo it.':'The co-signer refuses every request until it ends or you lift it.'}{freeze.reason&&` Reason: ${freeze.reason}.`}</p></div>{freeze.initiatedBy==='recovery'?<button className="rule-button" onClick={()=>setDialog('recovery-freeze')}><Unlock size={14}/>Lift with recovery key</button>:<button className="rule-button" disabled={!deviceKeyUnlocked} onClick={()=>void liftWithDevice()}><Unlock size={14}/>Lift freeze</button>}</div>}

 <div className="rc-top"><section className="wallet-panel rc-quorum" aria-label="Quorum"><div className="rc-quorum-head"><div><span className="rc-eyebrow">Quorum</span><h2>Any 2 of 3 keys</h2><p>One key alone can never move funds.</p></div><span className={`rule-status ${freeze?.frozen?'paused':'active'}`}>{freeze?.frozen?'Frozen':'Active'}</span></div>
  <QuorumDiagram a={shards[0].status[1]} b={shards[1].status[1]} c={shards[2].status[1]}/>
  <dl className="rc-facts"><div><dt>Account</dt><dd>{walletAddress?shortAddress(walletAddress):'—'}</dd></div><div><dt>Deployed</dt><dd>{!q?'—':q.deployed?'On-chain':'Not yet'}</dd></div><div><dt>Nonce</dt><dd>{q?.onChain?.nonce??'—'}</dd></div></dl></section>
  <section className="wallet-panel rc-ready" aria-label="Recovery readiness"><div className="rc-ready-head"><Ring value={score} total={checks.length}/><div><span className="rc-eyebrow">Recovery readiness</span><h2>{score===checks.length?'You are ready':score>=3?'Almost there':'Needs attention'}</h2><p>{score} of {checks.length} checks passed</p></div></div>
   <ul className="rc-checks">{checks.map(c=><li key={c.id} className={c.state}><CheckIcon state={c.state}/><div className="min-w-0 flex-1"><strong>{c.label}</strong><small>{c.detail}</small></div>{c.action&&c.state!=='ok'&&<button className="rule-button" onClick={c.action.run}>{c.action.label}</button>}</li>)}</ul></section></div>

 <section className="rc-section"><div className="wallet-section-heading"><h2>Shards</h2></div><div className="rc-shards">{shards.map(s=><article key={s.id} className="wallet-panel rc-shard"><div className="rc-shard-head"><span className={`rc-shard-icon s${s.id}`}><s.icon size={19}/></span><div className="min-w-0 flex-1"><small>Shard {s.id}</small><h3>{s.name}</h3></div><span className={`rc-pill ${s.status[1]}`}>{s.status[0]}</span></div><p className="rc-where">{s.where}</p><AddressLine address={s.address} match={s.match} deployed={q?.deployed}/>{s.actions&&<div className="rc-shard-actions">{s.actions}</div>}</article>)}</div></section>

 <SpendingLimits />

 <section className="rc-section"><div className="wallet-section-heading"><h2>If you lose access</h2></div><div className="rc-playbook">
  <Scenario icon={Smartphone} title="New phone or browser" tag="available" text="Restore your encrypted device-key backup on the new device, or import the device key. Your account address does not change.">{deviceKeyPresent&&<button className="rule-button" onClick={backup}><Download size={14}/>Download backup</button>}<Link className="rule-button" to="/recover">Open restore page</Link></Scenario>
  <Scenario icon={ShieldAlert} title="Device lost or stolen" tag="available" text="Freeze from any browser with your recovery key. The co-signer stops signing, and only the recovery key can lift that freeze."><button className="rule-button danger" onClick={()=>setDialog('recovery-freeze')}><Snowflake size={14}/>Freeze with recovery key</button></Scenario>
  <Scenario icon={KeyRound} title="Device key gone for good" tag="planned" text="Your account accepts the recovery key plus the co-signer, so the device key can be replaced on-chain. Veilora’s guided key rotation for this is planned. Freeze first: your assets stay in your account and nothing can move with one key."/>
  <Scenario icon={Fingerprint} title="Recovery key lost" tag="available" text="Your device key and the co-signer still work, so you keep full access. Swapping in a new recovery key needs key rotation (planned). Until then, back up your device key, or move your assets to a new account you set up in a separate browser profile."/>
 </div></section>

 <div className="rc-bottom"><section className="wallet-panel rc-emergency"><span className="rules-aside-icon"><Lock size={18}/></span><h3>Emergency freeze</h3><p>Stops Veilora’s co-signer from signing anything for up to 7 days. It cannot move or lock your on-chain assets; it removes the second signature every transaction needs.</p><div className="rc-shard-actions"><button className="rule-button" disabled={!deviceKeyUnlocked||freeze?.initiatedBy==='recovery'} onClick={()=>setDialog('device-freeze')}><Laptop size={14}/>Freeze with device key</button><button className="rule-button danger" onClick={()=>setDialog('recovery-freeze')}><Fingerprint size={14}/>Use recovery key</button></div></section>
  <section className="wallet-panel rc-audit"><div className="rc-audit-head"><h3>Co-signer activity</h3>{q?.coSigner.lastApprovedAt&&<small>Last approved {when(q.coSigner.lastApprovedAt)}</small>}</div>{auditTrail.length===0?<p className="rc-muted">No co-signing requests yet. Every request Shard B approves or refuses appears here.</p>:<ul>{auditTrail.slice(0,6).map(r=><li key={r.id}><span className="font-mono">{shortAddress(r.user_op_hash)}</span><small>{when(r.created_at)}</small><span className={`wallet-status ${r.status==='APPROVED'?'confirmed':'failed'}`}>{r.status==='APPROVED'?'Approved':r.status.replace('REJECTED_','Refused · ').toLowerCase()}</span></li>)}</ul>}</section></div>

 {dialog==='drill'&&<DrillDialog shardC={shardC} onClose={()=>setDialog(null)} onPassed={()=>{writeFlag(walletAddress,'drill');after('Put your recovery key back somewhere safe and offline.','Recovery key verified');}}/>}
 {dialog==='recovery-freeze'&&<RecoveryFreezeDialog wallet={walletAddress} shardC={shardC} frozenByRecovery={freeze?.initiatedBy==='recovery'} onClose={()=>setDialog(null)} onDone={after}/>}
 {dialog==='device-freeze'&&<DeviceFreezeDialog wallet={walletAddress} onClose={()=>setDialog(null)} onDone={after}/>}
 {dialog==='view-key'&&<ViewKeyDialog wallet={walletAddress} onClose={()=>{setDialog(null);syncFlags();}}/>}
 {dialog==='import-key'&&<ImportKeyDialog onClose={()=>setDialog(null)} onDone={after}/>}
 <CompletionDialog notice={completion} onClose={()=>setCompletion(null)}/></>;
}

function SpendingLimits() {
 const { walletAddress, getStoredDeviceKey, deviceKeyUnlocked } = useWallet();
 const cache = useQueryClient();
 const policy = useSpendingPolicy();
 const [perTx, setPerTx] = useState(20);
 const [daily, setDaily] = useState(20);
 const [busy, setBusy] = useState(false);
 const [completion, setCompletion] = useState<CompletionNotice|null>(null);
 const [error, setError] = useState('');
 useEffect(() => {
  if (policy.data) { setPerTx(policy.data.perTransactionPercent); setDaily(policy.data.dailyTotalPercent); }
 }, [policy.data]);
 async function save() {
  const key = getStoredDeviceKey();
  if (!key) { setError('Unlock your device key before changing spending limits.'); return; }
  setBusy(true); setError(''); setCompletion(null);
  try {
   const updated = await saveSpendingPolicy(walletAddress, key as Hex, perTx, daily);
   cache.setQueryData(['spending-policy', walletAddress], updated);
   setCompletion({title:'Spending limits updated',description:`The co-signer will now use your ${perTx}% per-transaction and ${daily}% daily limits.`});
  } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update spending limits.'); }
  finally { setBusy(false); }
 }
 return <section className="rc-section">
  <div className="wallet-section-heading"><h2>Co-signer spending limits</h2></div>
  <div className="wallet-panel p-6">
   <p className="rc-muted">Set the maximum the co-signer will approve for one transaction and across all co-signed spending in a UTC day. Limits apply separately to each asset.</p>
   <div className="grid gap-6 md:grid-cols-2 mt-5">
    <label className="builder-field"><span>Maximum per transaction: <strong>{perTx}%</strong></span><input type="range" min="1" max="100" step="1" value={perTx} onChange={e=>setPerTx(Number(e.target.value))} disabled={!deviceKeyUnlocked||busy}/><small className="rc-muted">A single transfer, bridge, swap, or token approval cannot exceed this share of the current asset balance.</small></label>
    <label className="builder-field"><span>Maximum daily total: <strong>{daily}%</strong></span><input type="range" min="1" max="100" step="1" value={daily} onChange={e=>setDaily(Number(e.target.value))} disabled={!deviceKeyUnlocked||busy}/><small className="rc-muted">The co-signer tracks total approved spending per asset, measured from the balance at your first co-signed spend that UTC day. It resets at 00:00 UTC.</small></label>
   </div>
   {!deviceKeyUnlocked&&<p className="builder-hint mt-4">Unlock your device key to view and change these settings.</p>}
   {policy.isError&&<p role="alert" className="wallet-error mt-4">{policy.error instanceof Error?policy.error.message:'Could not load spending limits.'}</p>}
   {error&&<p role="alert" className="wallet-error mt-4">{error}</p>}
   <button className="wallet-primary-button mt-5" disabled={!deviceKeyUnlocked||busy||!policy.data|| (perTx===policy.data.perTransactionPercent&&daily===policy.data.dailyTotalPercent)} onClick={()=>void save()}>{busy?'Saving limits…':'Save spending limits'}</button>
  </div><CompletionDialog notice={completion} onClose={()=>setCompletion(null)}/>
 </section>;
}

type CheckState='ok'|'warn'|'bad'|'wait';
type Check={id:string;label:string;detail:string;state:CheckState;action?:{label:string;run:()=>void}};
function CheckIcon({state}:{state:CheckState}){return <span className={`rc-check-icon ${state}`}>{state==='ok'?<Check size={13}/>:state==='wait'?<CircleDashed size={13}/>:state==='bad'?<X size={13}/>:<AlertTriangle size={12}/>}</span>;}
function Ring({value,total}:{value:number;total:number}) {
 const r=30,c=2*Math.PI*r,pct=value/total;
 return <svg className="rc-ring" viewBox="0 0 76 76" role="img" aria-label={`${value} of ${total}`}><circle cx="38" cy="38" r={r} className="track"/><circle cx="38" cy="38" r={r} className={`bar ${pct===1?'full':pct>=.6?'mid':'low'}`} strokeDasharray={c} strokeDashoffset={c*(1-pct)} transform="rotate(-90 38 38)"/><text x="38" y="43" textAnchor="middle">{value}/{total}</text></svg>;
}
function QuorumDiagram({a,b,c}:{a:string;b:string;c:string}) {
 const nodes=[{k:'A',x:110,y:26,s:a,icon:Laptop},{k:'B',x:30,y:150,s:b,icon:Server},{k:'C',x:190,y:150,s:c,icon:Fingerprint}];
 return <div className="rc-diagram"><svg viewBox="0 0 220 180" aria-hidden="true"><path d="M110 26 L30 150 L190 150 Z" className="rc-tri"/>{nodes.map(n=><circle key={n.k} cx={n.x} cy={n.y} r="5" className={`rc-dot ${n.s}`}/>)}</svg><div className="rc-core"><strong>2/3</strong><span>to sign</span></div>{nodes.map(n=><span key={n.k} className={`rc-node ${n.s}`} style={{left:`${n.x/220*100}%`,top:`${n.y/180*100}%`}}><n.icon size={17}/><b>{n.k}</b></span>)}</div>;
}
function AddressLine({address,match,deployed}:{address?:string;match?:boolean;deployed?:boolean}) {
 const [copied,setCopied]=useState(false);
 return <div className="rc-address"><span className="font-mono">{address?shortAddress(address):'—'}</span>{deployed&&match!==undefined&&<span className={match?'rc-match':'rc-mismatch'}>{match?<><Check size={11}/>On-chain</>:<><X size={11}/>Mismatch</>}</span>}{address&&<button className="wallet-icon-button" aria-label="Copy address" onClick={()=>void navigator.clipboard?.writeText(address).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),1500);})}>{copied?<Check size={14}/>:<Copy size={14}/>}</button>}</div>;
}
function Scenario({icon:Icon,title,tag,text,children}:{icon:typeof Laptop;title:string;tag:'available'|'planned';text:string;children?:ReactNode}) {
 return <article className="wallet-panel rc-scenario"><div className="rc-scenario-head"><span className="rc-scenario-icon"><Icon size={18}/></span><h3>{title}</h3><span className={`rc-tag ${tag}`}>{tag==='available'?'Available':'Planned'}</span></div><p>{text}</p>{children&&<div className="rc-shard-actions">{children}</div>}</article>;
}

function KeyInput({value,onChange,label}:{value:string;onChange:(v:string)=>void;label:string}) {
 return <label className="builder-field"><span>{label}</span><input className="builder-input font-mono" type="password" autoComplete="off" spellCheck={false} placeholder="0x…" value={value} onChange={e=>onChange(e.target.value.trim())}/></label>;
}
function DrillDialog({shardC,onClose,onPassed}:{shardC:string;onClose:()=>void;onPassed:()=>void}) {
 const [key,setKey]=useState('');const [failed,setFailed]=useState(false);
 return <Dialog open onOpenChange={v=>{if(!v)onClose();}}><DialogContent className="wallet-dialog rule-builder sm:max-w-md"><DialogHeader><DialogTitle>Recovery drill</DialogTitle><DialogDescription>Paste the recovery key you saved when you created this account.</DialogDescription></DialogHeader>
  <KeyInput label="Recovery key (Shard C)" value={key} onChange={v=>{setKey(v);setFailed(false);}}/>
  <p className="builder-hint">The key is checked against your account’s Shard C address ({shardC?shortAddress(shardC):'—'}) here in your browser. It is never sent or stored.</p>
  {failed&&<p role="alert" className="wallet-error">This key does not match your recovery shard. Look for the key you saved when you created this account.</p>}
  <button className="wallet-primary-button" disabled={!key} onClick={()=>{if(keyMatches(key,shardC)){setKey('');onPassed();}else setFailed(true);}}>Check recovery key</button></DialogContent></Dialog>;
}
function RecoveryFreezeDialog({wallet,shardC,frozenByRecovery,onClose,onDone}:{wallet:string;shardC:string;frozenByRecovery:boolean;onClose:()=>void;onDone:(m:string)=>void}) {
 const [key,setKey]=useState('');const [hours,setHours]=useState(72);const [reason,setReason]=useState('Device lost or stolen');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function run(){if(!keyMatches(key,shardC)){setError('This key does not match your recovery shard.');return;}setBusy(true);setError('');try{if(frozenByRecovery){await unfreezeWithKey(wallet,key as Hex);setKey('');onDone('Recovery freeze lifted. The co-signer is signing again.');}else{await freezeWithKey(wallet,key as Hex,hours,reason.trim()||'Recovery freeze');setKey('');onDone(`Frozen for ${hours} hours with your recovery key. A stolen device cannot lift this freeze.`);}}catch(e){setError(e instanceof Error?e.message:'Could not update the freeze.');}finally{setBusy(false);}}
 return <Dialog open onOpenChange={v=>{if(!v&&!busy)onClose();}}><DialogContent className="wallet-dialog rule-builder sm:max-w-md"><DialogHeader><DialogTitle>{frozenByRecovery?'Lift recovery freeze':'Freeze with recovery key'}</DialogTitle><DialogDescription>{frozenByRecovery?'Only your recovery key can lift a freeze it set.':'Use this if your device is lost or someone else may have it.'}</DialogDescription></DialogHeader>
  <KeyInput label="Recovery key (Shard C)" value={key} onChange={v=>{setKey(v);setError('');}}/>
  {!frozenByRecovery&&<div className="builder-row"><label className="builder-field"><span>Duration</span><select className="wallet-select" value={hours} onChange={e=>setHours(Number(e.target.value))}>{[24,72,168].map(h=><option key={h} value={h}>{h===168?'7 days':`${h} hours`}</option>)}</select></label><label className="builder-field"><span>Reason</span><input className="builder-input" maxLength={128} value={reason} onChange={e=>setReason(e.target.value.replace(/[\r\n]/g,''))}/></label></div>}
  <p className="builder-hint">The key signs this request in your browser and is not sent or stored.</p>
  {error&&<p role="alert" className="wallet-error">{error}</p>}
  <button className="wallet-primary-button" disabled={!key||busy} onClick={()=>void run()}>{busy?<><Loader2 size={16} className="animate-spin"/>Signing…</>:frozenByRecovery?'Lift freeze':'Freeze account'}</button></DialogContent></Dialog>;
}
function DeviceFreezeDialog({wallet,onClose,onDone}:{wallet:string;onClose:()=>void;onDone:(m:string)=>void}) {
 const {getStoredDeviceKey}=useWallet();const [hours,setHours]=useState(24);const [reason,setReason]=useState('Suspicious activity');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function run(){const key=getStoredDeviceKey();if(!key){setError('Unlock your device key first.');return;}setBusy(true);setError('');try{await freezeWithKey(wallet,key as Hex,hours,reason.trim()||'Emergency freeze');onDone(`Frozen for ${hours} hours. Lift it early here with your device or recovery key.`);}catch(e){setError(e instanceof Error?e.message:'Could not freeze the account.');}finally{setBusy(false);}}
 return <Dialog open onOpenChange={v=>{if(!v&&!busy)onClose();}}><DialogContent className="wallet-dialog rule-builder sm:max-w-md"><DialogHeader><DialogTitle>Emergency freeze</DialogTitle><DialogDescription>The co-signer refuses every request while the freeze lasts.</DialogDescription></DialogHeader>
  <div className="builder-row"><label className="builder-field"><span>Duration</span><select className="wallet-select" value={hours} onChange={e=>setHours(Number(e.target.value))}>{[6,12,24,48,72].map(h=><option key={h} value={h}>{h} hours</option>)}</select></label><label className="builder-field"><span>Reason</span><input className="builder-input" maxLength={128} value={reason} onChange={e=>setReason(e.target.value.replace(/[\r\n]/g,''))}/></label></div>
  <p className="builder-hint">If you think this device is compromised, freeze with your recovery key instead. A device-key freeze can be lifted by the device key.</p>
  {error&&<p role="alert" className="wallet-error">{error}</p>}
  <button className="wallet-primary-button" disabled={busy} onClick={()=>void run()}>{busy?<><Loader2 size={16} className="animate-spin"/>Freezing…</>:'Freeze account'}</button></DialogContent></Dialog>;
}
function ViewKeyDialog({wallet,onClose}:{wallet:string;onClose:()=>void}) {
 const {getStoredDeviceKey}=useWallet();const key=getStoredDeviceKey();const [shown,setShown]=useState(false);const [copied,setCopied]=useState(false);
 return <Dialog open onOpenChange={v=>{if(!v)onClose();}}><DialogContent className="wallet-dialog rule-builder sm:max-w-md"><DialogHeader><DialogTitle>Device key (Shard A)</DialogTitle><DialogDescription>Anyone with this key and your recovery key, or this key and the co-signer, can sign for your account.</DialogDescription></DialogHeader>
  <div className="rc-secret">{shown?key:'•'.repeat(32)}</div>
  <div className="review-actions"><button className="rule-button" onClick={()=>setShown(!shown)}><Eye size={14}/>{shown?'Hide':'Reveal'}</button><button className="wallet-primary-button" disabled={!key} onClick={()=>{if(key)void navigator.clipboard.writeText(key).then(()=>{writeFlag(wallet,'backup');setCopied(true);});}}>{copied?<><Check size={16}/>Copied</>:<><Copy size={16}/>Copy key</>}</button></div>
  <p className="builder-hint">Prefer the encrypted backup file. A copied key is unencrypted: store it offline and never share it.</p></DialogContent></Dialog>;
}
function ImportKeyDialog({onClose,onDone}:{onClose:()=>void;onDone:(m:string)=>void}) {
 const {wallet,importDeviceKey}=useWallet();const [key,setKey]=useState('');const [error,setError]=useState('');const [passphrase,setPassphrase]=useState(false);const [busy,setBusy]=useState(false);
 return <><Dialog open={!passphrase} onOpenChange={v=>{if(!v)onClose();}}><DialogContent className="wallet-dialog rule-builder sm:max-w-md"><DialogHeader><DialogTitle>Import device key</DialogTitle><DialogDescription>Paste this account’s Shard A key to sign from this browser.</DialogDescription></DialogHeader>
  <KeyInput label="Device key (Shard A)" value={key} onChange={v=>{setKey(v);setError('');}}/>{error&&<p role="alert" className="wallet-error">{error}</p>}
  <button className="wallet-primary-button" disabled={!key} onClick={()=>{if(!wallet?.shardA||!keyMatches(key,wallet.shardA)){setError('This key does not match the account’s registered Shard A.');return;}setPassphrase(true);}}>Continue</button></DialogContent></Dialog>
  <DevicePassphraseDialog open={passphrase} busy={busy} onOpenChange={open=>{if(!open)setPassphrase(false);}} title="Encrypt your imported key" description="Choose a passphrase to encrypt Shard A before saving it in this browser." onSubmit={async pass=>{setBusy(true);try{await importDeviceKey(key,pass,wallet?.shardA);setKey('');onDone('Device key imported and encrypted on this browser.');}finally{setBusy(false);}}}/></>;
}
