import { expect, test } from 'bun:test';
import { portfolioChange, portfolioSeries } from '../src/lib/portfolioHistory';

const t = (minutes: number) => new Date(Date.UTC(2031, 2, 1, 0, minutes)).toISOString();
const history = {
 ETH: [{ t: t(0), price: '3000000000' }, { t: t(15), price: '3060000000' }, { t: t(30), price: '3030000000' }],
 NVDA: [{ t: t(15), price: '200000000' }, { t: t(30), price: '210000000' }],
};

test('values current holdings at each sample, carrying prices forward', () => {
 const points = portfolioSeries([{ symbol: 'USDG', amount: 100 }, { symbol: 'ETH', amount: 0.5 }, { symbol: 'NVDA', amount: 2 }], history);
 // 00:00 is skipped: NVDA had no price yet.
 expect(points).toEqual([
  { t: Date.parse(t(15)), value: 100 + 0.5 * 3060 + 2 * 200 },
  { t: Date.parse(t(30)), value: 100 + 0.5 * 3030 + 2 * 210 },
 ]);
});

test('reports the change over the window it actually covers', () => {
 const points = portfolioSeries([{ symbol: 'ETH', amount: 1 }], history);
 const change = portfolioChange(points, Date.parse(t(30)) + 5 * 3_600_000)!;
 expect(change.change).toBe(30);
 expect(change.percent).toBeCloseTo(1, 5);
 expect(change.hours).toBe(6);
 expect(portfolioChange(points, Date.parse(t(0)) + 30 * 3_600_000)!.hours).toBe(24);
});

test('has nothing to show for stable-only balances or a single sample', () => {
 expect(portfolioSeries([{ symbol: 'USDG', amount: 500 }], history)).toEqual([]);
 expect(portfolioChange([{ t: 0, value: 10 }])).toBeNull();
 expect(portfolioSeries([{ symbol: 'ETH', amount: 0 }], history)).toEqual([]);
});
