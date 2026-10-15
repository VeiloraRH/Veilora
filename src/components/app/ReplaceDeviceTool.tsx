import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Clock, KeyRound, Loader2, X } from 'lucide-react';
import { isAddress, type Hex } from 'viem';
import { generatePrivateKey, privateKeyToAddress } from 'viem/accounts';
import { getWallet, type WalletMetadata } from '@/lib/api';
import { decryptDeviceKey, encryptDeviceKey, validateDevicePassphrase } from '@/lib/deviceKeyVault';
import { keyMatches } from '@/lib/recovery';
import { cancelRotation, clearPendingDeviceKey, finishRotation, getPendingDeviceKey, getRotations, requestRotation, savePendingDeviceKey, timeUntil, type KeyRotation } from '@/lib/rotationsApi';
import { useWallet } from '@/lib/walletContext';

/**
 * Replace a lost device key with the recovery key. The new device key is made
 * and encrypted in this browser, and waits here until the 48-hour delay ends.
 */
export function ReplaceDeviceTool() {
 const { connectExistingWallet } = useWallet(); const navigate = useNavigate();
 const [address, setAddress] = useState(''); const [wallet, setWallet] = useState<WalletMetadata | null>(null); const [rotation, setRotation] = useState<KeyRotation | null>(null);
 const [recoveryKey, setRecoveryKey] = useState(''); const [passphrase, setPassphrase] = useState(''); const [confirm, setConfirm] = useState('');
 const [busy, setBusy] = useState(''); const [error, setError] = useState(''); const [done, setDone] = useState('');
 const pending = wallet ? getPendingDeviceKey(wallet.address) : null;
 const pendingHere = !!(pending && rotation && pending.address.toLowerCase() === rotation.newAddress.toLowerCase());
 const keyOk = !!wallet && keyMatches(recoveryKey, wallet.shardC);

 async function load(value: string) {
  setAddress(value); setWallet(null); setRotation(null); setError(''); setDone('');
  if (!isAddress(value)) return;
  try {
   const [w, r] = await Promise.all([getWallet(value), getRotations(value)]);
   setWallet(w); setRotation(r.rotations.find(x => x.kind === 'device' && x.status === 'pending') ?? null);
  } catch { setError('No Veilora account was found at that address.'); }
 }
 useEffect(() => { if (!rotation || rotation.ready) return; const t = setInterval(() => { void load(address); }, 60_000); return () => clearInterval(t); }, [rotation, address]);

 async function start() {
  if (!wallet || !keyOk) { setError('This key does not match the recovery key for that account.'); return; }
  const weak = validateDevicePassphrase(passphrase); if (weak) { setError(weak); return; }
  if (passphrase !== confirm) { setError('The passphrases do not match.'); return; }
  setBusy('Creating your new device key…'); setError('');
  try {
   const newKey = generatePrivateKey(); const newAddress = privateKeyToAddress(newKey);
   savePendingDeviceKey(wallet.address, { address: newAddress, encrypted: await encryptDeviceKey(newKey, passphrase), rotationId: null, createdAt: new Date().toISOString() });
   setBusy('Signing the request with your recovery key…');
   const r = await requestRotation(wallet.address, recoveryKey.trim() as Hex, 'device', newAddress);
   savePendingDeviceKey(wallet.address, { ...getPendingDeviceKey(wallet.address)!, rotationId: r.id });
   setRotation(r); setPassphrase(''); setConfirm('');
   setDone(`Started. Come back to this page in this browser after ${timeUntil(r.maturesAt)} to finish. Your new device key is saved here, encrypted with your passphrase.`);
  } catch (e) { clearPendingDeviceKey(wallet.address); setError(e instanceof Error ? e.message : 'Could not start the replacement.'); } finally { setBusy(''); }
 }

 async function finish() {
  if (!wallet || !rotation || !pending || !keyOk) return;
  setError('');
  try {
   setBusy('Unlocking your new device key…');
   let newKey: string;
   try { newKey = await decryptDeviceKey(pending.encrypted, passphrase); } catch { throw new Error('That passphrase does not unlock the new device key saved in this browser.'); }
   if (!keyMatches(newKey, rotation.newAddress)) throw new Error('The saved key does not match this replacement.');
   await finishRotation(wallet.address, recoveryKey.trim() as Hex, rotation, setBusy);
   setBusy('Opening your wallet…');
   await connectExistingWallet(wallet.address, newKey, passphrase);
   clearPendingDeviceKey(wallet.address);
   void navigate({ to: '/app' });
  } catch (e) { setError(e instanceof Error ? e.message : 'Could not finish the replacement.'); setBusy(''); }
 }

 async function cancel() {
  if (!wallet || !rotation || !keyOk) { setError('Enter your recovery key to cancel.'); return; }
  setBusy('Cancelling…'); setError('');
  try { await cancelRotation(wallet.address, recoveryKey.trim() as Hex, rotation.id); clearPendingDeviceKey(wallet.address); setRotation(null); setDone('Cancelled. Your current device key stays in place.'); }
  catch (e) { setError(e instanceof Error ? e.message : 'Could not cancel.'); } finally { setBusy(''); }
 }

 return <div className="rule-builder"><div className="rc-recover-head"><span className="rules-aside-icon"><KeyRound size={18}/></span><div><h2>Replace your device key</h2><p>Use your recovery key to give your account a new device key in this browser. It finishes after a 48-hour wait, during which your old device key can cancel it.</p></div></div>
  <label className="builder-field"><span>Smart account address</span><input className="builder-input font-mono" spellCheck={false} placeholder="0x…" value={address} onChange={e => void load(e.target.value.trim())}/></label>
  {wallet && <label className="builder-field"><span>Recovery key (Shard C)</span><input className="builder-input font-mono" type="password" autoComplete="off" spellCheck={false} placeholder="0x…" value={recoveryKey} onChange={e => { setRecoveryKey(e.target.value.trim()); setError(''); }}/></label>}
  {wallet && recoveryKey && !keyOk && <p className="builder-hint text-red-500">This key does not match the recovery key for that account.</p>}

  {wallet && !rotation && <>
   <p className="builder-hint">Choose a passphrase for the new device key. You will need it to finish in 48 hours, and to unlock Veilora afterwards.</p>
   <div className="builder-row"><label className="builder-field"><span>New passphrase</span><input className="builder-input" type="password" autoComplete="new-password" value={passphrase} onChange={e => setPassphrase(e.target.value)}/></label><label className="builder-field"><span>Confirm</span><input className="builder-input" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)}/></label></div>
   <p className="builder-hint">If your device might be in someone else’s hands, freeze with your recovery key first. The replacement can still finish while that freeze is on.</p>
   <button className="wallet-primary-button" disabled={!keyOk || !passphrase || !!busy} onClick={() => void start()}>{busy ? <><Loader2 size={16} className="animate-spin"/>{busy}</> : 'Start replacement'}</button>
  </>}

  {wallet && rotation && <div className="rotation-card pending wallet-panel">
   <span className="rotation-timer"><Clock size={12}/>{rotation.ready ? 'Ready' : timeUntil(rotation.maturesAt)}</span>
   <div className="min-w-0 flex-1"><strong>Device key replacement pending</strong>
    <small>{rotation.ready ? 'The wait is over. Finish it below.' : `Can finish in ${timeUntil(rotation.maturesAt)}.`}</small>
    <p>{pendingHere ? 'Your new device key is saved in this browser.' : 'This replacement was started in another browser, which holds the new device key. Finish it there, or cancel it here and start again.'}</p></div>
  </div>}
  {wallet && rotation && rotation.ready && pendingHere && <>
   <label className="builder-field"><span>Passphrase for the new device key</span><input className="builder-input" type="password" autoComplete="current-password" value={passphrase} onChange={e => setPassphrase(e.target.value)}/></label>
   <button className="wallet-primary-button" disabled={!keyOk || !passphrase || !!busy} onClick={() => void finish()}>{busy ? <><Loader2 size={16} className="animate-spin"/>{busy}</> : 'Finish and open wallet'}</button>
  </>}
  {wallet && rotation && <button className="rule-button danger justify-center" disabled={!keyOk || !!busy} onClick={() => void cancel()}><X size={14}/>Cancel this replacement</button>}

  {error && <p role="alert" className="wallet-error">{error}</p>}{done && <div className="wallet-notice" role="status">{done}</div>}
 </div>;
}
