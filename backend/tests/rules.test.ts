import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import request from "supertest";
import { getAddress, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { app } from "../src/app";
import { generateShardKey } from "../src/crypto";
import { query } from "../src/db/index";
import { ruleChain } from "../src/rules/chain";
import { evaluateRules, type EvaluatorDeps } from "../src/rules/evaluator";
import { RuleSpecError, hashSpec, nextScheduledRun, parseRuleSpec, planExecution } from "../src/rules/spec";
import {
  executionResolveMessage,
  ruleCreateMessage,
  ruleStatusMessage,
  rulesReadMessage,
} from "../src/routes/rules";

const now = new Date("2026-10-14T12:00:00Z");
const inDays = (days: number, from = new Date()) => new Date(from.getTime() + days * 86_400_000).toISOString();

function spec(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: 1,
    name: "Split incoming USDG",
    trigger: { type: "incoming", asset: "USDG", minAmount: "10" },
    source: { asset: "USDG" },
    allocations: [{ asset: "META", percent: 20 }, { asset: "NVDA", percent: 20 }],
    limits: { maxPerRun: "500", dailyCap: "1000", slippageBps: 50, expiresAt: inDays(30, now) },
    mode: "approval",
    ...overrides,
  };
}

describe("rule spec validation", () => {
  test("accepts the documented USDG split example", () => {
    const parsed = parseRuleSpec(JSON.stringify(spec()), now);
    expect(parsed.trigger).toEqual({ type: "incoming", asset: "USDG", minAmount: "10" });
    expect(parsed.allocations.map((a) => a.asset)).toEqual(["META", "NVDA"]);
    expect(parsed.mode).toBe("approval");
  });

  test.each([
    ["automatic mode", { mode: "automatic" }, "Automatic execution is not available yet"],
    ["allocations over 100%", { allocations: [{ asset: "META", percent: 60 }, { asset: "NVDA", percent: 50 }] }, "more than 100%"],
    ["target equal to source", { allocations: [{ asset: "USDG", percent: 10 }] }, "differ from the source"],
    ["unsupported asset", { allocations: [{ asset: "DOGE", percent: 10 }] }, "supported Robinhood Chain asset"],
    ["unknown fields", { extra: true }, 'Unknown field "extra"'],
    ["daily cap below max per run", { limits: { maxPerRun: "500", dailyCap: "100", slippageBps: 50, expiresAt: inDays(30, now) } }, "Daily cap"],
    ["slippage above 3%", { limits: { maxPerRun: "500", dailyCap: "1000", slippageBps: 500, expiresAt: inDays(30, now) } }, "Slippage"],
    ["expiry too far out", { limits: { maxPerRun: "500", dailyCap: "1000", slippageBps: 50, expiresAt: inDays(400, now) } }, "Expiry"],
    ["incoming rule with a fixed amount", { source: { asset: "USDG", amount: "5" } }, "received amount"],
    ["incoming ETH", { trigger: { type: "incoming", asset: "ETH", minAmount: "1" }, source: { asset: "ETH" } }, "Incoming ETH"],
  ])("rejects %s", (_label, overrides, message) => {
    expect(() => parseRuleSpec(JSON.stringify(spec(overrides as Record<string, unknown>)), now)).toThrow(message as string);
  });

  test("schedule and price rules need a fixed source amount within the per-run maximum", () => {
    const base = { trigger: { type: "schedule", frequency: "weekly", hourUtc: 14, weekday: 1 }, allocations: [{ asset: "NVDA", percent: 100 }] };
    expect(() => parseRuleSpec(JSON.stringify(spec(base)), now)).toThrow("Source amount");
    expect(() => parseRuleSpec(JSON.stringify(spec({ ...base, source: { asset: "USDG", amount: "600" } })), now)).toThrow("maximum per run");
    const ok = parseRuleSpec(JSON.stringify(spec({ ...base, source: { asset: "USDG", amount: "100" } })), now);
    expect(ok.trigger).toEqual({ type: "schedule", frequency: "weekly", hourUtc: 14, weekday: 1 });
  });

  test("rejects malformed JSON as a spec error", () => {
    expect(() => parseRuleSpec("{nope", now)).toThrow(RuleSpecError);
  });
});

describe("scheduling and sizing", () => {
  test("computes the next daily, weekly and monthly run in UTC", () => {
    expect(nextScheduledRun({ type: "schedule", frequency: "daily", hourUtc: 9 }, now).toISOString()).toBe("2026-10-15T09:00:00.000Z");
    expect(nextScheduledRun({ type: "schedule", frequency: "daily", hourUtc: 18 }, now).toISOString()).toBe("2026-10-14T18:00:00.000Z");
    // 2026-10-14 is a Wednesday (3); next Monday is the 19th.
    expect(nextScheduledRun({ type: "schedule", frequency: "weekly", hourUtc: 9, weekday: 1 }, now).toISOString()).toBe("2026-10-19T09:00:00.000Z");
    expect(nextScheduledRun({ type: "schedule", frequency: "monthly", hourUtc: 9, dayOfMonth: 1 }, now).toISOString()).toBe("2026-11-01T09:00:00.000Z");
    expect(nextScheduledRun({ type: "schedule", frequency: "monthly", hourUtc: 9, dayOfMonth: 20 }, now).toISOString()).toBe("2026-10-20T09:00:00.000Z");
  });

  test("splits by percent and holds runs under the per-run and daily limits", () => {
    const parsed = parseRuleSpec(JSON.stringify(spec()), now);
    const usdg = (v: string) => parseUnits(v, 6);
    const normal = planExecution(parsed, usdg("1000"), 0n);
    expect(normal.status).toBe("pending");
    expect(normal.legs.map((l) => l.amountRaw)).toEqual([usdg("200").toString(), usdg("200").toString()]);
    expect(normal.capped).toBe(false);

    const large = planExecution(parsed, usdg("5000"), 0n);
    expect(large.totalRaw).toBe(usdg("500"));
    expect(large.reason).toContain("maximum per run");

    const nearCap = planExecution(parsed, usdg("1000"), usdg("900"));
    expect(nearCap.totalRaw).toBe(usdg("100"));
    expect(nearCap.reason).toContain("today's cap");

    const atCap = planExecution(parsed, usdg("1000"), usdg("1000"));
    expect(atCap.status).toBe("skipped");
    expect(atCap.reason).toBe("Daily cap reached");
  });
});

describe("Wallet Rules API and evaluator", () => {
  const shardA = generateShardKey();
  const signer = privateKeyToAccount(shardA.privateKey);
  const stranger = privateKeyToAccount(generateShardKey().privateKey);
  const wallet = getAddress(generateShardKey().address);
  const base = `/v1/wallets/${wallet}/rules`;
  const ts = () => Math.floor(Date.now() / 1000);
  const realLatest = ruleChain.latestBlock;
  let incomingRuleId = "";
  let scheduleRuleId = "";
  let priceRuleId = "";

  async function list(account = signer) {
    const timestamp = ts();
    const signature = await account.signMessage({ message: rulesReadMessage(wallet, timestamp) });
    return request(app).get(base).set("x-veilora-timestamp", String(timestamp)).set("x-veilora-signature", signature);
  }

  async function create(body: Record<string, unknown>) {
    const specJson = JSON.stringify(body);
    const timestamp = ts();
    const shardASignature = await signer.signMessage({ message: ruleCreateMessage(wallet, hashSpec(specJson), timestamp) });
    return { res: await request(app).post(base).send({ spec: specJson, timestamp, shardASignature }), specJson, timestamp, shardASignature };
  }

  beforeAll(async () => {
    ruleChain.latestBlock = async () => 1_000n;
    await query(
      `INSERT INTO wallets (address, factory_address, chain_id, shard_a_address, shard_b_address, shard_b_encrypted, shard_c_address, api_key_hash)
       VALUES ($1, $2, 4663, $3, $4, 'test', $5, 'test')`,
      [wallet.toLowerCase(), "0xf86bea538ea756048f8df9be4bcd88aeb4d65376", shardA.address.toLowerCase(),
        generateShardKey().address.toLowerCase(), generateShardKey().address.toLowerCase()],
    );
  });

  afterAll(async () => {
    ruleChain.latestBlock = realLatest;
    await query("DELETE FROM wallets WHERE address = $1", [wallet.toLowerCase()]);
  });

  test("reads require a fresh signature from this wallet's Shard A", async () => {
    expect((await request(app).get(base)).status).toBe(400);
    expect((await list(stranger)).status).toBe(403);
    const ok = await list();
    expect(ok.status).toBe(200);
    expect(ok.body.automaticExecutionAvailable).toBe(false);
    expect(ok.body.rules).toEqual([]);
  });

  test("creates a rule from the signed spec and refuses replays and forgeries", async () => {
    const first = await create(spec({ limits: { maxPerRun: "500", dailyCap: "1000", slippageBps: 50, expiresAt: inDays(30) } }));
    expect(first.res.status).toBe(201);
    expect(first.res.body.status).toBe("active");
    expect(first.res.body.mode).toBe("approval");
    incomingRuleId = first.res.body.id;

    const replay = await request(app).post(base).send({ spec: first.specJson, timestamp: first.timestamp, shardASignature: first.shardASignature });
    expect(replay.status).toBe(409);

    const tampered = await request(app).post(base).send({ spec: first.specJson.replace('"percent":20', '"percent":30'), timestamp: first.timestamp, shardASignature: first.shardASignature });
    expect(tampered.status).toBe(403);

    const automatic = await create(spec({ mode: "automatic", limits: { maxPerRun: "500", dailyCap: "1000", slippageBps: 50, expiresAt: inDays(30) } }));
    expect(automatic.res.status).toBe(400);
    expect(automatic.res.body.error).toContain("Automatic execution is not available");
  });

  test("evaluator prepares approvals for incoming transfers, schedules and price crossings", async () => {
    const schedule = await create(spec({
      name: "Weekly NVDA buy",
      trigger: { type: "schedule", frequency: "daily", hourUtc: 9 },
      source: { asset: "USDG", amount: "50" },
      allocations: [{ asset: "NVDA", percent: 100 }],
      limits: { maxPerRun: "50", dailyCap: "50", slippageBps: 50, expiresAt: inDays(30) },
    }));
    expect(schedule.res.status).toBe(201);
    scheduleRuleId = schedule.res.body.id;
    await query("UPDATE wallet_rules SET next_run_at = now() - interval '1 minute' WHERE id = $1", [scheduleRuleId]);

    const price = await create(spec({
      name: "Buy NVDA under 150",
      trigger: { type: "price", asset: "NVDA", direction: "below", priceUsdg: "150" },
      source: { asset: "USDG", amount: "25" },
      allocations: [{ asset: "NVDA", percent: 100 }],
      limits: { maxPerRun: "25", dailyCap: "100", slippageBps: 50, expiresAt: inDays(30) },
    }));
    expect(price.res.status).toBe(201);
    priceRuleId = price.res.body.id;

    let nvdaPrice = parseUnits("140", 6);
    let evaluationTime = new Date();
    const transfers: Record<string, { ref: string; amountRaw: bigint; txHash: string; blockNumber: bigint }[]> = {
      "1000": [],
    };
    const deps: EvaluatorDeps = {
      now: () => evaluationTime,
      latestBlock: async () => 1_010n,
      incomingTransfers: async (to, _token, fromBlock) => {
        expect(to).toBe(wallet);
        return fromBlock === 1_001n ? [
          { ref: `0x${"ab".repeat(32)}:3`, amountRaw: parseUnits("1000", 6), txHash: `0x${"ab".repeat(32)}`, blockNumber: 1_005n },
          { ref: `0x${"cd".repeat(32)}:1`, amountRaw: parseUnits("1", 6), txHash: `0x${"cd".repeat(32)}`, blockNumber: 1_006n },
        ] : transfers["1000"];
      },
      usdgPrice: async () => nvdaPrice,
    };

    expect(await evaluateRules(deps)).toBe(3);
    // A second pass sees no new transfers, no due schedule, and the price rule is disarmed.
    expect(await evaluateRules(deps)).toBe(0);
    // Price recovers (re-arms), then crosses again.
    evaluationTime = new Date(evaluationTime.getTime() + 1_000);
    nvdaPrice = parseUnits("160", 6);
    expect(await evaluateRules(deps)).toBe(0);
    evaluationTime = new Date(evaluationTime.getTime() + 1_000);
    nvdaPrice = parseUnits("149", 6);
    expect(await evaluateRules(deps)).toBe(1);

    const listed = await list();
    const pending = listed.body.executions.filter((e: { status: string }) => e.status === "pending");
    const incoming = pending.find((e: { ruleId: string }) => e.ruleId === incomingRuleId);
    expect(incoming.legs).toEqual([
      { asset: "META", percent: 20, amountRaw: parseUnits("200", 6).toString() },
      { asset: "NVDA", percent: 20, amountRaw: parseUnits("200", 6).toString() },
    ]);
    expect(incoming.trigger.txHash).toBe(`0x${"ab".repeat(32)}`);
    expect(pending.filter((e: { ruleId: string }) => e.ruleId === scheduleRuleId)).toHaveLength(1);
    expect(pending.filter((e: { ruleId: string }) => e.ruleId === priceRuleId)).toHaveLength(2);
  });

  test("owner resolves a prepared run once, with its transaction hashes", async () => {
    const listed = await list();
    const run = listed.body.executions.find((e: { ruleId: string; status: string }) => e.ruleId === incomingRuleId && e.status === "pending");
    const txHashes = [`0x${"12".repeat(32)}`, `0x${"34".repeat(32)}`];
    const timestamp = ts();
    const shardASignature = await signer.signMessage({ message: executionResolveMessage(wallet, run.id, "executed", txHashes, timestamp) });
    const resolved = await request(app).post(`${base}/executions/${run.id}/resolve`).send({ outcome: "executed", txHashes, timestamp, shardASignature });
    expect(resolved.status).toBe(200);
    expect(resolved.body.status).toBe("executed");
    expect(resolved.body.txHashes).toEqual(txHashes);

    const again = ts() + 1;
    const second = await request(app).post(`${base}/executions/${run.id}/resolve`).send({
      outcome: "declined", txHashes: [], timestamp: again,
      shardASignature: await signer.signMessage({ message: executionResolveMessage(wallet, run.id, "declined", [], again) }),
    });
    expect(second.status).toBe(409);
  });

  test("pause, resume and revoke are signed; revoking closes waiting approvals", async () => {
    const act = async (action: string, ruleId = priceRuleId) => {
      const timestamp = ts();
      const shardASignature = await signer.signMessage({ message: ruleStatusMessage(wallet, ruleId, action, timestamp) });
      return request(app).post(`${base}/${ruleId}/status`).send({ action, timestamp, shardASignature });
    };
    expect((await act("pause")).body.status).toBe("paused");
    expect((await act("pause")).status).toBe(409);
    expect((await act("resume")).body.status).toBe("active");
    expect((await act("revoke")).body.status).toBe("revoked");
    expect((await act("resume")).status).toBe(409);

    const listed = await list();
    const closed = listed.body.executions.filter((e: { ruleId: string }) => e.ruleId === priceRuleId);
    expect(closed.every((e: { status: string; reason: string }) => e.status === "expired" && e.reason === "Rule revoked")).toBe(true);
  });

  test("frozen wallets cannot add rules and are skipped by the evaluator", async () => {
    await query("UPDATE wallets SET is_frozen = true, frozen_until = now() + interval '1 hour' WHERE address = $1", [wallet.toLowerCase()]);
    try {
      const blocked = await create(spec({ limits: { maxPerRun: "500", dailyCap: "1000", slippageBps: 50, expiresAt: inDays(30) } }));
      expect(blocked.res.status).toBe(403);
      await query("UPDATE wallet_rules SET next_run_at = now() - interval '1 minute' WHERE id = $1", [scheduleRuleId]);
      const deps: EvaluatorDeps = { now: () => new Date(), latestBlock: async () => 1_020n, incomingTransfers: async () => [], usdgPrice: async () => 1n };
      expect(await evaluateRules(deps)).toBe(0);
    } finally {
      await query("UPDATE wallets SET is_frozen = false, frozen_until = NULL WHERE address = $1", [wallet.toLowerCase()]);
    }
  });
});
