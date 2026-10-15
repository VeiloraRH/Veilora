import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import request from "supertest";
import { getAddress, recoverMessageAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { app } from "../src/app";
import { computeExecutionDigestV2, encryptSecret, generateShardKey } from "../src/crypto";
import { query } from "../src/db/index";
import { rotationCall, rotationCancelMessage, rotationChain, rotationRequestMessage } from "../src/routes/rotations";

describe("key rotation", () => {
  const device = privateKeyToAccount(generateShardKey().privateKey);
  const recovery = privateKeyToAccount(generateShardKey().privateKey);
  const shardB = generateShardKey();
  const newDevice = privateKeyToAccount(generateShardKey().privateKey);
  const newRecovery = privateKeyToAccount(generateShardKey().privateKey);
  const wallet = getAddress(generateShardKey().address);
  const base = `/v1/wallets/${wallet}/rotations`;
  const ts = () => Math.floor(Date.now() / 1000);
  const real = { ...rotationChain };
  let chainShardA = device.address as string;

  async function requestRotation(kind: "device" | "recovery", newAddress: string, signer: typeof device) {
    const t = ts();
    return request(app).post(base).send({ kind, newAddress, timestamp: t, signature: await signer.signMessage({ message: rotationRequestMessage(wallet, kind, newAddress, t) }) });
  }
  async function cosign(id: string, kind: "device" | "recovery", newAddress: string, signer: typeof device) {
    const deadline = BigInt(ts() + 200);
    const digest = computeExecutionDigestV2(wallet, wallet, 0n, rotationCall(kind, newAddress), 3n, deadline, 4663n);
    return { res: await request(app).post(`${base}/${id}/cosign`).send({ nonce: "3", deadline: deadline.toString(), signature: await signer.signMessage({ message: { raw: digest } }) }), digest };
  }
  const mature = (id: string) => query("UPDATE wallet_key_rotations SET matures_at = now() - interval '1 minute' WHERE id = $1", [id]);

  beforeAll(async () => {
    rotationChain.isDeployed = async () => true;
    rotationChain.shards = async () => ({ shardA: chainShardA, shardC: recovery.address });
    await query(
      `INSERT INTO wallets (address, factory_address, account_version, chain_id, shard_a_address, shard_b_address, shard_b_encrypted, shard_c_address, api_key_hash, initial_shard_a_address, initial_shard_c_address)
       VALUES ($1, $2, 2, 4663, $3, $4, $5, $6, 'test', $3, $6)`,
      [wallet.toLowerCase(), "0xf86bea538ea756048f8df9be4bcd88aeb4d65376", device.address.toLowerCase(), shardB.address.toLowerCase(), encryptSecret(shardB.privateKey), recovery.address.toLowerCase()],
    );
  });
  afterAll(async () => {
    Object.assign(rotationChain, real);
    await query("DELETE FROM wallets WHERE address = $1", [wallet.toLowerCase()]);
  });

  test("replacing the device key must be requested with the recovery key", async () => {
    expect((await requestRotation("device", newDevice.address, device)).status).toBe(403);
    expect((await requestRotation("device", recovery.address, recovery)).status).toBe(400);
    const ok = await requestRotation("device", newDevice.address, recovery);
    expect(ok.status).toBe(201);
    expect(ok.body.ready).toBe(false);
    expect((await requestRotation("device", newDevice.address, recovery)).status).toBe(409);
  });

  test("cannot finish before the delay, and only with the recovery key", async () => {
    const list = await request(app).get(base);
    const rotation = list.body.rotations[0];
    expect(list.body.delaySeconds).toBe(172_800);
    expect((await cosign(rotation.id, "device", newDevice.address, recovery)).res.status).toBe(425);
    await mature(rotation.id);
    expect((await cosign(rotation.id, "device", newDevice.address, device)).res.status).toBe(403);
    const { res, digest } = await cosign(rotation.id, "device", newDevice.address, recovery);
    expect(res.status).toBe(200);
    expect(res.body.data).toBe(rotationCall("device", newDevice.address));
    const sigs = res.body.combinedSignatures as string;
    const signers = await Promise.all([`0x${sigs.slice(2, 132)}`, `0x${sigs.slice(132)}`].map((s) => recoverMessageAddress({ message: { raw: digest }, signature: s as `0x${string}` })));
    expect(signers.map((s) => s.toLowerCase()).sort()).toEqual([recovery.address.toLowerCase(), shardB.address.toLowerCase()].sort());
    const audit = await query("SELECT metadata FROM cosign_audit WHERE user_op_hash = $1", [digest]);
    expect(audit.rows[0].metadata).toMatchObject({ rotationId: rotation.id, signerShard: "C" });
  });

  test("completes only once the new key is live on-chain, keeping the original keys", async () => {
    const id = (await request(app).get(base)).body.rotations[0].id;
    expect((await request(app).post(`${base}/${id}/complete`).send({})).status).toBe(409);
    chainShardA = newDevice.address;
    const done = await request(app).post(`${base}/${id}/complete`).send({ txHash: `0x${"ab".repeat(32)}` });
    expect(done.body.status).toBe("completed");
    const row = await query("SELECT shard_a_address, initial_shard_a_address FROM wallets WHERE address = $1", [wallet.toLowerCase()]);
    expect(row.rows[0].shard_a_address).toBe(newDevice.address.toLowerCase());
    expect(row.rows[0].initial_shard_a_address).toBe(device.address.toLowerCase());
    const alerts = await query("SELECT title FROM wallet_alerts WHERE wallet_address = $1 ORDER BY id", [wallet.toLowerCase()]);
    expect(alerts.rows.map((r) => r.title)).toEqual(["Device key replacement requested", "Device key replaced"]);
  });

  test("replacing the recovery key needs the device key, and either key can cancel", async () => {
    expect((await requestRotation("recovery", newRecovery.address, recovery)).status).toBe(403);
    const ok = await requestRotation("recovery", newRecovery.address, newDevice);
    expect(ok.status).toBe(201);
    const t = ts();
    const cancelled = await request(app).post(`${base}/${ok.body.id}/cancel`).send({ timestamp: t, signature: await recovery.signMessage({ message: rotationCancelMessage(wallet, ok.body.id, t) }) });
    expect(cancelled.body.status).toBe("cancelled");
    expect(cancelled.body.cancelledBy).toBe("recovery");
  });

  test("a device-key freeze blocks rotation; a recovery-key freeze allows replacing the device key", async () => {
    const replacement = privateKeyToAccount(generateShardKey().privateKey);
    const ok = await requestRotation("device", replacement.address, recovery);
    await mature(ok.body.id);
    await query("UPDATE wallets SET is_frozen = true, frozen_until = now() + interval '1 hour', freeze_initiated_by = 'device' WHERE address = $1", [wallet.toLowerCase()]);
    expect((await cosign(ok.body.id, "device", replacement.address, recovery)).res.status).toBe(403);
    await query("UPDATE wallets SET freeze_initiated_by = 'recovery' WHERE address = $1", [wallet.toLowerCase()]);
    const allowed = await cosign(ok.body.id, "device", replacement.address, recovery);
    expect(allowed.res.status).toBe(200);
    const audit = await query("SELECT metadata FROM cosign_audit WHERE user_op_hash = $1", [allowed.digest]);
    expect(audit.rows[0].metadata.allowWhileFrozen).toBe(true);
    await query("UPDATE wallets SET is_frozen = false, frozen_until = NULL, freeze_initiated_by = NULL WHERE address = $1", [wallet.toLowerCase()]);
  });

  test("normal co-signing still refuses rotation calls", async () => {
    const t = ts() + 200;
    const data = rotationCall("device", newDevice.address);
    const digest = computeExecutionDigestV2(wallet, wallet, 0n, data, 0n, BigInt(t), 4663n);
    const res = await request(app).post(`/v1/wallets/${wallet}/cosign`).send({ target: wallet, value: "0", data, nonce: 0, deadline: t, shardASignature: await newDevice.signMessage({ message: { raw: digest } }) });
    expect(res.status).toBe(403);
  });
});
