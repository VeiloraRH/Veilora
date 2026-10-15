import { useRef, useState } from 'react';
import { Download, FileLock2, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CompletionDialog, type CompletionNotice } from '@/components/app/CompletionDialog';
import { getWalletContacts, saveWalletContacts } from '@/lib/contacts';
import { getBlockedAddresses, notifyBlocklistChanged, saveBlockedAddresses } from '@/lib/addressBlocklist';
import { createAddressBookBackup, openAddressBookBackup, type AddressBookData } from '@/lib/addressBookBackup';
import { useWallet } from '@/lib/walletContext';

type Mode = 'export' | 'import' | null;

export function AddressBookBackup() {
  const { walletAddress } = useWallet();
  const fileInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<AddressBookData | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<CompletionNotice | null>(null);

  function closeDialog() {
    setMode(null); setFile(null); setPreview(null); setPassphrase(''); setConfirmation(''); setError(''); setBusy(false);
  }

  async function exportBackup() {
    setError('');
    if (passphrase.length < 12) { setError('Use a backup passphrase with at least 12 characters.'); return; }
    if (passphrase !== confirmation) { setError('The passphrases do not match.'); return; }
    setBusy(true);
    try {
      const encrypted = await createAddressBookBackup(walletAddress, {
        contacts: getWalletContacts(walletAddress),
        blockedAddresses: getBlockedAddresses(walletAddress),
      }, passphrase);
      const url = URL.createObjectURL(new Blob([encrypted], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `veilora-address-book-${walletAddress.toLowerCase()}.json`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      closeDialog();
      setNotice({ title: 'Encrypted address book downloaded', description: 'Keep the file and its passphrase somewhere safe. Veilora cannot recover either one.' });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create the encrypted backup.'); }
    finally { setBusy(false); }
  }

  async function unlockBackup() {
    if (!file) return;
    setError(''); setBusy(true);
    try {
      const contents = await file.text();
      setPreview(await openAddressBookBackup(contents, walletAddress, passphrase));
      setPassphrase('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not open this backup.'); }
    finally { setBusy(false); }
  }

  function restoreBackup() {
    if (!preview) return;
    setError(''); setBusy(true);
    const contactsKey = `veilora:contacts:${walletAddress.toLowerCase()}`;
    const blocklistKey = `veilora:address-blocklist:${walletAddress.toLowerCase()}`;
    let oldContacts: string | null = null;
    let oldBlocked: string | null = null;
    try {
      oldContacts = localStorage.getItem(contactsKey);
      oldBlocked = localStorage.getItem(blocklistKey);
      saveBlockedAddresses(walletAddress, preview.blockedAddresses);
      saveWalletContacts(walletAddress, preview.contacts);
      const restored = preview;
      closeDialog();
      setNotice({ title: 'Address book restored', description: `Restored ${restored.contacts.length} contacts and ${restored.blockedAddresses.length} blocked addresses to this browser.` });
    } catch (cause) {
      try {
        if (oldBlocked === null) localStorage.removeItem(blocklistKey); else localStorage.setItem(blocklistKey, oldBlocked);
        if (oldContacts === null) localStorage.removeItem(contactsKey); else localStorage.setItem(contactsKey, oldContacts);
        notifyBlocklistChanged(walletAddress);
      } catch { /* The original storage error is more useful than a failed rollback. */ }
      setError(cause instanceof Error ? cause.message : 'Could not restore these lists.');
    } finally { setBusy(false); }
  }

  return <>
    <section className="rc-section">
      <div className="wallet-section-heading"><h2>Address book backup</h2></div>
      <div className="wallet-panel wallet-address-backup">
        <div className="wallet-blocklist-intro"><span><FileLock2 size={18}/></span><div><strong>Take your personal lists with you</strong><p>Download an encrypted file with this wallet’s saved contacts and blocked addresses. It contains no keys, and Veilora never receives the file or passphrase.</p></div></div>
        <div className="wallet-address-backup-actions"><button className="rule-button" onClick={() => { setMode('export'); setError(''); }}><Download size={14}/>Download encrypted backup</button><button className="rule-button" onClick={() => fileInput.current?.click()}><Upload size={14}/>Restore from backup</button></div>
        <input ref={fileInput} className="sr-only" type="file" accept=".json,application/json" aria-label="Choose Veilora address book backup" onChange={(event) => {
          const selected = event.target.files?.[0] ?? null;
          event.target.value = '';
          if (!selected) return;
          if (selected.size > 1_000_000) { setNotice({ title: 'Backup file too large', description: 'Choose a Veilora address book backup smaller than 1 MB.' }); return; }
          setFile(selected); setMode('import'); setPreview(null); setPassphrase(''); setError('');
        }}/>
      </div>
    </section>
    <Dialog open={mode !== null} onOpenChange={(open) => { if (!open && !busy) closeDialog(); }}>
      <DialogContent className="wallet-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'export' ? 'Create an encrypted backup' : 'Restore your address book'}</DialogTitle>
          <DialogDescription>{mode === 'export' ? 'Choose a passphrase you can keep separately from the backup file. It must be at least 12 characters.' : `Selected file: ${file?.name ?? '—'}. Enter its passphrase to inspect the contents.`}</DialogDescription>
        </DialogHeader>
        {mode === 'export' ? <div className="grid gap-3">
          <label className="wallet-settings-field"><span>Backup passphrase</span><input className="wallet-settings-address" type="password" autoComplete="new-password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} /></label>
          <label className="wallet-settings-field"><span>Confirm passphrase</span><input className="wallet-settings-address" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
          <p className="rc-muted">Encryption runs in this browser using PBKDF2 and AES-256-GCM. If you lose the passphrase, the backup cannot be opened.</p>
          <button className="wallet-primary-button" disabled={busy} onClick={() => void exportBackup()}>{busy ? 'Encrypting…' : 'Download backup'}</button>
        </div> : preview ? <div className="grid gap-4">
          <div className="rounded-xl border p-4 text-sm"><p><strong>{preview.contacts.length}</strong> saved contacts</p><p className="mt-1"><strong>{preview.blockedAddresses.length}</strong> blocked addresses</p></div>
          <p className="rc-muted">Restoring replaces the current contacts and blocked addresses for this wallet in this browser. Wallet keys and funds are not included.</p>
          {error && <p role="alert" className="wallet-error">{error}</p>}
          <button className="wallet-primary-button" disabled={busy} onClick={restoreBackup}>{busy ? 'Restoring…' : 'Replace lists and restore'}</button>
        </div> : <div className="grid gap-3">
          <label className="wallet-settings-field"><span>Backup passphrase</span><input className="wallet-settings-address" type="password" autoComplete="current-password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} /></label>
          {error && <p role="alert" className="wallet-error">{error}</p>}
          <button className="wallet-primary-button" disabled={busy || !passphrase} onClick={() => void unlockBackup()}>{busy ? 'Checking backup…' : 'Unlock and preview'}</button>
        </div>}
      </DialogContent>
    </Dialog>
    <CompletionDialog notice={notice} onClose={() => setNotice(null)}/>
  </>;
}
