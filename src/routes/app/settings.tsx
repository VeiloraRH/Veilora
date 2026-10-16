import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Eye, EyeOff, Fingerprint, Lock, RotateCcw, Server, ShieldAlert } from 'lucide-react';
import { enrollPasskey, getPasskeyRecord, passkeyUnlockAvailable, removePasskeyRecord } from '@/lib/passkeyUnlock';
import { setPrivacyMode, usePrivacyMode } from '@/lib/privacyMode';
import { setHideWhenAway, useHideWhenAway } from '@/lib/awayCover';
import { IDLE_CHOICES, saveAutoLockSettings, useAutoLockSettings } from '@/lib/autoLock';
import { PageTitle } from '@/components/wallet/WalletUI';
import { CompletionDialog, type CompletionNotice } from '@/components/app/CompletionDialog';
import { useWallet } from '@/lib/walletContext';
import { clearRpcOverride, getRpcOverride, saveRpcOverride, verifyRpcEndpoint } from '@/lib/rpcSettings';

export const Route = createFileRoute('/app/settings')({ component: SettingsScreen });

function SettingsScreen() {
  const { walletAddress, lockDeviceKey, getStoredDeviceKey } = useWallet();
  const [passkey, setPasskey] = useState(() => getPasskeyRecord(walletAddress));
  const [passkeySupported, setPasskeySupported] = useState<boolean | null>(null);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyError, setPasskeyError] = useState('');
  useEffect(() => { void passkeyUnlockAvailable().then(setPasskeySupported); }, []);
  useEffect(() => setPasskey(getPasskeyRecord(walletAddress)), [walletAddress]);
  async function enablePasskey() {
    const key = getStoredDeviceKey();
    if (!key) { setPasskeyError('Unlock your device key first.'); return; }
    setPasskeyBusy(true); setPasskeyError('');
    try {
      setPasskey(await enrollPasskey(walletAddress, key));
      setCompletion({ title: 'Face ID / Touch ID is on', description: 'Next time Veilora locks, unlock with your face, fingerprint or device PIN. Your passphrase still works.' });
    } catch (cause) {
      setPasskeyError(cause instanceof Error ? (cause.name === 'NotAllowedError' ? 'Setup was cancelled.' : cause.message) : 'Could not set up passkey unlock.');
    } finally { setPasskeyBusy(false); }
  }
  const cache = useQueryClient();
  const [rpcUrl, setRpcUrl] = useState(() => getRpcOverride());
  const [showUrl, setShowUrl] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [completion, setCompletion] = useState<CompletionNotice | null>(null);
  const usingCustomRpc = !!getRpcOverride();
  const privacy = usePrivacyMode();
  const hideWhenAway = useHideWhenAway();
  const autoLock = useAutoLockSettings();

  function refreshChainData() {
    void cache.invalidateQueries({ queryKey: ['holdings', walletAddress] });
    void cache.invalidateQueries({ queryKey: ['portfolio-value'] });
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      const verifiedUrl = await verifyRpcEndpoint(rpcUrl);
      saveRpcOverride(verifiedUrl);
      setRpcUrl(verifiedUrl);
      refreshChainData();
      setCompletion({ title: 'Your RPC is connected', description: 'Browser-side balances, contract reads, and swap quotes will now use your Robinhood Chain endpoint.' });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not verify this RPC endpoint.');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    clearRpcOverride();
    setRpcUrl('');
    setError('');
    refreshChainData();
    setCompletion({ title: 'Veilora gateway restored', description: 'Browser-side chain requests are using Veilora’s default gateway again.' });
  }

  return <>
    <PageTitle title="Settings" description="Tune how Veilora connects to Robinhood Chain and what it shows on screen." />
    <section className="wallet-panel wallet-settings-card">
      <div className="wallet-settings-heading"><span>{privacy ? <EyeOff size={20}/> : <Eye size={20}/>}</span><div><h2>Privacy mode</h2><p>Hide balances and amounts across Veilora, for screen sharing, screenshots and using your wallet in public.</p></div><button role="switch" aria-checked={privacy} aria-label="Privacy mode" className={`wallet-toggle-switch ${privacy ? 'on' : ''}`} onClick={() => setPrivacyMode(!privacy)}><span/></button></div>
      <ul className="wallet-privacy-points"><li>Balances, holdings, history amounts, rule runs and transaction previews show •••• instead.</li><li>Tap any hidden amount to show it for 5 seconds.</li><li>Saved on this device only. It changes what is shown on screen; your balances are still public on Robinhood Chain.</li></ul>
      <div className="wallet-settings-row"><div><strong>Hide when away</strong><p>Cover the wallet whenever this tab is hidden or the window loses focus, so balances don’t show in tab previews, the app switcher or a screen share. It lifts as soon as you come back.</p></div><button role="switch" aria-checked={hideWhenAway} aria-label="Hide when away" className={`wallet-toggle-switch ${hideWhenAway ? 'on' : ''}`} onClick={() => setHideWhenAway(!hideWhenAway)}><span/></button></div>
    </section>
    <section className="wallet-panel wallet-settings-card">
      <div className="wallet-settings-heading"><span><Fingerprint size={20}/></span><div><h2>Face ID / Touch ID unlock</h2><p>Unlock your device key with a passkey (Face ID, Touch ID, Windows Hello or your device PIN) instead of typing your passphrase.</p></div><span className={`wallet-status ${passkey ? 'confirmed' : 'pending'}`}>{passkey ? 'On' : 'Off'}</span></div>
      {passkeySupported === false && !passkey && <div className="wallet-settings-note"><ShieldAlert size={16}/><p>This browser or device has no passkey with Face ID, Touch ID or a PIN. Keep using your passphrase.</p></div>}
      {passkeyError && <p className="wallet-error" role="alert">{passkeyError}</p>}
      <div className="wallet-settings-actions">{passkey
        ? <button className="wallet-soft-button" onClick={() => { removePasskeyRecord(walletAddress); setPasskey(null); }}>Turn off</button>
        : <button className="wallet-primary-button" disabled={passkeyBusy || passkeySupported === false} onClick={() => void enablePasskey()}>{passkeyBusy ? 'Waiting for your passkey…' : <><Fingerprint size={15}/> Set up Face ID / Touch ID</>}</button>}</div>
      <ul className="wallet-privacy-points"><li>Your passkey unlocks an encrypted copy of the device key stored only in this browser. Nothing is sent to Veilora.</li><li>Your passphrase keeps working, and is still needed on other browsers.</li>{passkey && <li>Set up on {new Date(passkey.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}. Turning it off removes the copy here; you can also delete the passkey in your device settings.</li>}</ul>
    </section>
    <section className="wallet-panel wallet-settings-card">
      <div className="wallet-settings-heading"><span><Lock size={20}/></span><div><h2>Auto-lock</h2><p>Clear your device key from memory when you step away. Unlocking again needs your passphrase.</p></div><span className={`wallet-status ${autoLock.idleMinutes ? 'confirmed' : 'pending'}`}>{autoLock.idleMinutes ? `${autoLock.idleMinutes} min` : 'Off'}</span></div>
      <label className="wallet-settings-field"><span>Lock after no activity for</span><select className="wallet-select" value={autoLock.idleMinutes} onChange={event => saveAutoLockSettings({ idleMinutes: Number(event.target.value) })}>{IDLE_CHOICES.map(m => <option key={m} value={m}>{m === 0 ? 'Never (not recommended)' : m === 60 ? '1 hour' : `${m} minutes`}</option>)}</select></label>
      <div className="wallet-settings-row"><div><strong>Lock when I leave the tab</strong><p>Locks once Veilora has been in the background for a minute.</p></div><button role="switch" aria-checked={autoLock.lockWhenHidden} aria-label="Lock when I leave the tab" className={`wallet-toggle-switch ${autoLock.lockWhenHidden ? 'on' : ''}`} onClick={() => saveAutoLockSettings({ lockWhenHidden: !autoLock.lockWhenHidden })}><span/></button></div>
      <div className="wallet-settings-actions"><button className="wallet-soft-button" onClick={() => lockDeviceKey('manual')}><Lock size={15}/> Lock now</button></div>
      {autoLock.idleMinutes === 0 && <div className="wallet-settings-note"><ShieldAlert size={16}/><p>With auto-lock off, anyone with access to this unlocked browser can sign with your device key until you close the tab.</p></div>}
    </section>
    <section className="wallet-panel wallet-settings-card">
      <div className="wallet-settings-heading"><span><Server size={20}/></span><div><h2>Use your own node</h2><p>Connect browser-side chain reads to your Robinhood Chain RPC provider.</p></div><span className={`wallet-status ${usingCustomRpc ? 'confirmed' : 'pending'}`}>{usingCustomRpc ? 'Custom RPC' : 'Veilora gateway'}</span></div>
      <label className="wallet-settings-field"><span>Robinhood Chain RPC URL</span><div className="wallet-settings-input"><input type={showUrl ? 'text' : 'password'} value={rpcUrl} onChange={event => setRpcUrl(event.target.value)} placeholder="https://your-provider.example/rpc/…" autoComplete="off" spellCheck={false} aria-label="Robinhood Chain RPC URL"/><button type="button" className="wallet-icon-button" aria-label={showUrl ? 'Hide RPC URL' : 'Show RPC URL'} onClick={() => setShowUrl(value => !value)}>{showUrl ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></label>
      {error && <p className="wallet-error" role="alert">{error}</p>}
      <div className="wallet-settings-actions"><button className="wallet-primary-button" disabled={busy || !rpcUrl.trim()} onClick={() => void save()}>{busy ? 'Checking endpoint…' : <><Check size={15}/> Verify and save</>}</button>{usingCustomRpc && <button className="wallet-soft-button" disabled={busy} onClick={reset}><RotateCcw size={15}/>Use Veilora gateway</button>}</div>
      <div className="wallet-settings-note"><ShieldAlert size={16}/><p>Your endpoint is saved in this browser’s local storage. It is not encrypted, and may include a provider API key. Anyone with access to this browser can read it. Your provider can see your IP address and RPC requests. Veilora’s backend relayer still submits signed transactions; transaction history continues to come from the explorer service.</p></div>
    </section>
    <CompletionDialog notice={completion} onClose={() => setCompletion(null)} />
  </>;
}
