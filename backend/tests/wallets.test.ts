import { expect, test, describe } from "bun:test";
import request from "supertest";
import { getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { app } from "../src/app";
import { generateShardKey, signUserOpHash, computeExecutionDigestV2 } from "../src/crypto";

describe("Threshold Wallets & Co-signing API", () => {
  let walletAddress: string;
  let shardAPrivateKey: `0x${string}`;
  let shardCPrivateKey: `0x${string}`;
  let shardAAddress: `0x${string}`;
  let shardCAddress: `0x${string}`;
  let shardBPrivateKey: `0x${string}`;
  let shardBAddress: `0x${string}`;
  let registrationBody: Record<string, unknown>;

  test("POST /v1/wallets refuses server-side generation of user-held shards", async () => {
    const res = await request(app).post("/v1/wallets").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Client-generated Shard A and Shard C");
  });

  test("POST /v1/wallets registers a new deterministic 2-of-3 threshold wallet", async () => {
    const shardA = generateShardKey();
    shardAPrivateKey = shardA.privateKey;
    shardAAddress = shardA.address;
    const shardC = generateShardKey();
    shardCPrivateKey = shardC.privateKey;
    shardCAddress = shardC.address;

    const requestId = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const shardASignature = await privateKeyToAccount(shardA.privateKey).signMessage({
      message: `Veilora wallet registration\nversion:2\nshardA:${getAddress(shardAAddress)}\nshardC:${getAddress(shardCAddress)}\nsalt:0\ndeploy:false\ntimestamp:${timestamp}\nrequest:${requestId}`,
    });
    registrationBody = {
        accountVersion: 2,
        shardAAddress,
        shardCAddress,
        requestId,
        timestamp,
        shardASignature,
      };
    const res = await request(app).post("/v1/wallets").send(registrationBody);

    expect(res.status).toBe(201);
    expect(res.body.address).toBeString();
    expect(res.body.shardA.toLowerCase()).toBe(shardAAddress.toLowerCase());
    expect(res.body.shardB).toBeString();
    expect(res.body.shardC.toLowerCase()).toBe(shardCAddress.toLowerCase());
    expect(res.body.generatedShards).toBeUndefined();
    expect(res.body.threshold).toBe(2);
    expect(res.body.chainId).toBe(4663);
    expect(res.body.accountVersion).toBe(2);
    expect(res.body.apiKey).toBeString();

    walletAddress = res.body.address;
    shardBAddress = res.body.shardB;
  });

  test("POST /v1/wallets safely retries a completed registration request", async () => {
    const retry = await request(app).post("/v1/wallets").send(registrationBody);
    expect(retry.status).toBe(200);
    expect(retry.body.address.toLowerCase()).toBe(walletAddress.toLowerCase());
    expect(retry.body.shardB.toLowerCase()).toBe(shardBAddress.toLowerCase());
  });

  test("GET /v1/wallets/:address returns wallet configuration and active status", async () => {
    const res = await request(app).get(`/v1/wallets/${walletAddress}`);

    expect(res.status).toBe(200);
    expect(res.body.address.toLowerCase()).toBe(walletAddress.toLowerCase());
    expect(res.body.threshold).toBe(2);
    expect(res.body.isFrozen).toBe(false);
  });

  test("POST /v1/wallets/:address/cosign rejects arbitrary unsigned digests and unsupported calls", async () => {
    const unsigned = await request(app)
      .post(`/v1/wallets/${walletAddress}/cosign`)
      .send({ digest: `0x${"11".repeat(32)}` });
    expect(unsigned.status).toBe(400);

    const target = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
    const value = "0";
    const data = "0x";
    const nonce = 0;
    const deadline = Math.floor(Date.now() / 1000) + 240;

    const digest = computeExecutionDigestV2(
      walletAddress as `0x${string}`,
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

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("policy denied");
  });

  test("POST /v1/wallets/:address/freeze activates panic freeze and rejects co-signing", async () => {
    const unauthorizedFreeze = await request(app)
      .post(`/v1/wallets/${walletAddress}/freeze`)
      .send({ hours: 12, reason: "unauthorized attempt" });
    expect(unauthorizedFreeze.status).toBe(400);

    const freezeTimestamp = Math.floor(Date.now() / 1000);
    const freezeReason = "Suspected device breach test";
    const freezeSignature = await privateKeyToAccount(shardAPrivateKey).signMessage({
      message: `Veilora account security action\nwallet:${getAddress(walletAddress)}\naction:freeze\nhours:12\nreason:${freezeReason}\ntimestamp:${freezeTimestamp}`,
    });
    // 1. Trigger freeze
    const freezeRes = await request(app)
      .post(`/v1/wallets/${walletAddress}/freeze`)
      .send({
        hours: 12,
        reason: freezeReason,
        timestamp: freezeTimestamp,
        shardASignature: freezeSignature,
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
    const unfreezeTimestamp = Math.floor(Date.now() / 1000);
    const unfreezeSignature = await privateKeyToAccount(shardCPrivateKey).signMessage({
      message: `Veilora account security action\nwallet:${getAddress(walletAddress)}\naction:unfreeze\nhours:0\nreason:\ntimestamp:${unfreezeTimestamp}`,
    });
    const unfreezeRes = await request(app).post(`/v1/wallets/${walletAddress}/unfreeze`).send({
      timestamp: unfreezeTimestamp,
      shardASignature: unfreezeSignature,
    });
    expect(unfreezeRes.status).toBe(200);
    expect(unfreezeRes.body.frozen).toBe(false);
  });

  test("GET /v1/wallets/:address/audit records audit events", async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await privateKeyToAccount(shardAPrivateKey).signMessage({
      message: `Veilora wallet audit access\nwallet:${getAddress(walletAddress)}\ntimestamp:${timestamp}`,
    });
    const res = await request(app).get(`/v1/wallets/${walletAddress}/audit`)
      .set("x-veilora-timestamp", String(timestamp))
      .set("x-veilora-signature", signature);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.records)).toBe(true);
    expect(res.body.records.length).toBeGreaterThan(0);
  });

  test("POST /v1/wallets enforces the shared per-IP hourly registration limit", async () => {
    const ipSuffix = Array.from(crypto.getRandomValues(new Uint8Array(2))).join(".");
    const ip = `198.51.${ipSuffix}`;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const response = await request(app)
        .post("/v1/wallets")
        .set("X-Forwarded-For", ip)
        .send({});
      expect(response.status).toBe(400);
    }

    const limited = await request(app)
      .post("/v1/wallets")
      .set("X-Forwarded-For", ip)
      .send({});
    expect(limited.status).toBe(429);
  });
});
