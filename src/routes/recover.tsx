import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { ArrowLeft, FileKey2, Fingerprint, KeyRound, Loader2, ShieldCheck, Snowflake, Unlock } from 'lucide-react';
import { isAddress, type Hex } from 'viem';
import { Logo } from '@/components/ui';
import { getWallet, type WalletMetadata } from '@/lib/api';
import { WalletProvider, useWallet } from '@/lib/walletContext';
import { ReplaceDeviceTool } from '@/components/app/ReplaceDeviceTool';
import { freezeWithKey, keyMatches, parseDeviceKeyBackup, unfreezeWithKey, unlockBackup, type DeviceKeyBackup } from '@/lib/recovery';
import '@/components/wallet/wallet.css';
export const Route=createFileRoute('/recover')({component:()=><WalletProvider><RecoverPage/></WalletProvider>});

function RecoverPage() {
 const [tab,setTab]=useState<'freeze'|'replace'|'restore'>('freeze');
 return <div className="wallet-app rc-recover-page"><main className="rc-recover"><Link to="/" className="rc-recover-brand" aria-label="Veilora home"><Logo size={32}/></Link>
  <h1>Lost access to your device?</h1><p className="rc-recover-lead">Stop anything from moving, then get back in. Your keys are used only in this browser and never sent.</p>
  <div className="builder-segments rc-recover-tabs" role="tablist"><button role="tab" aria-selected={tab==='freeze'} className={tab==='freeze'?'on':''} onClick={()=>setTab('freeze')}><Snowflake size={16}/>Freeze with recovery key</button><button role="tab" aria-selected={tab==='replace'} className={tab==='replace'?'on':''} onClick={()=>setTab('replace')}><KeyRound size={16}/>Replace device key</button><button role="tab" aria-selected={tab==='restore'} className={tab==='restore'?'on':''} onClick={()=>setTab('restore')}><FileKey2 size={16}/>Restore from backup</button></div>
  <section className="wallet-panel rc-recover-card">{tab==='freeze'?<FreezeTool/>:tab==='replace'?<ReplaceDeviceTool/>:<RestoreTool/>}</section>
  <div className="rc-recover-note"><KeyRound size={16}/><p><strong>Only have your recovery key?</strong> Freeze first so nothing can move, then replace your device key. It finishes after a 48-hour wait, during which your old device key can cancel it, so a stolen recovery key can’t take over quietly.</p></div>
  <Link to="/app" className="rc-recover-back"><ArrowLeft size={14}/>Back to the wallet</Link></main></div>;
}

function FreezeTool() {
 const [address,setAddress]=useState('');const [key,setKey]=useState('');const [hours,setHours]=useState(72);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [done,setDone]=useState('');const [wallet,setWallet]=useState<WalletMetadata|null>(null);
 const recoveryFrozen=!!wallet?.isFrozen&&wallet.freezeInitiatedBy==='recovery';
 async function lookup(value:string){setAddress(value);setWallet(null);setError('');if(!isAddress(value))return;try{setWallet(await getWallet(value));}catch{setError('No Veilora account was found at that address.');}}
 async function run(){if(!wallet)return;if(!keyMatches(key,wallet.shardC)){setError('This key does not match the recovery shard for that account.');return;}setBusy(true);setError('');
  try{if(recoveryFrozen){await unfreezeWithKey(wallet.address,key as Hex);setDone('Freeze lifted. The co-signer is signing again.');}else{const s=await freezeWithKey(wallet.address,key as Hex,hours,'Recovery freeze: device lost or stolen');setDone(`Frozen until ${new Date(s.frozenUntil??'').toLocaleString()}. Only your recovery key can lift this freeze.`);}setKey('');setWallet(await getWallet(wallet.address));}
  catch(e){setError(e instanceof Error?e.message:'Could not update the freeze.');}finally{setBusy(false);}}
 return <div className="rule-builder"><div className="rc-recover-head"><span className="rules-aside-icon"><Fingerprint size={18}/></span><div><h2>{recoveryFrozen?'Lift a recovery freeze':'Freeze your account'}</h2><p>Veilora’s co-signer stops signing, so no transaction can get the second signature it needs.</p></div></div>
  <label className="builder-field"><span>Smart account address</span><input className="builder-input font-mono" spellCheck={false} placeholder="0x…" value={address} onChange={e=>void lookup(e.target.value.trim())}/></label>
  {wallet&&<p className="builder-hint">{wallet.isFrozen?`Currently frozen until ${new Date(wallet.frozenUntil??'').toLocaleString()}${wallet.freezeInitiatedBy==='recovery'?' with the recovery key':''}.`:'Account found. Not frozen.'}</p>}
  <label className="builder-field"><span>Recovery key (Shard C)</span><input className="builder-input font-mono" type="password" autoComplete="off" spellCheck={false} placeholder="0x…" value={key} onChange={e=>{setKey(e.target.value.trim());setError('');}}/></label>
  {!recoveryFrozen&&<label className="builder-field"><span>Duration</span><select className="wallet-select" value={hours} onChange={e=>setHours(Number(e.target.value))}>{[24,72,168].map(h=><option key={h} value={h}>{h===168?'7 days':`${h} hours`}</option>)}</select></label>}
  {error&&<p role="alert" className="wallet-error">{error}</p>}{done&&<div className="wallet-notice" role="status">{done}</div>}
  <button className="wallet-primary-button" disabled={!wallet||!key||busy} onClick={()=>void run()}>{busy?<><Loader2 size={16} className="animate-spin"/>Signing…</>:recoveryFrozen?<><Unlock size={16}/>Lift freeze</>:<><Snowflake size={16}/>Freeze account</>}</button></div>;
}

function RestoreTool() {
 const {connectExistingWallet}=useWallet();const navigate=useNavigate();
 const [backup,setBackup]=useState<DeviceKeyBackup|null>(null);const [passphrase,setPassphrase]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function pick(file?:File){setBackup(null);setError('');if(!file)return;try{setBackup(parseDeviceKeyBackup(await file.text()));}catch(e){setError(e instanceof Error?e.message:'Could not read that file.');}}
 async function run(){if(!backup)return;setBusy(true);setError('');try{const key=await unlockBackup(backup,passphrase);await connectExistingWallet(backup.wallet,key,passphrase);setPassphrase('');void navigate({to:'/app'});}catch(e){setError(e instanceof Error?e.message:'Could not restore this backup.');}finally{setBusy(false);}}
 return <div className="rule-builder"><div className="rc-recover-head"><span className="rules-aside-icon"><ShieldCheck size={18}/></span><div><h2>Restore your device key</h2><p>Use the encrypted backup you downloaded from Quorum & recovery. Your account address stays the same.</p></div></div>
  <label className="builder-field"><span>Backup file</span><input className="builder-input" type="file" accept="application/json,.json" onChange={e=>void pick(e.target.files?.[0])}/></label>
  {backup&&<p className="builder-hint">Backup for account {backup.wallet.slice(0,8)}…{backup.wallet.slice(-6)}.</p>}
  <label className="builder-field"><span>Backup passphrase</span><input className="builder-input" type="password" autoComplete="current-password" value={passphrase} onChange={e=>setPassphrase(e.target.value)}/></label>
  <p className="builder-hint">The passphrase you used on the old device. It decrypts the key here and encrypts it again for this browser. If this browser already holds a Veilora wallet, restoring replaces it here, so back that one up first.</p>
  {error&&<p role="alert" className="wallet-error">{error}</p>}
  <button className="wallet-primary-button" disabled={!backup||passphrase.length<12||busy} onClick={()=>void run()}>{busy?<><Loader2 size={16} className="animate-spin"/>Restoring…</>:'Restore and open wallet'}</button></div>;
}
