import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, CircleAlert, Copy, Loader2 } from 'lucide-react';
import { formatUnits } from 'viem';
import { useQuery } from '@tanstack/react-query';
import { Logo } from '@/components/ui';
import { assetDecimals, fetchPublicLink, linkBalances } from '@/lib/paymentLinks';

export const Route = createFileRoute('/pay/$slug')({ component: PayPage });

function PayPage() {
 const { slug } = Route.useParams();
 const link = useQuery({ queryKey: ['public-payment-link', slug], queryFn: () => fetchPublicLink(slug), retry: false });
 const balances = useQuery({ queryKey: ['public-payment-link-balance', link.data?.linkAddress], enabled: !!link.data && !link.data.archived, queryFn: () => linkBalances(link.data!.linkAddress), refetchInterval: 10_000 });
 const [qr, setQr] = useState('');
 const [copied, setCopied] = useState(false);
 useEffect(() => { if (link.data) void QRCode.toDataURL(link.data.linkAddress, { margin: 2, width: 240, color: { dark: '#202638', light: '#ffffff' } }).then(setQr).catch(() => setQr('')); }, [link.data?.linkAddress]);

 const data = link.data;
 const decimals = data ? assetDecimals(data.asset) : 18;
 const asked = data?.amount ? BigInt(data.amount) : null;
 const held = data ? (data.asset === 'ETH' ? balances.data?.eth : balances.data?.usdg) : undefined;
 const paid = held != null && held > 0n && (asked == null || held >= asked);
 const amountText = (raw: bigint) => Number(formatUnits(raw, decimals)).toLocaleString(undefined, { maximumFractionDigits: 6 });

 return <main className="flex min-h-screen flex-col items-center bg-background px-4 py-10 text-foreground">
  <Logo size={34}/>
  <section className="mt-8 w-full max-w-sm space-y-4 rounded-3xl border bg-card p-6 text-center shadow-sm">
   {link.isPending ? <p className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin"/>Loading payment request…</p>
    : !data ? <div className="space-y-2 py-12"><CircleAlert className="mx-auto text-muted-foreground"/><h1 className="text-lg font-medium">Payment link not found</h1><p className="text-sm text-muted-foreground">Check the link with the person who sent it.</p></div>
    : data.archived ? <div className="space-y-2 py-12"><CircleAlert className="mx-auto text-muted-foreground"/><h1 className="text-lg font-medium">This payment link is closed</h1><p className="text-sm text-muted-foreground">Do not send anything to it. Ask for a new link.</p></div>
    : <>
     <p className="text-xs text-muted-foreground">Payment request</p>
     <h1 className="text-3xl font-medium tracking-tight">{asked != null ? `${amountText(asked)} ${data.asset}` : `Any amount of ${data.asset}`}</h1>
     {data.note && <p className="text-sm text-muted-foreground">{data.note}</p>}
     <div className="mx-auto grid size-56 place-items-center rounded-2xl border bg-white p-2">{qr ? <img src={qr} alt="QR code for the payment address" width={210} height={210}/> : <Loader2 className="animate-spin text-slate-400"/>}</div>
     <p className="select-all break-all rounded-xl bg-muted p-3 font-mono text-xs leading-6">{data.linkAddress}</p>
     <button type="button" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-medium text-background" onClick={() => void navigator.clipboard.writeText(data.linkAddress).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}>
      {copied ? <Check size={16}/> : <Copy size={16}/>}{copied ? 'Copied address' : 'Copy address'}
     </button>
     <p className={`rounded-xl p-3 text-xs ${paid ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
      {paid ? `Payment received${held != null ? `: ${amountText(held)} ${data.asset}` : ''}` : balances.isPending ? 'Checking for payment…' : 'Waiting for payment'}
     </p>
     <p className="text-[11px] leading-5 text-muted-foreground">Send only {data.asset} on Robinhood Chain. Assets on other networks sent here will be lost.</p>
    </>}
  </section>
  <p className="mt-6 text-[11px] text-muted-foreground">Payment links by Veilora</p>
 </main>;
}
