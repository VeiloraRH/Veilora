import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Archive, ArrowDownToLine, Check, Copy, Link2, Loader2 } from 'lucide-react';
import { formatUnits, type Hex } from 'viem';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWallet } from '@/lib/walletContext';
import { rawAmount } from '@/lib/walletChain';
import { archivePaymentLink, assetDecimals, createPaymentLink, hasLinkKey, linkBalances, listPaymentLinks, moveLinkFunds, paymentLinkUrl, type PaymentAsset, type PaymentLink } from '@/lib/paymentLinks';

const show = (raw: bigint, asset: PaymentAsset) => `${Number(formatUnits(raw, assetDecimals(asset))).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${asset}`;

function CopyLink({ slug }: { slug: string }) {
 const [copied, setCopied] = useState(false);
 return <button type="button" className="wallet-soft-button" onClick={() => void navigator.clipboard.writeText(paymentLinkUrl(slug)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}>
  {copied ? <Check size={13}/> : <Copy size={13}/>}{copied ? 'Copied' : 'Copy link'}
 </button>;
}

function LinkRow({ link, wallet, deviceKey }: { link: PaymentLink; wallet: string; deviceKey: Hex }) {
 const queryClient = useQueryClient();
 const balances = useQuery({ queryKey: ['payment-link-balance', link.linkAddress], queryFn: () => linkBalances(link.linkAddress), refetchInterval: 15_000 });
 const [status, setStatus] = useState('');
 const [busy, setBusy] = useState<'' | 'move' | 'archive'>('');
 const received = (balances.data?.usdg ?? 0n) > 0n || (balances.data?.eth ?? 0n) > 0n;
 const localKey = hasLinkKey(wallet, link.linkAddress);
 if (link.archived && !received) return null;
 async function move() {
  setBusy('move'); setStatus('');
  try { const hashes = await moveLinkFunds(wallet, deviceKey, link, setStatus); setStatus(`Moved into your account in ${hashes.length} transfer${hashes.length === 1 ? '' : 's'}.`); await balances.refetch(); void queryClient.invalidateQueries({ queryKey: ['holdings'] }); }
  catch (cause) { setStatus(cause instanceof Error ? cause.message : 'Could not move the funds.'); }
  finally { setBusy(''); }
 }
 async function archive() {
  setBusy('archive');
  try { await archivePaymentLink(wallet, deviceKey, link.slug); await queryClient.invalidateQueries({ queryKey: ['payment-links', wallet] }); }
  catch (cause) { setStatus(cause instanceof Error ? cause.message : 'Could not archive this link.'); }
  finally { setBusy(''); }
 }
 return <li className="space-y-2 rounded-2xl border p-3 text-left">
  <div className="flex items-start justify-between gap-3">
   <div className="min-w-0"><p className="truncate text-sm font-medium">{link.note || 'Payment link'}</p>
    <p className="text-xs text-muted-foreground">{link.amount ? `Asks for ${show(BigInt(link.amount), link.asset)}` : `Any amount of ${link.asset}`}{link.archived ? ' · Archived' : ''}</p></div>
   <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${received ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
    {balances.isPending ? 'Checking…' : received ? 'Paid' : 'Waiting'}
   </span>
  </div>
  {received && balances.data && <p className="text-xs">Holding {[balances.data.usdg > 0n && show(balances.data.usdg, 'USDG'), balances.data.eth > 0n && show(balances.data.eth, 'ETH')].filter(Boolean).join(' and ')}</p>}
  <div className="flex flex-wrap gap-2">
   {!link.archived && <CopyLink slug={link.slug}/>}
   {received && <button type="button" className="wallet-soft-button" disabled={!!busy || !localKey} title={localKey ? undefined : 'Only the device that created this link can move its funds'} onClick={() => void move()}>{busy === 'move' ? <Loader2 size={13} className="animate-spin"/> : <ArrowDownToLine size={13}/>}Move to my account</button>}
   {!link.archived && <button type="button" className="wallet-soft-button" disabled={!!busy} onClick={() => void archive()}>{busy === 'archive' ? <Loader2 size={13} className="animate-spin"/> : <Archive size={13}/>}Archive</button>}
  </div>
  {status && <p role="status" className="text-xs text-muted-foreground">{status}</p>}
 </li>;
}

export function PaymentLinksDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
 const { walletAddress, getStoredDeviceKey } = useWallet();
 const deviceKey = getStoredDeviceKey() as Hex | null;
 const queryClient = useQueryClient();
 const links = useQuery({ queryKey: ['payment-links', walletAddress], enabled: open && !!deviceKey, queryFn: () => listPaymentLinks(walletAddress, deviceKey!) });
 const [asset, setAsset] = useState<PaymentAsset>('USDG');
 const [amount, setAmount] = useState('');
 const [note, setNote] = useState('');
 const [creating, setCreating] = useState(false);
 const [error, setError] = useState('');
 const [created, setCreated] = useState<PaymentLink | null>(null);
 const [qr, setQr] = useState('');
 useEffect(() => { if (open) { setCreated(null); setError(''); } }, [open]);
 useEffect(() => { setQr(''); if (created) void QRCode.toDataURL(paymentLinkUrl(created.slug), { margin: 2, width: 220, color: { dark: '#202638', light: '#ffffff' } }).then(setQr).catch(() => {}); }, [created]);

 let raw = 0n; let amountOk = !amount;
 try { if (amount) { raw = rawAmount(amount, assetDecimals(asset)); amountOk = raw > 0n; } } catch { amountOk = false; }
 async function create() {
  if (!deviceKey || !amountOk) return;
  setCreating(true); setError('');
  try {
   const link = await createPaymentLink(walletAddress, deviceKey, { asset, amount: amount ? raw.toString() : '', note: note.trim() });
   setCreated(link); setAmount(''); setNote('');
   await queryClient.invalidateQueries({ queryKey: ['payment-links', walletAddress] });
  } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create the link.'); }
  finally { setCreating(false); }
 }

 return <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}>
  <DialogContent className="wallet-dialog max-h-[90vh] overflow-y-auto sm:max-w-md">
   <DialogHeader><div className="flex items-center gap-3"><span className="rounded-xl bg-blue-500/10 p-3 text-blue-500"><Link2 size={20}/></span>
    <div><DialogTitle>Payment links</DialogTitle><DialogDescription className="mt-1">Get paid without sharing your account address.</DialogDescription></div></div></DialogHeader>
   <p className="rounded-xl bg-muted/70 p-3 text-xs leading-5 text-muted-foreground">Each link has its own address, and payers only see that one. Money paid to a link is held by a key on this device until you move it into your account. Moving it is visible on-chain.</p>
   {!deviceKey ? <p className="text-sm text-muted-foreground">Unlock your device key to create and manage payment links.</p> : <>
    {created ? <div className="space-y-3 rounded-2xl border p-4 text-center">
     <p className="text-sm font-medium">Your link is ready</p>
     {qr && <img src={qr} alt="QR code for the payment link" className="mx-auto size-44 rounded-xl"/>}
     <p className="break-all font-mono text-xs">{paymentLinkUrl(created.slug)}</p>
     <div className="flex justify-center gap-2"><CopyLink slug={created.slug}/><button type="button" className="wallet-soft-button" onClick={() => setCreated(null)}>Create another</button></div>
    </div> : <form className="space-y-3" onSubmit={event => { event.preventDefault(); void create(); }}>
     <div className="flex gap-2">{(['USDG', 'ETH'] as const).map(a => <button key={a} type="button" aria-pressed={asset === a} onClick={() => setAsset(a)} className={`flex-1 rounded-xl border px-3 py-2 text-sm ${asset === a ? 'border-blue-500 bg-blue-500/5 font-medium' : ''}`}>{a}</button>)}</div>
     <label className="block space-y-1.5 text-left text-xs"><span>Amount (optional)</span><Input inputMode="decimal" placeholder="Any amount" value={amount} onChange={event => setAmount(event.target.value.trim())} className="h-11 rounded-xl"/></label>
     <label className="block space-y-1.5 text-left text-xs"><span>Note for the payer (optional)</span><Input maxLength={80} placeholder="Invoice #12" value={note} onChange={event => setNote(event.target.value.replace(/[\r\n]/g, ' '))} className="h-11 rounded-xl"/></label>
     {!amountOk && <p className="text-xs text-red-500">Enter a valid amount, or leave it empty.</p>}
     {error && <p role="alert" className="rounded-xl bg-red-500/5 p-3 text-xs text-red-500">{error}</p>}
     <Button className="h-11 w-full rounded-xl" disabled={creating || !amountOk}>{creating ? <><Loader2 className="animate-spin"/>Creating…</> : 'Create link'}</Button>
    </form>}
    <div className="space-y-2">
     <p className="text-left text-xs font-medium">Your links</p>
     {links.isPending ? <p className="text-xs text-muted-foreground">Loading…</p> : links.error ? <p className="text-xs text-red-500">{links.error.message}</p>
      : links.data?.some(l => !l.archived) || links.data?.length ? <ul className="space-y-2">{links.data!.map(link => <LinkRow key={link.slug} link={link} wallet={walletAddress} deviceKey={deviceKey}/>)}</ul>
      : <p className="text-xs text-muted-foreground">No payment links yet.</p>}
    </div>
   </>}
  </DialogContent>
 </Dialog>;
}
