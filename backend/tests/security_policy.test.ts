import { expect, test, describe } from "bun:test";
import request from "supertest";
import { app } from "../src/app";
import { assertEncryptionKeyConfigured } from "../src/crypto";
import { NATIVE_ASSET, dailyLimitMessage, enforceExecutionPolicy } from "../src/txPolicy";

describe("security boundaries", () => {
  test("rejects untrusted browser origins", async () => {
    const response = await request(app).get("/health").set("Origin", "https://attacker.example");
    expect(response.status).toBe(403);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  test("rejects arbitrary contract calls before signing", async () => {
    await expect(enforceExecutionPolicy(
      "0x1111111111111111111111111111111111111111",
      "0x2222222222222222222222222222222222222222",
      0n,
      "0xdeadbeef",
    )).rejects.toThrow("Shard B policy denied");
  });

  test("requires secret encryption key material", () => {
    const dedicated = process.env.SHARD_B_ENCRYPTION_KEY;
    const legacy = process.env.CO_SIGNER_SHARD_B_SECRET;
    delete process.env.SHARD_B_ENCRYPTION_KEY;
    delete process.env.CO_SIGNER_SHARD_B_SECRET;
    try {
      expect(() => assertEncryptionKeyConfigured()).toThrow("SHARD_B_ENCRYPTION_KEY");
    } finally {
      if (dedicated === undefined) delete process.env.SHARD_B_ENCRYPTION_KEY;
      else process.env.SHARD_B_ENCRYPTION_KEY = dedicated;
      if (legacy === undefined) delete process.env.CO_SIGNER_SHARD_B_SECRET;
      else process.env.CO_SIGNER_SHARD_B_SECRET = legacy;
    }
  });

  test("explains daily-limit refusals in the user's units", () => {
    expect(dailyLimitMessage(NATIVE_ASSET, 2_000_000_000_000_000n, 798_748_000_000_000n, 0n))
      .toBe("today's ETH limit is 0.000799 ETH (20% of your balance at the start of today's co-signed spending). This needs 0.002 ETH. The limit resets at 00:00 UTC.");
    expect(dailyLimitMessage("0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168", 50_000_000n, 100_000_000n, 80_000_000n))
      .toContain("80 USDG already used, 20 USDG left. This needs 50 USDG");
    expect(dailyLimitMessage(NATIVE_ASSET, 1n, 0n, 0n)).toBe("you have no ETH available to spend");
  });

  test("names the reason when a contract is not allowlisted", async () => {
    await expect(enforceExecutionPolicy(
      "0x1111111111111111111111111111111111111111",
      "0x2222222222222222222222222222222222222222",
      0n,
      "0xdeadbeef",
    )).rejects.toThrow("not on Veilora's co-signing allowlist");
  });
});
