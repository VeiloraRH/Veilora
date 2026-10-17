import { useQuery } from '@tanstack/react-query';
import { formatUnits } from 'viem';
import { API_BASE } from './api';

/**
 * The dashboard's 24-hour change: current holdings valued at the USDG prices
 * Veilora sampled every 15 minutes from the pools the wallet swaps through.
 * Start and end use the same samples, so the change is price movement only.
 */
export type PricePoint = { t: string; price: string };
export type HeldAmount = { symbol: string; amount: number };
export type ValuePoint = { t: number; value: number };

const usdg = (raw: string) => Number(formatUnits(BigInt(raw), 6));

/** One point per sample time at which every priced holding has a known price (carried forward). */
export function portfolioSeries(holdings: HeldAmount[], history: Record<string, PricePoint[]>): ValuePoint[] {
 const stable = holdings.filter(h => h.symbol === 'USDG').reduce((sum, h) => sum + h.amount, 0);
 const priced = holdings.filter(h => h.symbol !== 'USDG' && h.amount > 0);
 if (!priced.length) return [];
 const times = [...new Set(priced.flatMap(h => (history[h.symbol] ?? []).map(p => Date.parse(p.t))))].sort((a, b) => a - b);
 const cursor = new Map<string, number>();
 const latest = new Map<string, number>();
 const points: ValuePoint[] = [];
 for (const t of times) {
  for (const h of priced) {
   const samples = history[h.symbol] ?? [];
   let i = cursor.get(h.symbol) ?? 0;
   while (i < samples.length && Date.parse(samples[i].t) <= t) { latest.set(h.symbol, usdg(samples[i].price)); i++; }
   cursor.set(h.symbol, i);
  }
  if (priced.every(h => latest.has(h.symbol))) points.push({ t, value: stable + priced.reduce((sum, h) => sum + h.amount * latest.get(h.symbol)!, 0) });
 }
 return points;
}

export type PortfolioChange = { change: number; percent: number; hours: number; points: ValuePoint[] };

export function portfolioChange(points: ValuePoint[], now = Date.now()): PortfolioChange | null {
 if (points.length < 2) return null;
 const first = points[0];
 const last = points[points.length - 1];
 const change = last.value - first.value;
 return { change, percent: first.value > 0 ? (change / first.value) * 100 : 0, hours: Math.max(1, Math.min(24, Math.round((now - first.t) / 3_600_000))), points };
}

export async function fetchPriceHistory(symbols: string[], hours = 24): Promise<Record<string, PricePoint[]>> {
 const response = await fetch(`${API_BASE}/v1/prices/history?symbols=${encodeURIComponent(symbols.join(','))}&hours=${hours}`);
 const body = await response.json().catch(() => ({}));
 if (!response.ok) throw new Error(body.error || 'Price history is unavailable');
 return body.prices as Record<string, PricePoint[]>;
}

export function usePriceHistory(symbols: string[]) {
 const key = [...symbols].sort().join(',');
 return useQuery({ queryKey: ['price-history', key], enabled: symbols.length > 0, staleTime: 60_000, refetchInterval: 5 * 60_000, queryFn: () => fetchPriceHistory(key.split(',')) });
}
