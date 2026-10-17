import { afterAll, describe, expect, test } from "bun:test";
import request from "supertest";
import { app } from "../src/app";
import { query } from "../src/db/index";
import { bucketStart, priceHistory, samplePrices } from "../src/priceHistory";

// Far-future timestamps keep these rows apart from anything else in the test database.
const base = new Date("2031-03-01T12:07:00Z");
const at = (minutes: number) => new Date(base.getTime() + minutes * 60_000);
const prices: Record<string, bigint> = { ETH: 3_000_000_000n, NVDA: 180_000_000n };
const quote = async (symbol: string) => { if (!(symbol in prices)) throw new Error("no pool"); return prices[symbol]; };

describe("price history", () => {
  afterAll(async () => {
    await query("DELETE FROM price_samples WHERE sampled_at >= $1", [new Date("2031-01-01T00:00:00Z")]);
  });

  test("samples into 15-minute buckets, skips unpriced assets, keeps one row per bucket", async () => {
    expect(bucketStart(base).toISOString()).toBe("2031-03-01T12:00:00.000Z");
    expect(await samplePrices(base, quote)).toBe(2);
    prices.ETH = 3_100_000_000n;
    await samplePrices(at(5), quote);
    await samplePrices(at(15), quote);
    const history = await priceHistory(["ETH", "NVDA"], 24, at(20));
    expect(history.ETH).toEqual([
      { t: "2031-03-01T12:00:00.000Z", price: "3000000000" },
      { t: "2031-03-01T12:15:00.000Z", price: "3100000000" },
    ]);
    expect(history.NVDA).toHaveLength(2);
  });

  test("drops samples older than the retention window", async () => {
    await samplePrices(at(9 * 24 * 60), quote);
    expect((await priceHistory(["ETH"], 168, at(9 * 24 * 60))).ETH).toHaveLength(1);
    const old = await query("SELECT 1 FROM price_samples WHERE symbol = 'ETH' AND sampled_at = $1", [bucketStart(base)]);
    expect(old.rows).toHaveLength(0);
  });

  test("the endpoint only serves supported symbols and windows", async () => {
    expect((await request(app).get("/v1/prices/history")).status).toBe(400);
    expect((await request(app).get("/v1/prices/history?symbols=DOGE")).status).toBe(400);
    expect((await request(app).get("/v1/prices/history?symbols=ETH&hours=999")).status).toBe(400);
    const ok = await request(app).get("/v1/prices/history?symbols=ETH,NVDA&hours=24");
    expect(ok.status).toBe(200);
    expect(ok.body.intervalMinutes).toBe(15);
    expect(Object.keys(ok.body.prices)).toEqual(["ETH", "NVDA"]);
  });
});
