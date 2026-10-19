import { expect, test } from 'bun:test';
import { allowanceRows, resetsIn, untilUtcMidnight } from '../src/lib/dailyAllowance';
import { ROBINHOOD_TOKEN_REGISTRY } from '../src/lib/tokens';

const USDG = ROBINHOOD_TOKEN_REGISTRY.USDG;
const NVDA = ROBINHOOD_TOKEN_REGISTRY.NVDA;
const ETH = Object.values(ROBINHOOD_TOKEN_REGISTRY).find(t => t.native)!;

test('mirrors the co-signer: a share of the start-of-day balance, most used first', () => {
 const policy = { perTransactionPercent: 20, dailyTotalPercent: 20, dailySpend: {
  [USDG.address.toLowerCase()]: { spent: '30000000', balance: '500000000' },
 } };
 const rows = allowanceRows([
  { token: USDG, raw: 470_000_000n },
  { token: NVDA, raw: 0n },
  { token: ETH, raw: 10n ** 17n },
 ], policy);
 expect(rows.map(r => r.token.symbol)).toEqual(['USDG', 'ETH']);
 expect(rows[0]).toMatchObject({ used: 30_000_000n, total: 100_000_000n, remaining: 70_000_000n, percentUsed: 30 });
 expect(rows[1]).toMatchObject({ used: 0n, total: 2n * 10n ** 16n, percentUsed: 0 });
});

test('with no spend yet today the start balance is the current balance', () => {
 const [row] = allowanceRows([{ token: USDG, raw: 250_000_000n }], { perTransactionPercent: 20, dailyTotalPercent: 10, dailySpend: {} });
 expect(row.total).toBe(25_000_000n);
});

test('counts down to 00:00 UTC', () => {
 const now = Date.UTC(2026, 9, 19, 18, 47, 30);
 expect(untilUtcMidnight(now)).toBe((5 * 60 + 12) * 60_000 + 30_000);
 expect(resetsIn(untilUtcMidnight(now))).toBe('5h 13m');
 expect(resetsIn(40_000)).toBe('1m');
});
