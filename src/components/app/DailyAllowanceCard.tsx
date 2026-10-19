import { useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Gauge } from 'lucide-react';
import { formatUnits } from 'viem';
import { useHoldings } from '@/lib/walletQueries';
import { useSpendingPolicy } from '@/lib/spendingPolicy';
import { useWallet } from '@/lib/walletContext';
import { allowanceRows, resetsIn, untilUtcMidnight } from '@/lib/dailyAllowance';
import { nftTransfersLeft, NFT_DAILY_TRANSFER_LIMIT } from '@/lib/nftTransfer';
import { Private } from '@/components/wallet/Private';

const amount = (raw: bigint, decimals: number) => Number(formatUnits(raw, decimals)).toLocaleString(undefined, { maximumFractionDigits: 4 });

/** Dashboard card: how much of today's co-signer allowance is used, and when it resets. */
export function DailyAllowanceCard() {
 const { deviceKeyUnlocked } = useWallet();
 const holdings = useHoldings();
 const policy = useSpendingPolicy();
 const [now, setNow] = useState(Date.now());
 useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);
 const rows = useMemo(() => holdings.data && policy.data ? allowanceRows(holdings.data, policy.data) : [], [holdings.data, policy.data]);
 const nftLeft = nftTransfersLeft(policy.data);

 return <section className="wallet-panel mt-6 space-y-4 p-6" aria-labelledby="allowance-title">
  <div className="flex items-start justify-between gap-3">
   <div className="flex items-start gap-3"><span className="rules-aside-icon"><Gauge size={17}/></span>
    <div><span className="wallet-health-eyebrow">Co-signer allowance</span><h2 id="allowance-title" className="text-sm font-medium">Today’s spending limit</h2></div></div>
   <Link className="wallet-health-link" to="/app/security">Adjust</Link>
  </div>
  {!deviceKeyUnlocked ? <p className="text-xs text-muted-foreground">Unlock your device key to see how much of today’s limit is left.</p>
   : policy.isPending || holdings.isPending ? <p className="text-xs text-muted-foreground">Checking today’s limits…</p>
   : policy.isError ? <p className="text-xs text-muted-foreground">Today’s limits are unavailable right now.</p>
   : <ul className="space-y-3">
    {rows.map(row => <li key={row.token.symbol} className="space-y-1.5">
     <div className="flex items-baseline justify-between gap-3 text-xs"><strong className="font-medium">{row.token.symbol}</strong>
      <span className="text-muted-foreground"><Private>{amount(row.remaining, row.token.decimals)}</Private> left of <Private>{amount(row.total, row.token.decimals)}</Private></span></div>
     <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${row.token.symbol} used today`} aria-valuenow={Math.round(row.percentUsed)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${row.percentUsed >= 90 ? 'bg-red-500' : row.percentUsed >= 60 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${Math.max(row.percentUsed, row.used > 0n ? 2 : 0)}%` }}/>
     </div>
    </li>)}
    {nftLeft != null && <li className="flex items-baseline justify-between text-xs"><strong className="font-medium">NFT transfers</strong><span className="text-muted-foreground">{nftLeft} of {policy.data?.nftDailyLimit ?? NFT_DAILY_TRANSFER_LIMIT} left</span></li>}
   </ul>}
  <p className="text-[11px] text-muted-foreground">Resets at 00:00 UTC, in {resetsIn(untilUtcMidnight(now))}. The co-signer checks the limit again on every transaction.</p>
 </section>;
}
