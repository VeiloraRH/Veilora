import { describe, expect, test } from "bun:test";
import { summarizeLedger } from "../src/ledgerSummary";

const me = "0x1111111111111111111111111111111111111111";
const maya = "0x4444444444444444444444444444444444444444";
const studio = "0x2222222222222222222222222222222222222222";
const now = Date.parse("2026-10-19T12:00:00Z");
const day = (n: number) => new Date(now - n * 86_400_000).toISOString();
const usdg = (from: string, to: string, amount: string, ago: number, status?: string) =>
  ({ timestamp: day(ago), from: { hash: from }, to: { hash: to }, total: { value: amount, decimals: "6" }, token: { symbol: "USDG", decimals: "6" }, ...(status ? { status } : {}) });
const eth = (from: string, to: string, wei: string, ago: number) => ({ timestamp: day(ago), from: { hash: from }, to: { hash: to }, value: wei, status: "ok" });

describe("Veily ledger summary", () => {
  test("totals per asset and top recipients inside the period", () => {
    const summary = summarizeLedger(me, [eth(me, studio, "10000000000000000", 3), eth(maya, me, "0", 2)], [
      usdg(me, maya, "1200000000", 2), usdg(me, maya, "1200000000", 20), usdg(me, studio, "80000000", 5),
      usdg(studio, me, "500000000", 1), usdg(me, studio, "999000000", 4, "error"), usdg(me, maya, "5000000", 40),
    ], 30, now);
    expect(summary.totals).toEqual(expect.arrayContaining([
      { asset: "ETH", sent: "0.01", received: "0", transfers: 1 },
      { asset: "USDG", sent: "2480", received: "500", transfers: 4 },
    ]));
    expect(summary.topRecipients[0]).toEqual({ address: "0x4444444444444444444444444444444444444444", asset: "USDG", sent: "2400", transfers: 2 });
    expect(summary.topRecipients.map((r) => r.asset)).toEqual(["USDG", "ETH", "USDG"]);
    expect(summary.coverage).toContain("full period");
  });

  test("says when the explorer history does not reach back far enough", () => {
    const summary = summarizeLedger(me, [], [usdg(me, maya, "1000000", 3)], 90, now);
    expect(summary.coverage).toContain("may be incomplete");
    expect(summarizeLedger(me, [], [], 30, now).totals).toEqual([]);
  });
});

describe("Veily ledger summary for one address", () => {
  test("totals both directions with that address only", () => {
    const summary = summarizeLedger(me, [eth(me, maya, "20000000000000000", 1)], [usdg(me, maya, "1200000000", 2), usdg(maya, me, "50000000", 3), usdg(me, studio, "80000000", 5)], 30, now, maya);
    expect(summary.withCounterparty).toEqual({
      address: "0x4444444444444444444444444444444444444444",
      sent: [{ asset: "ETH", amount: "0.02", transfers: 1 }, { asset: "USDG", amount: "1200", transfers: 1 }],
      received: [{ asset: "USDG", amount: "50", transfers: 1 }],
      lastTransfer: day(1),
    });
    expect(summarizeLedger(me, [], [], 30, now).withCounterparty).toBeUndefined();
  });
});
