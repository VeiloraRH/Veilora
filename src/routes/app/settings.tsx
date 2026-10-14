import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Eye, EyeOff, RotateCcw, Server, ShieldAlert } from 'lucide-react';
import { setPrivacyMode, usePrivacyMode } from '@/lib/privacyMode';
import { PageTitle } from '@/components/wallet/WalletUI';
import { CompletionDialog, type CompletionNotice } from '@/components/app/CompletionDialog';
import { useWallet } from '@/lib/walletContext';
import { clearRpcOverride, getRpcOverride, saveRpcOverride, verifyRpcEndpoint } from '@/lib/rpcSettings';

export const Route = createFileRoute('/app/settings')({ component: SettingsScreen });

function SettingsScreen() {
  const { walletAddress } = useWallet();
  const cache = useQueryClient();
  const [rpcUrl, setRpcUrl] = useState(() => getRpcOverride());
  const [showUrl, setShowUrl] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [completion, setCompletion] = useState<CompletionNotice | null>(null);
  const usingCustomRpc = !!getRpcOverride();
  const privacy = usePrivacyMode();

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
