import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Clock, Copy, Fingerprint, KeyRound, Laptop, Loader2, X } from 'lucide-react';
import type { Hex } from 'viem';
import { generatePrivateKey, privateKeyToAddress } from 'viem/accounts';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { shortAddress } from '@/components/wallet/WalletUI';
import { useWallet } from '@/lib/walletContext';
import { cancelRotation, finishRotation, requestRotation, timeUntil, useRotations, type KeyRotation } from '@/lib/rotationsApi';

const label = (r: KeyRotation) => (r.kind === 'device' ? 'Device key replacement' : 'Recovery key replacement');

/** Pending and recent key replacements, with cancel and finish. */
export function KeyRotationPanel({ wallet, onChanged }: { wallet: string; onChanged: (message: string, title?: string) => void }) {
 const { getStoredDeviceKey, refresh } = useWallet(); const rotations = useRotations(wallet); const cache = useQueryClient();
 const [busy, setBusy] = useState(''); const [error, setError] = useState('');
 const list = (rotations.data?.rotations ?? []).filter(r => r.status === 'pending' || (r.resolvedAt && Date.now() - Date.parse(r.resolvedAt) < 7 * 86_400_000));
 if (!list.length) return null;
 const settle = () => { void cache.invalidateQueries({ queryKey: ['rotations'] }); void cache.invalidateQueries({ queryKey: ['quorum'] }); void refresh(); };
 async function cancel(r: KeyRotation) {
  const key = getStoredDeviceKey(); if (!key) { setError('Unlock your device key to cancel here, or cancel with your recovery key on the recover page.'); return; }
  setBusy(`cancel-${r.id}`); setError('');
  try { await cancelRotation(wallet, key as Hex, r.id); settle(); onChanged('The pending key replacement was cancelled. Your current keys stay in place.', 'Replacement cancelled'); }
  catch (e) { setError(e instanceof Error ? e.message : 'Could not cancel.'); } finally { setBusy(''); }
 }
 async function finish(r: KeyRotation) {
  const key = getStoredDeviceKey(); if (!key) { setError('Unlock your device key first.'); return; }
  setError('');
  try { await finishRotation(wallet, key as Hex, r, setBusy); settle(); onChanged('Your account now uses the new recovery key. The old one can no longer sign or freeze your account.', 'Recovery key replaced'); }
  catch (e) { setError(e instanceof Error ? e.message : 'Could not finish the replacement.'); } finally { setBusy(''); }
 }
 return <section className="rc-section"><div className="wallet-section-heading"><h2>Key replacements</h2></div>
  {error && <p role="alert" className="wallet-error mb-3">{error}</p>}
  <div className="rules-stack">{list.map(r => <article key={r.id} className={`wallet-panel rotation-card ${r.status}`}>
   <span className={`rc-shard-icon ${r.kind === 'device' ? 'sA' : 'sC'}`}>{r.kind === 'device' ? <Laptop size={18}/> : <Fingerprint size={18}/>}</span>
   <div className="min-w-0 flex-1"><strong>{label(r)}</strong>
    <small>{r.status === 'pending' ? (r.ready ? `Ready to finish · new key ${shortAddress(r.newAddress)}` : `Can finish in ${timeUntil(r.maturesAt)} · new key ${shortAddress(r.newAddress)}`) : r.status === 'completed' ? `Completed · new key ${shortAddress(r.newAddress)}` : r.status === 'cancelled' ? `Cancelled with the ${r.cancelledBy === 'device' ? 'device key' : 'recovery key'}` : 'Expired before it was finished'}</small>
    {r.status === 'pending' && <p>{r.kind === 'device' ? 'Requested with your recovery key. If you still have this device and didn’t ask for it, cancel now.' : 'Requested with your device key. If you didn’t ask for it, cancel now.'}</p>}</div>
   {r.status === 'pending' && <div className="rotation-actions">
    {r.kind === 'recovery' && r.ready && <button className="wallet-primary-button !w-auto !px-4 !py-2.5" disabled={!!busy} onClick={() => void finish(r)}>{busy && !busy.startsWith('cancel') ? <><Loader2 size={14} className="animate-spin"/>{busy}</> : 'Finish'}</button>}
    {r.kind === 'device' && r.ready && <span className="rotation-hint">Finish it on the recover page with your recovery key.</span>}
    <button className="rule-button danger" disabled={!!busy} onClick={() => void cancel(r)}>{busy === `cancel-${r.id}` ? <Loader2 size={14} className="animate-spin"/> : <X size={14}/>}Cancel</button>
   </div>}
   {r.status === 'pending' && !r.ready && <span className="rotation-timer"><Clock size={12}/>{timeUntil(r.maturesAt)}</span>}
  </article>)}</div></section>;
}

/** Generate a new recovery key here, show it once, and request the replacement with the device key. */
export function ReplaceRecoveryKeyDialog({ wallet, onClose, onDone }: { wallet: string; onClose: () => void; onDone: (message: string, title?: string) => void }) {
 const { getStoredDeviceKey } = useWallet(); const cache = useQueryClient();
 const [newKey] = useState(() => generatePrivateKey()); const [revealed, setRevealed] = useState(false); const [copied, setCopied] = useState(false); const [saved, setSaved] = useState(false);
 const [busy, setBusy] = useState(false); const [error, setError] = useState('');
 async function submit() {
  const key = getStoredDeviceKey(); if (!key) { setError('Unlock your device key first.'); return; }
  setBusy(true); setError('');
  try {
   const r = await requestRotation(wallet, key as Hex, 'recovery', privateKeyToAddress(newKey));
   void cache.invalidateQueries({ queryKey: ['rotations'] });
   onDone(`After ${timeUntil(r.maturesAt)}, come back here and tap Finish. Until then your old recovery key still works, and can cancel this.`, 'Recovery key replacement started');
  } catch (e) { setError(e instanceof Error ? e.message : 'Could not start the replacement.'); } finally { setBusy(false); }
 }
 return <Dialog open onOpenChange={v => { if (!v && !busy) onClose(); }}><DialogContent className="wallet-dialog rule-builder sm:max-w-md"><DialogHeader><DialogTitle>Replace your recovery key</DialogTitle><DialogDescription>A new recovery key was created in this browser. Save it now: it is shown only once and never sent to Veilora.</DialogDescription></DialogHeader>
  <div className="rc-secret">{revealed ? newKey : '•'.repeat(32)}</div>
  <div className="review-actions"><button className="rule-button" onClick={() => setRevealed(!revealed)}><KeyRound size={14}/>{revealed ? 'Hide' : 'Reveal'}</button><button className="rule-button" onClick={() => void navigator.clipboard.writeText(newKey).then(() => setCopied(true))}>{copied ? <Check size={14}/> : <Copy size={14}/>}{copied ? 'Copied' : 'Copy'}</button></div>
  <label className="recipient-ack !bg-transparent !text-current"><input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)}/><span>I saved this new recovery key somewhere safe and offline.</span></label>
  <ul className="review-risks"><li>The change finishes after a 48-hour wait. Your current recovery key keeps working until then, and can cancel it.</li><li>When it finishes, the old recovery key can no longer sign, freeze or unfreeze your account.</li></ul>
  {error && <p role="alert" className="wallet-error">{error}</p>}
  <button className="wallet-primary-button" disabled={!saved || busy} onClick={() => void submit()}>{busy ? <><Loader2 size={16} className="animate-spin"/>Signing…</> : 'Start replacement'}</button>
 </DialogContent></Dialog>;
}
