import { expect, test, describe } from "bun:test";
import request from "supertest";
import { app } from "../src/app";
import { assertEncryptionKeyConfigured } from "../src/crypto";
import { enforceExecutionPolicy } from "../src/txPolicy";

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
});
