import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import request from "supertest";
import { getAddress, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { app } from "../src/app";
import { generateShardKey } from "../src/crypto";
import { query } from "../src/db/index";
import { evaluateAlerts, type AlertDeps, type IncomingLog } from "../src/alerts/evaluator";
import { recordAlert } from "../src/alerts/store";
import { alertsChangeMessage, alertsReadMessage } from "../src/routes/alerts";

describe("Alerts", () => {
  const device = privateKeyToAccount(generateShardKey().privateKey);
  const recovery = privateKeyToAccount(generateShardKey().privateKey);
  const stranger = privateKeyToAccount(generateShardKey().privateKey);
  const wallet = getAddress(generateShardKey().address);
  const sender = getAddress(generateShardKey().address);
  const USDG = getAddress("0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168");
  const base = `/v1/wallets/${wallet}/alerts`;
  const ts = () => Math.floor(Date.now() / 1000);

  async function read(account = device) {
    const t = ts();
    return request(app).get(base).set("x-veilora-timestamp", String(t)).set("x-veilora-signature", await account.signMessage({ message: alertsReadMessage(wallet, t) }));
  }
  async function change(action: string, payload: string) {
    const t = ts();
    return request(app).post(`${base}/change`).send({ action, payload, timestamp: t, shardASignature: await device.signMessage({ message: alertsChangeMessage(wallet, action, payload, t) }) });
  }

  beforeAll(async () => {
    await query(
      `INSERT INTO wallets (address, factory_address, chain_id, shard_a_address, shard_b_address, shard_b_encrypted, shard_c_address, api_key_hash)
       VALUES ($1, $2, 4663, $3, $4, 'test', $5, 'test')`,
      [wallet.toLowerCase(), "0xf86bea538ea756048f8df9be4bcd88aeb4d65376", device.address.toLowerCase(), generateShardKey().address.toLowerCase(), recovery.address.toLowerCase()],
    );
  });
  afterAll(async () => {
    await query("DELETE FROM alert_scan_cursor WHERE name = 'incoming'");
    await query("DELETE FROM wallets WHERE address = $1", [wallet.toLowerCase()]);
  });

  test("reading needs this wallet's Shard A and turns on incoming scanning", async () => {
    expect((await request(app).get(base)).status).toBe(400);
    expect((await read(stranger)).status).toBe(403);
    const res = await read();
    expect(res.status).toBe(200);
    expect(res.body.settings).toEqual({ incoming: true, rules: true, security: true });
    expect(res.body.priceAssets).toContain("NVDA");
    const row = await query("SELECT incoming FROM wallet_alert_settings WHERE wallet_address = $1", [wallet.toLowerCase()]);
    expect(row.rows[0].incoming).toBe(true);
  });

  test("changes are signed, validated and single use", async () => {
    expect((await change("price-add", "DOGE:above:1")).status).toBe(400);
    expect((await change("price-add", "NVDA:below:150")).body.priceAlerts).toHaveLength(1);
    const t = ts();
    const sig = await device.signMessage({ message: alertsChangeMessage(wallet, "settings", "incoming=1;rules=0", t) });
    const first = await request(app).post(`${base}/change`).send({ action: "settings", payload: "incoming=1;rules=0", timestamp: t, shardASignature: sig });
    expect(first.body.settings.rules).toBe(false);
    expect((await request(app).post(`${base}/change`).send({ action: "settings", payload: "incoming=1;rules=0", timestamp: t, shardASignature: sig })).status).toBe(409);
    // Rule alerts are now muted; security alerts never are.
    expect(await recordAlert(wallet, { type: "rule", severity: "info", title: "x", body: "y", ref: "rule:test" })).toBe(false);
    expect(await recordAlert(wallet, { type: "security", severity: "warn", title: "x", body: "y", ref: "security:test" })).toBe(true);
  });

  test("incoming transfers and price crossings become alerts once", async () => {
    let price = parseUnits("140", 6);
    const logs: IncomingLog[] = [
      { token: USDG, from: sender, to: wallet, value: parseUnits("25", 6), txHash: `0x${"aa".repeat(32)}`, logIndex: 1 },
      { token: USDG, from: sender, to: wallet, value: 0n, txHash: `0x${"bb".repeat(32)}`, logIndex: 2 },
    ];
    let block = 1_000n;
    const deps: AlertDeps = { now: () => new Date(), latestBlock: async () => block, incoming: async (wallets) => wallets.includes(wallet) && block === 1_010n ? logs : [], usdgPrice: async () => price };
    await evaluateAlerts(deps); // first run sets the cursor and checks prices (140 <= 150 fires)
    block = 1_010n;
    expect(await evaluateAlerts(deps)).toBe(2); // two transfers; the price alert is disarmed
    expect(await evaluateAlerts(deps)).toBe(0);
    price = parseUnits("160", 6);
    await evaluateAlerts(deps); // re-arms
    price = parseUnits("149", 6);
    expect(await evaluateAlerts(deps)).toBe(1);

    const feed = (await read()).body.alerts as { title: string; severity: string; type: string }[];
    expect(feed.some((a) => a.title === "Received 25 USDG" && a.severity === "success")).toBe(true);
    expect(feed.some((a) => a.title === "Suspicious 0 USDG transfer" && a.severity === "warn")).toBe(true);
    expect(feed.filter((a) => a.type === "price")).toHaveLength(2);
  });

  test("a freeze records a security alert, and read-all clears the badge", async () => {
    const t = ts();
    const message = `Veilora account security action\nwallet:${wallet}\naction:freeze\nhours:24\nreason:Lost phone\ntimestamp:${t}`;
    const frozen = await request(app).post(`/v1/wallets/${wallet}/freeze`).send({ hours: 24, reason: "Lost phone", timestamp: t, shardASignature: await recovery.signMessage({ message }) });
    expect(frozen.status).toBe(200);
    const before = await read();
    expect(before.body.alerts[0].title).toBe("Account frozen with your recovery key");
    expect(before.body.unread).toBeGreaterThan(0);
    expect((await change("read-all", "all")).body.unread).toBe(0);
  });
});
