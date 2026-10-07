import { expect, test, describe } from "bun:test";
import request from "supertest";
import { app } from "../src/app";
import { generateShardKey, signUserOpHash, computeExecutionDigest } from "../src/crypto";

describe("Threshold Wallets & Co-signing API", () => {
  let walletAddress: string;
  let shardAPrivateKey: `0x${string}`;
  let shardAAddress: `0x${string}`;
  let shardBPrivateKey: `0x${string}`;
  let shardBAddress: `0x${string}`;

  test("POST /v1/wallets registers a new deterministic 2-of-3 threshold wallet", async () => {
    const shardA = generateShardKey();
    shardAPrivateKey = shardA.privateKey;
    shardAAddress = shardA.address;

    const res = await request(app)
      .post("/v1/wallets")
      .send({
        shardAAddress,
      });

    expect(res.status).toBe(201);
    expect(res.body.address).toBeString();
    expect(res.body.shardA.toLowerCase()).toBe(shardAAddress.toLowerCase());
    expect(res.body.shardB).toBeString();
    expect(res.body.shardC).toBeString();
    expect(res.body.threshold).toBe(2);
    expect(res.body.chainId).toBe(4663);
    expect(res.body.apiKey).toBeString();

    walletAddress = res.body.address;
    shardBAddress = res.body.shardB;
  });

  test("GET /v1/wallets/:address returns wallet configuration and active status", async () => {
    const res = await request(app).get(`/v1/wallets/${walletAddress}`);

    expect(res.status).toBe(200);
    expect(res.body.address.toLowerCase()).toBe(walletAddress.toLowerCase());
    expect(res.body.threshold).toBe(2);
    expect(res.body.isFrozen).toBe(false);
  });

  test("POST /v1/wallets/:address/cosign produces valid Shard B ECDSA signature", async () => {
    const target = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
    const value = "0";
    const data = "0x";
    const nonce = 0;
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    const digest = computeExecutionDigest(
      target as `0x${string}`,
      BigInt(value),
      data as `0x${string}`,
      BigInt(nonce),
      BigInt(deadline),
      4663n
    );

    // Client signs with Shard A
    const { signature: shardASig } = await signUserOpHash(shardAPrivateKey, digest);

    const res = await request(app)
      .post(`/v1/wallets/${walletAddress}/cosign`)
      .send({
        target,
        value,
        data,
        nonce,
        deadline,
        shardASignature: shardASig,
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("APPROVED");
    expect(res.body.shardBSignature).toBeString();
    expect(res.body.shardBAddress.toLowerCase()).toBe(shardBAddress.toLowerCase());
    expect(res.body.combinedSignatures).toBeString();
    // Combined signature is 130 bytes hex (260 characters + 0x = 262 characters)
    expect(res.body.combinedSignatures.length).toBe(2 + 130 * 2);
  });

  test("POST /v1/wallets/:address/freeze activates panic freeze and rejects co-signing", async () => {
    // 1. Trigger freeze
    const freezeRes = await request(app)
      .post(`/v1/wallets/${walletAddress}/freeze`)
      .send({
        hours: 12,
        reason: "Suspected device breach test",
      });

    expect(freezeRes.status).toBe(200);
    expect(freezeRes.body.frozen).toBe(true);

    // 2. Co-signer must strictly REJECT signing
    const cosignRes = await request(app)
      .post(`/v1/wallets/${walletAddress}/cosign`)
      .send({
        target: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
        nonce: 1,
        deadline: Math.floor(Date.now() / 1000) + 3600,
      });

    expect(cosignRes.status).toBe(403);
    expect(cosignRes.body.error).toBe("Wallet is currently frozen");

    // 3. Unfreeze wallet
    const unfreezeRes = await request(app).post(`/v1/wallets/${walletAddress}/unfreeze`);
    expect(unfreezeRes.status).toBe(200);
    expect(unfreezeRes.body.frozen).toBe(false);
  });

  test("GET /v1/wallets/:address/audit records audit events", async () => {
    const res = await request(app).get(`/v1/wallets/${walletAddress}/audit`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.records)).toBe(true);
    expect(res.body.records.length).toBeGreaterThan(0);
  });
});
