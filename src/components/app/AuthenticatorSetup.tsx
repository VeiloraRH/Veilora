import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Loader2, Smartphone } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Hex } from 'viem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWallet } from '@/lib/walletContext';
import { authenticatorStatus, confirmAuthenticator, removeAuthenticator, startAuthenticatorSetup } from '@/lib/authenticatorApi';

/** Security page card: add an authenticator app whose codes can freeze the wallet from any device. */
export function AuthenticatorSetup() {
 const { walletAddress, getStoredDeviceKey } = useWallet();
 const key = getStoredDeviceKey() as Hex | null;
 const queryClient = useQueryClient();
 const status = useQuery({ queryKey: ['authenticator', walletAddress], enabled: !!key, queryFn: () => authenticatorStatus(walletAddress, key!) });
 const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
 const [removing, setRemoving] = useState(false);
 const [qr, setQr] = useState('');
 const [code, setCode] = useState('');
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');
 useEffect(() => { setQr(''); if (setup) void QRCode.toDataURL(setup.uri, { margin: 2, width: 200, color: { dark: '#202638', light: '#ffffff' } }).then(setQr).catch(() => {}); }, [setup]);

 async function run(action: () => Promise<unknown>) {
  setBusy(true); setError('');
  try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Something went wrong.'); } finally { setBusy(false); }
 }
 const begin = () => run(async () => { setSetup(await startAuthenticatorSetup(walletAddress, key!)); setCode(''); });
 const confirm = () => run(async () => { await confirmAuthenticator(walletAddress, key!, code); setSetup(null); setCode(''); await queryClient.invalidateQueries({ queryKey: ['authenticator', walletAddress] }); });
 const remove = () => run(async () => { await removeAuthenticator(walletAddress, key!, code); setRemoving(false); setCode(''); await queryClient.invalidateQueries({ queryKey: ['authenticator', walletAddress] }); });
 const codeInput = <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} className="h-11 max-w-40 rounded-xl text-center font-mono tracking-widest"/>;

 return <section className="wallet-panel space-y-4 p-6" aria-label="Authenticator app">
  <div className="flex items-start gap-3">
   <span className="rules-aside-icon"><Smartphone size={18}/></span>
   <div><h2 className="text-sm font-medium">Authenticator app</h2>
    <p className="mt-1 text-xs leading-5 text-muted-foreground">Freeze your account from any phone with a 6-digit code at veilorarh.com/recover, without your device or recovery key. A code can only freeze. Unfreezing still needs your recovery key.</p></div>
  </div>
  {!key ? <p className="text-xs text-muted-foreground">Unlock your device key to manage the authenticator.</p>
   : status.isPending ? <p className="text-xs text-muted-foreground">Checking…</p>
   : setup ? <div className="space-y-3">
    <p className="text-xs">Scan this with your authenticator app, or enter the key by hand, then type the code it shows.</p>
    {qr && <img src={qr} alt="Authenticator setup QR code" className="size-40 rounded-xl border bg-white p-1"/>}
    <p className="select-all break-all rounded-xl bg-muted p-3 font-mono text-xs">{setup.secret}</p>
    <div className="flex flex-wrap items-center gap-2">{codeInput}<Button className="h-11 rounded-xl" disabled={busy || code.length !== 6} onClick={() => void confirm()}>{busy ? <Loader2 className="animate-spin"/> : 'Turn on'}</Button><Button variant="ghost" className="h-11 rounded-xl" onClick={() => setSetup(null)}>Cancel</Button></div>
   </div>
   : status.data?.enabled ? <div className="space-y-3">
    <p className="text-xs text-emerald-600">On{status.data.enabledAt ? ` since ${new Date(status.data.enabledAt).toLocaleDateString()}` : ''}. Keep the app on a different device from this one.</p>
    {removing ? <div className="flex flex-wrap items-center gap-2">{codeInput}<Button variant="outline" className="h-11 rounded-xl" disabled={busy || code.length !== 6} onClick={() => void remove()}>{busy ? <Loader2 className="animate-spin"/> : 'Remove'}</Button><Button variant="ghost" className="h-11 rounded-xl" onClick={() => setRemoving(false)}>Cancel</Button></div>
     : <button type="button" className="wallet-soft-button" onClick={() => { setRemoving(true); setCode(''); }}>Remove authenticator</button>}
    {removing && <p className="text-[11px] text-muted-foreground">Removing needs a current code, so someone with only this device can’t switch it off.</p>}
   </div>
   : <Button className="h-11 rounded-xl" disabled={busy} onClick={() => void begin()}>{busy ? <Loader2 className="animate-spin"/> : 'Set up authenticator'}</Button>}
  {error && <p role="alert" className="wallet-error">{error}</p>}
 </section>;
}
