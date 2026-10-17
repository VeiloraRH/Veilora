import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import request from "supertest";
import { getAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { app } from "../src/app";
import { query } from "../src/db/index";
import { resetAttempts } from "../src/freeze";
import { authenticatorMessage } from "../src/routes/authenticator";
import { base32Decode, base32Encode, totpCode, totpStep, verifyTotp } from "../src/totp";

describe("one-time codes", () => {
  // RFC 6238 appendix B, SHA-1 secret "12345678901234567890", truncated to 6 digits.
  const secret = base32Encode(Buffer.from("12345678901234567890"));
  test("match the RFC 6238 test vectors", () => {
    expect(secret).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(base32Decode(secret).toString()).toBe("12345678901234567890");
    expect(totpCode(secret, Math.floor(59 / 30))).toBe("287082");
    expect(totpCode(secret, Math.floor(1111111109 / 30))).toBe("081804");
    expect(totpCode(secret, Math.floor(2000000000 / 30))).toBe("279037");
  });
  test("accept one period either side and never an already-used step", () => {
    const now = 1_800_000_000_000;
    const step = totpStep(now);
    expect(verifyTotp(secret, totpCode(secret, step - 1), null, now)).toBe(step - 1);
    expect(verifyTotp(secret, totpCode(secret, step + 1), null, now)).toBe(step + 1);
    expect(verifyTotp(secret, totpCode(secret, step - 2), null, now)).toBeNull();
    expect(verifyTotp(secret, totpCode(secret, step), step, now)).toBeNull();
    expect(verifyTotp(secret, "12345", null, now)).toBeNull();
  });
});

describe("authenticator freeze", () => {
  const device = privateKeyToAccount(generatePrivateKey());
  const wallet = getAddress("0x7777777777777777777777777777777777777777");
  const base = `/v1/wallets/${wallet}/authenticator`;
  const now = () => Math.floor(Date.now() / 1000);
  const signed = async (action: "setup" | "confirm" | "remove", code = "") => {
    const timestamp = now();
    return { code, timestamp, shardASignature: await device.signMessage({ message: authenticatorMessage(action, wallet, timestamp, code) }) };
  };
  const status = async () => {
    const timestamp = now();
    return (await request(app).get(base).set("x-veilora-timestamp", String(timestamp)).set("x-veilora-signature", await device.signMessage({ message: authenticatorMessage("status", wallet, timestamp) }))).body.enabled;
  };

  beforeAll(async () => {
    await query(
      `INSERT INTO wallets (address, factory_address, chain_id, shard_a_address, shard_b_address, shard_b_encrypted, shard_c_address, api_key_hash)
       VALUES ($1, $2, 4663, $3, $4, 'test', $5, 'test') ON CONFLICT (address) DO NOTHING`,
      [wallet.toLowerCase(), "0xf86bea538ea756048f8df9be4bcd88aeb4d65376", device.address.toLowerCase(), wallet.toLowerCase(), wallet.toLowerCase()],
    );
  });
  afterAll(async () => {
    resetAttempts(wallet);
    await query("DELETE FROM wallets WHERE address = $1", [wallet.toLowerCase()]);
  });

  test("setup, freeze with a code, refuse replays, remove with a code", async () => {
    expect(await status()).toBe(false);
    expect((await request(app).post(`${base}/freeze`).send({ code: "123456" })).status).toBe(400);
    const stranger = privateKeyToAccount(generatePrivateKey());
    const t = now();
    expect((await request(app).post(`${base}/setup`).send({ timestamp: t, shardASignature: await stranger.signMessage({ message: authenticatorMessage("setup", wallet, t) }) })).status).toBe(403);

    const setup = await request(app).post(`${base}/setup`).send(await signed("setup"));
    expect(setup.status).toBe(200);
    expect(setup.body.uri).toStartWith("otpauth://totp/Veilora");
    const secret: string = setup.body.secret;
    const step = totpStep();

    expect((await request(app).post(`${base}/confirm`).send(await signed("confirm", totpCode(secret, step - 5)))).status).toBe(403);
    expect((await request(app).post(`${base}/confirm`).send(await signed("confirm", totpCode(secret, step - 1)))).body.enabled).toBe(true);
    expect(await status()).toBe(true);

    expect((await request(app).post(`${base}/freeze`).send({ code: totpCode(secret, step - 5) })).status).toBe(403);
    const frozen = await request(app).post(`${base}/freeze`).send({ code: totpCode(secret, step), hours: 24 });
    expect(frozen.status).toBe(200);
    expect(frozen.body.frozen).toBe(true);
    const row = await query<{ is_frozen: boolean; freeze_initiated_by: string }>("SELECT is_frozen, freeze_initiated_by FROM wallets WHERE address = $1", [wallet.toLowerCase()]);
    expect(row.rows[0]).toEqual({ is_frozen: true, freeze_initiated_by: "device" });
    expect((await request(app).post(`${base}/freeze`).send({ code: totpCode(secret, step) })).body.error).toContain("already used");

    expect((await request(app).post(`${base}/remove`).send(await signed("remove", totpCode(secret, step + 1)))).body.enabled).toBe(false);
    expect((await request(app).post(`${base}/freeze`).send({ code: totpCode(secret, step + 1) })).status).toBe(400);
  });

  test("locks out after five wrong codes", async () => {
    resetAttempts(wallet);
    await request(app).post(`${base}/setup`).send(await signed("setup"));
    for (let i = 0; i < 5; i++) expect((await request(app).post(`${base}/confirm`).send(await signed("confirm", "000000"))).status).toBe(403);
    expect((await request(app).post(`${base}/confirm`).send(await signed("confirm", "000000"))).status).toBe(429);
  });
});
