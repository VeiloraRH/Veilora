import { useEffect, useState, type FormEvent } from 'react';
import { ContactRound, Check, Pencil, Plus, Search, Star, Trash2, X } from 'lucide-react';
import { getAddress, isAddress, zeroAddress } from 'viem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MAX_CONTACT_NOTE, cleanContactNote, getWalletContacts, saveWalletContacts, searchContacts, toggleStarred, type WalletContact } from '@/lib/contacts';
import { shortAddress } from '@/components/wallet/WalletUI';

type ContactBookProps = {
  wallet: string;
  address: string;
  onSelect: (address: string) => void;
  label?: string;
};

export function ContactBook({ wallet, address, onSelect, label = 'Saved contacts' }: ContactBookProps) {
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState<WalletContact[]>([]);
  const [name, setName] = useState('');
  const [contactAddress, setContactAddress] = useState('');
  const [note, setNote] = useState('');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Loaded up front too, so the button shows the saved name for a typed address.
  useEffect(() => {
    setContacts(getWalletContacts(wallet));
  }, [open, wallet]);

  function persist(next: WalletContact[]) {
    try {
      saveWalletContacts(wallet, next);
      setContacts(next);
      setError('');
    } catch {
      setError('Could not save contacts in this browser. Check your available local storage.');
    }
  }

  function saveContact(event: FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedAddress = contactAddress.trim();
    if (!trimmedName || trimmedName.length > 40) { setError('Enter a contact name of up to 40 characters.'); return; }
    if (!isAddress(trimmedAddress) || trimmedAddress.toLowerCase() === zeroAddress) { setError('Enter a valid, non-zero EVM address.'); return; }
    const normalized = getAddress(trimmedAddress);
    const duplicate = contacts.find((contact) => contact.address.toLowerCase() === normalized.toLowerCase() && contact.id !== editing);
    if (duplicate) { setError(`This address is already saved as ${duplicate.name}.`); return; }
    const cleanNote = cleanContactNote(note);
    const next = editing
      ? contacts.map((contact) => contact.id === editing ? { id: contact.id, name: trimmedName, address: normalized, ...(cleanNote ? { note: cleanNote } : {}), ...(contact.starred ? { starred: true } : {}) } : contact)
      : [...contacts, { id: crypto.randomUUID(), name: trimmedName, address: normalized, ...(cleanNote ? { note: cleanNote } : {}) }];
    persist(next);
    setName(''); setContactAddress(''); setNote(''); setEditing(null);
  }

  function beginEdit(contact: WalletContact) {
    setEditing(contact.id); setName(contact.name); setContactAddress(contact.address); setNote(contact.note ?? ''); setError('');
  }

  const selected = contacts.find((contact) => contact.address.toLowerCase() === address.trim().toLowerCase());
  function openBook() {
    setContactAddress(address.trim());
    setName('');
    setNote('');
    setQuery('');
    setEditing(null);
    setError('');
    setOpen(true);
  }

  return <>
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl" onClick={openBook}><ContactRound size={15}/>{selected ? selected.name : label}</Button>
      {selected && <span className="text-xs text-muted-foreground">{shortAddress(selected.address)}</span>}
    </div>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="wallet-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Trusted contacts</DialogTitle>
          <DialogDescription>Saved in this browser for this wallet. Contact names, notes and addresses are never uploaded to Veilora.</DialogDescription>
        </DialogHeader>
        {contacts.length > 0 && <label className="relative block">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
          <Input aria-label="Search contacts" placeholder="Search by name, note or address" value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9"/>
        </label>}
        <div className="max-h-56 space-y-2 overflow-y-auto">
          {contacts.length === 0 && <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">No saved contacts yet.</p>}
          {contacts.length > 0 && searchContacts(contacts, query).length === 0 && <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">No contacts match “{query.trim()}”.</p>}
          {searchContacts(contacts, query).map((contact) => <div key={contact.id} className="flex items-center gap-2 rounded-xl border p-3">
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => { onSelect(contact.address); setOpen(false); }}>
              <span className="block truncate text-sm font-medium">{contact.name}</span>
              {contact.note && <span className="block truncate text-xs text-muted-foreground" title={contact.note}>{contact.note}</span>}
              <span className="block truncate font-mono text-xs text-muted-foreground">{contact.address}</span>
            </button>
            <Button type="button" variant="ghost" size="icon" aria-pressed={!!contact.starred} aria-label={contact.starred ? `Unstar ${contact.name}` : `Star ${contact.name} for quick pay`} onClick={() => { const next = toggleStarred(contacts, contact.id); if (next.error) setError(next.error); else persist(next.contacts); }}><Star size={15} className={contact.starred ? 'fill-amber-400 text-amber-500' : ''}/></Button>
            <Button type="button" variant="ghost" size="icon" aria-label={`Edit ${contact.name}`} onClick={() => beginEdit(contact)}><Pencil size={15}/></Button>
            <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${contact.name}`} onClick={() => persist(contacts.filter((item) => item.id !== contact.id))}><Trash2 size={15}/></Button>
          </div>)}
        </div>
        <form className="space-y-3 border-t pt-4" onSubmit={saveContact}>
          <p className="text-sm font-medium">{editing ? 'Edit contact' : 'Add a contact'}</p>
          <Input aria-label="Contact name" maxLength={40} placeholder="Name, e.g. Cold wallet" value={name} onChange={(event) => setName(event.target.value)} />
          <Input aria-label="Contact wallet address" className="font-mono text-xs" placeholder="0x wallet address" value={contactAddress} onChange={(event) => setContactAddress(event.target.value.trim())} />
          <Input aria-label="Contact note" maxLength={MAX_CONTACT_NOTE} placeholder="Note (optional), e.g. Pays rent monthly" value={note} onChange={(event) => setNote(event.target.value)} />
          {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            {editing && <Button type="button" variant="outline" onClick={() => { setEditing(null); setName(''); setContactAddress(''); setNote(''); setError(''); }}><X size={15}/>Cancel</Button>}
            <Button type="submit" className="flex-1">{editing ? <Check size={15}/> : <Plus size={15}/>} {editing ? 'Save changes' : 'Save contact'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
