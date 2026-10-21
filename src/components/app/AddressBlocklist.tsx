import { useState, type FormEvent } from 'react';
import { Ban, Trash2 } from 'lucide-react';
import { getAddress, isAddress, zeroAddress } from 'viem';
import { CompletionDialog, type CompletionNotice } from '@/components/app/CompletionDialog';
import { shortAddress } from '@/components/wallet/WalletUI';
import { useWallet } from '@/lib/walletContext';
import { MAX_BLOCK_REASON, getBlockReasons, saveBlockReason, saveBlockedAddresses, useWalletBlocklist } from '@/lib/addressBlocklist';

export function AddressBlocklist() {
  const { walletAddress } = useWallet();
  const addresses = useWalletBlocklist(walletAddress);
  const [input, setInput] = useState('');
  const [reason, setReason] = useState('');
  const reasons = getBlockReasons(walletAddress);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<CompletionNotice | null>(null);

  function add(event: FormEvent) {
    event.preventDefault();
    const value = input.trim();
    if (!isAddress(value) || value.toLowerCase() === zeroAddress) { setError('Enter a valid, non-zero EVM address.'); return; }
    const normalized = getAddress(value);
    if (addresses.some((address) => address.toLowerCase() === normalized.toLowerCase())) { setError('This address is already blocked.'); return; }
    try {
      saveBlockedAddresses(walletAddress, [...addresses, normalized]);
      if (reason.trim()) saveBlockReason(walletAddress, normalized, reason);
      setInput(''); setReason(''); setError('');
      setNotice({ title: 'Address blocked', description: 'Veilora will stop send and bridge reviews from proceeding to this address on this device.' });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save the blocklist on this device.'); }
  }

  function remove(address: string) {
    try {
      saveBlockedAddresses(walletAddress, addresses.filter((item) => item.toLowerCase() !== address.toLowerCase()));
      setNotice({ title: 'Address unblocked', description: 'This address can be used again. Veilora will still show its usual recipient checks.' });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update the blocklist.'); }
  }

  return <>
    <section className="rc-section">
      <div className="wallet-section-heading"><h2>Blocked addresses</h2><span className="wallet-count">{addresses.length} / 100</span></div>
      <div className="wallet-panel wallet-blocklist-card">
        <div className="wallet-blocklist-intro"><span><Ban size={18}/></span><div><strong>Stop accidental payments</strong><p>Addresses are stored only in this browser for this wallet. Veilora blocks send and bridge reviews to listed addresses; unlisted addresses are not considered trusted.</p></div></div>
        <form className="wallet-blocklist-form" onSubmit={add}>
          <label className="wallet-settings-field"><span>Address to block</span><input className="wallet-settings-address" aria-label="Address to block" value={input} onChange={(event) => { setInput(event.target.value.trim()); setError(''); }} placeholder="0x…" autoComplete="off" spellCheck={false}/></label>
          <label className="wallet-settings-field"><span>Reason (optional)</span><input className="wallet-settings-address" aria-label="Reason for blocking" maxLength={MAX_BLOCK_REASON} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Scam DM on Telegram"/></label>
          <button className="rule-button" type="submit" disabled={!input || addresses.length >= 100}><Ban size={14}/>Block address</button>
        </form>
        {error && <p className="wallet-error" role="alert">{error}</p>}
        <ul className="wallet-blocklist-list">
          {addresses.length === 0 ? <li className="wallet-blocklist-empty">No blocked addresses. Add one above to prevent sending or bridging to it.</li> : addresses.map((address) => <li key={address}><span className="min-w-0"><code title={address}>{shortAddress(address)}</code>{reasons[address.toLowerCase()] && <span className="block truncate text-[11px] text-muted-foreground" title={reasons[address.toLowerCase()]}>{reasons[address.toLowerCase()]}</span>}</span><button className="rule-button danger" onClick={() => remove(address)} aria-label={`Unblock ${address}`}><Trash2 size={14}/>Unblock</button></li>)}
        </ul>
      </div>
    </section>
    <CompletionDialog notice={notice} onClose={() => setNotice(null)}/>
  </>;
}
