import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { query } from "../src/db/index";
import { addressFacts, pendingReviews, walletHealth } from "../src/veilyReads";

const wallet = "0x8888888888888888888888888888888888888888";

describe("Veily read-only wallet lookups", () => {
  beforeAll(async () => {
    await query(
      `INSERT INTO wallets (address, factory_address, chain_id, shard_a_address, shard_b_address, shard_b_encrypted, shard_c_address, api_key_hash)
       VALUES ($1, $2, 4663, $1, $1, 'test', $1, 'test') ON CONFLICT (address) DO NOTHING`,
      [wallet, "0xf86bea538ea756048f8df9be4bcd88aeb4d65376"],
    );
    const rule = await query<{ id: string }>(
      `INSERT INTO wallet_rules (wallet_address, name, spec, spec_hash, mode, trigger_type, expires_at)
       VALUES ($1, 'Rent to Maya', '{}', $2, 'approval', 'schedule', now() + interval '30 days') RETURNING id::text`,
      [wallet, `0x${"ab".repeat(32)}`],
    );
    const insert = (ref: string, status: string, total: string, expires: string) => query(
      `INSERT INTO wallet_rule_executions (rule_id, wallet_address, status, trigger_ref, trigger_detail, source_asset, total_raw, legs, expires_at)
       VALUES ($1, $2, $3, $4, '{"type":"schedule"}', 'USDG', $5, '[{"to":"x"}]', now() + $6::interval)`,
      [rule.rows[0].id, wallet, status, ref, total, expires],
    );
    await insert("later", "pending", "650000000", "2 days");
    await insert("soon", "pending", "25000000", "1 hour");
    await insert("expired", "pending", "1000000", "-1 hour");
    await insert("done", "executed", "1000000", "1 day");
  });
  afterAll(async () => { await query("DELETE FROM wallets WHERE address = $1", [wallet]); });

  test("pending reviews lists only live pending runs, soonest expiry first", async () => {
    const result = await pendingReviews(wallet);
    expect(result.pending.map((p) => p.amount)).toEqual(["25 USDG", "650 USDG"]);
    expect(result.pending[0]).toMatchObject({ rule: "Rent to Maya", steps: 1, trigger: "schedule" });
    expect(result.howToApprove).toContain("cannot approve");
  });

  test("address facts count transfers both ways and flag burn and token addresses", () => {
    const other = "0x2222222222222222222222222222222222222222";
    const items = [
      { from: { hash: wallet }, to: { hash: other }, timestamp: "2026-10-01T00:00:00Z" },
      { from: { hash: wallet }, to: { hash: other }, timestamp: "2026-10-09T00:00:00Z" },
      { from: { hash: other }, to: { hash: wallet }, timestamp: "2026-10-05T00:00:00Z" },
      { from: { hash: wallet }, to: { hash: "0x3333333333333333333333333333333333333333" } },
    ];
    expect(addressFacts(wallet, other, "0x", items)).toMatchObject({ isContract: false, burnAddress: false, transfersSentToIt: 2, transfersReceivedFromIt: 1, firstSeen: "2026-10-01T00:00:00Z", lastSeen: "2026-10-09T00:00:00Z" });
    expect(addressFacts(wallet, "0x000000000000000000000000000000000000dEaD", null, []).burnAddress).toBe(true);
    expect(addressFacts(wallet, "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168", "0x60", []).tokenContract).toBe("USDG");
    expect(addressFacts(wallet, "0x12", null, [])).toEqual({ error: "That is not a valid address" });
  });

  test("wallet health compares registered keys with the chain and reports gaps", async () => {
    const live = { shardA: wallet, shardB: wallet, shardC: wallet };
    const ok = await walletHealth(wallet, async () => live);
    if ("error" in ok) throw new Error(ok.error);
    expect(ok.checks.filter((c) => c.status === "ok").map((c) => c.check)).toEqual(["On-chain account", "Device key (Shard A)", "Co-signer key (Shard B)", "Recovery key (Shard C)", "Co-signer", "Spending limits"]);
    expect(ok.checks.find((c) => c.check === "Authenticator freeze")?.status).toBe("attention");
    const changed = await walletHealth(wallet, async () => ({ ...live, shardC: "0x9999999999999999999999999999999999999999" }));
    if ("error" in changed) throw new Error(changed.error);
    expect(changed.checks.find((c) => c.check === "Recovery key (Shard C)")?.status).toBe("attention");
    const offline = await walletHealth(wallet, async () => { throw new Error("rpc down"); });
    if ("error" in offline) throw new Error(offline.error);
    expect(offline.checks[0]).toMatchObject({ check: "On-chain account", status: "unknown" });
    expect(await walletHealth("0x7777777777777777777777777777777777777770", async () => null)).toEqual({ error: "Wallet not found" });
  });
});
