import { useEffect, useState } from 'react';
import { UserPlus, Wallet } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/lib/walletContext';
import { shortAddress } from '@/components/wallet/WalletUI';

export type AccountAction = null | { kind: 'add' } | { kind: 'switch'; address: string };

/** Confirms adding or switching accounts on this device; both reload the app locked. */
export function AccountDialog({ action, onClose }: { action: AccountAction; onClose: () => void }) {
 const { walletAddress, addAnotherAccount, switchAccount } = useWallet();
 const [error, setError] = useState('');
 useEffect(() => setError(''), [action]);
 const adding = action?.kind === 'add';
 function confirm() {
  try { if (action?.kind === 'add') addAnotherAccount(); else if (action?.kind === 'switch') switchAccount(action.address); }
  catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not change accounts.'); }
 }
 return <Dialog open={!!action} onOpenChange={open => { if (!open) onClose(); }}>
  <DialogContent className="wallet-dialog sm:max-w-md">
   <DialogHeader><div className="flex items-center gap-3">
    <span className="rounded-xl bg-blue-500/10 p-3 text-blue-500">{adding ? <UserPlus size={20}/> : <Wallet size={20}/>}</span>
    <div><DialogTitle>{adding ? 'Add another account' : `Switch to ${action?.kind === 'switch' ? shortAddress(action.address) : ''}`}</DialogTitle>
     <DialogDescription className="mt-1">Accounts on this device</DialogDescription></div>
   </div></DialogHeader>
   <ul className="space-y-2 text-xs leading-5 text-muted-foreground">
    <li><strong className="font-medium text-foreground">{shortAddress(walletAddress)} stays on this device.</strong> Switch back any time from the account menu.</li>
    <li>Each account has its own device key, passphrase and recovery key, and its own contacts, lists and history on this device.</li>
    <li>{adding ? 'Next you can create a new account or import one you already have.' : 'The app reloads locked. Unlock with that account’s passphrase.'}</li>
   </ul>
   {error && <p role="alert" className="rounded-xl bg-red-500/5 p-3 text-xs text-red-500">{error}</p>}
   <div className="flex gap-3">
    <Button variant="outline" className="h-11 flex-1 rounded-xl" onClick={onClose}>Cancel</Button>
    <Button className="h-11 flex-1 rounded-xl" onClick={confirm}>{adding ? 'Continue' : 'Switch account'}</Button>
   </div>
  </DialogContent>
 </Dialog>;
}
