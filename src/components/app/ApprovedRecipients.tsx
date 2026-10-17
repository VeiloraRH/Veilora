import { useState, type FormEvent } from 'react';
import { Check, CircleHelp, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { getAddress, isAddress, zeroAddress } from 'viem';
import { CompletionDialog, type CompletionNotice } from '@/components/app/CompletionDialog';
import { shortAddress } from '@/components/wallet/WalletUI';
import { useWallet } from '@/lib/walletContext';
import { saveApprovedRecipientPolicy, saveApprovedRecipients, useWalletApprovedRecipients } from '@/lib/approvedRecipients';

export function ApprovedRecipients() {
  const { walletAddress } = useWallet();
  const { entries, policy } = useWalletApprovedRecipients(walletAddress);
  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<CompletionNotice | null>(null);

  function add(event: FormEvent) {
    event.preventDefault();
    if (!isAddress(address.trim()) || address.trim().toLowerCase() === zeroAddress) { setError('Enter a valid, non-zero EVM address.'); return; }
    if (!label.trim()) { setError('Give this recipient a name so you can recognize it.'); return; }
    try {
      const normalized = getAddress(address.trim());
      saveApprovedRecipients(walletAddress, [...entries.filter((entry) => entry.address.toLowerCase() !== normalized.toLowerCase()), { address: normalized, label: label.trim(), addedAt: Date.now() }]);
      setAddress(''); setLabel(''); setError('');
      setNotice({ title: 'Recipient approved', description: `${label.trim()} can now receive transfers when approved-recipient mode is on.` });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save this approval on your device.'); }
  }

  function toggleRequired() {
    try {
      saveApprovedRecipientPolicy(walletAddress, { requireApproval: !policy.requireApproval });
      setNotice({
        title: policy.requireApproval ? 'Approved-recipient mode off' : 'Approved-recipient mode on',
        description: policy.requireApproval
          ? 'Send and Bridge can now use any valid destination, with the usual recipient checks.'
          : entries.length
            ? 'Send and Bridge will now stop at review unless the destination is on this device’s approved list.'
            : 'No addresses are approved yet, so Send and Bridge will be blocked until you add a destination.',
      });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update this setting.'); }
  }

  function remove(addressToRemove: string) {
    try {
      saveApprovedRecipients(walletAddress, entries.filter((entry) => entry.address.toLowerCase() !== addressToRemove.toLowerCase()));
      setNotice({ title: 'Approval removed', description: 'This address can no longer receive transfers while approved-recipient mode is on.' });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not remove this approval.'); }
  }

  return <>
    <section className="rc-section">
      <div className="wallet-section-heading"><h2>Approved recipients</h2><span className="wallet-count">{entries.length} / 100</span></div>
      <div className="wallet-panel wallet-blocklist-card">
        <div className="wallet-blocklist-intro"><span className="approved-recipient-icon"><ShieldCheck size={18}/></span><div><strong>Only send to destinations you approve</strong><p>The list and setting stay in this browser for this wallet. This is an app-side check for Send and Bridge; it does not change the co-signer policy or on-chain account rules.</p></div></div>
        <div className="approved-recipient-toggle">
          <div><strong>Require an approved recipient</strong><p>{policy.requireApproval ? 'Unknown destinations are blocked before transaction review.' : 'Any valid destination can be used after the usual safety checks.'}</p></div>
          <button type="button" role="switch" aria-checked={policy.requireApproval} aria-label="Require an approved recipient" className={`approved-recipient-switch ${policy.requireApproval ? 'on' : ''}`} onClick={toggleRequired}><span/></button>
        </div>
        {policy.requireApproval && entries.length === 0 && <p className="wallet-error mt-3" role="status"><CircleHelp size={14}/>Add at least one recipient before sending or bridging.</p>}
        <form className="wallet-blocklist-form" onSubmit={add}>
          <label className="wallet-settings-field"><span>Wallet address</span><input className="wallet-settings-address" aria-label="Approved recipient address" value={address} onChange={(event) => { setAddress(event.target.value.trim()); setError(''); }} placeholder="0x…" autoComplete="off" spellCheck={false}/></label>
          <label className="wallet-settings-field"><span>Name</span><input className="wallet-settings-address approved-recipient-label" aria-label="Approved recipient name" value={label} onChange={(event) => { setLabel(event.target.value); setError(''); }} placeholder="e.g. My Base wallet" maxLength={60}/></label>
          <button className="rule-button" type="submit" disabled={!address || !label.trim() || entries.length >= 100}><Plus size={14}/>Approve</button>
        </form>
        {error && <p className="wallet-error" role="alert">{error}</p>}
        <ul className="wallet-blocklist-list">
          {entries.length === 0 ? <li className="wallet-blocklist-empty">No approved recipients saved on this device.</li> : entries.map((entry) => <li key={entry.address}><span className="approved-recipient-details"><strong>{entry.label}</strong><code title={entry.address}>{shortAddress(entry.address)}</code></span><button className="rule-button danger" onClick={() => remove(entry.address)} aria-label={`Remove approval for ${entry.label}`}><Trash2 size={14}/>Remove</button></li>)}
        </ul>
        <p className="approved-recipient-footnote"><Check size={12}/>The allowlist is local to this browser and is cleared when you disconnect this wallet.</p>
      </div>
    </section>
    <CompletionDialog notice={notice} onClose={() => setNotice(null)}/>
  </>;
}
