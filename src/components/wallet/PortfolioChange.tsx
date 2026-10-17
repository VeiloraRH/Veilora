import { useMemo } from 'react';
import { formatUnits } from 'viem';
import type { Holding } from '@/lib/walletChain';
import { portfolioChange, portfolioSeries, usePriceHistory } from '@/lib/portfolioHistory';
import { Private } from '@/components/wallet/Private';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', signDisplay: 'always' });

function Sparkline({ values, up }: { values: number[]; up: boolean }) {
 const min = Math.min(...values); const max = Math.max(...values); const span = max - min || 1;
 const points = values.map((v, i) => `${(i / (values.length - 1)) * 120},${30 - ((v - min) / span) * 28}`).join(' ');
 return <svg viewBox="0 0 120 32" width="120" height="32" aria-hidden="true" className={up ? 'text-emerald-500' : 'text-red-500'}>
  <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round"/>
 </svg>;
}

/** 24-hour change of the current holdings, from Veilora's 15-minute price samples. */
export function PortfolioChange({ holdings }: { holdings: Holding[] | undefined }) {
 const held = useMemo(() => (holdings ?? []).filter(h => h.raw != null && h.raw > 0n).map(h => ({ symbol: h.token.symbol, amount: Number(formatUnits(h.raw!, h.token.decimals)) })), [holdings]);
 const history = usePriceHistory(held.filter(h => h.symbol !== 'USDG').map(h => h.symbol));
 const result = useMemo(() => history.data ? portfolioChange(portfolioSeries(held, history.data)) : null, [held, history.data]);
 if (!held.some(h => h.symbol !== 'USDG') || history.isError) return null;
 if (!result) return history.isPending ? null : <p className="mt-2 text-xs text-muted-foreground">Your 24h change appears once Veilora has collected a few price samples.</p>;
 const up = result.change >= 0;
 return <div className="mt-2 flex items-center gap-3" aria-label={`Change over the past ${result.hours} hours`}>
  <p className={`text-xs font-medium ${up ? 'text-emerald-600' : 'text-red-500'}`}>
   <Private>{money.format(result.change)} ({up ? '+' : ''}{result.percent.toFixed(2)}%)</Private>
   <span className="ml-1 font-normal text-muted-foreground">past {result.hours === 24 ? '24h' : `${result.hours}h`}</span>
  </p>
  <Sparkline values={result.points.map(p => p.value)} up={up}/>
 </div>;
}
