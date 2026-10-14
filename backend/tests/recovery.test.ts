import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import request from "supertest";
import { getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { app } from "../src/app";
import { generateShardKey } from "../src/crypto";
import { query } from "../src/db/index";
import { quorumChain } from "../src/routes/quorum";

describe("Quorum and recovery center", () => {
  const device = privateKeyToAccount(generateShardKey().privateKey);
  const recovery = privateKeyToAccount(generateShardKey().privateKey);
  const stranger = privateKeyToAccount(generateShardKey().privateKey);
  const shardB = getAddress(generateShardKey().address);
  const wallet = getAddress(generateShardKey().address);
  const realRead = quorumChain.read;
  const ts = () => Math.floor(Date.now() / 1000);

  const freezeMessage = (hours: number, reason: string, timestamp: number) =>
    `Veilora account security action\nwallet:${wallet}\naction:freeze\nhours:${hours}\nreason:${reason}\ntimestamp:${timestamp}`;
  const unfreezeMessage = (timestamp: number) =>
    `Veilora account security action\nwallet:${wallet}\naction:unfreeze\nhours:0\nreason:\ntimestamp:${timestamp}`;

  async function freeze(signer: typeof device, hours = 24, reason = "Lost phone") {
    const timestamp = ts();
    return request(app).post(`/v1/wallets/${wallet}/freeze`).send({
      hours, reason, timestamp, shardASignature: await signer.signMessage({ message: freezeMessage(hours, reason, timestamp) }),
    });
  }
  async function unfreeze(signer: typeof device) {
    const timestamp = ts();
    return request(app).post(`/v1/wallets/${wallet}/unfreeze`).send({
      timestamp, shardASignature: await signer.signMessage({ message: unfreezeMessage(timestamp) }),
    });
  }

  beforeAll(async () => {
    await query(
      `INSERT INTO wallets (address, factory_address, chain_id, shard_a_address, shard_b_address, shard_b_encrypted, shard_c_address, api_key_hash)
       VALUES ($1, $2, 4663, $3, $4, 'test', $5, 'test')`,
      [wallet.toLowerCase(), "0xf86bea538ea756048f8df9be4bcd88aeb4d65376", device.address.toLowerCase(), shardB.toLowerCase(), recovery.address.toLowerCase()],
    );
  });

  afterAll(async () => {
    quorumChain.read = realRead;
    await query("DELETE FROM wallets WHERE address = $1", [wallet.toLowerCase()]);
  });

  test("reports on-chain shards and flags a mismatch with the registration", async () => {
    quorumChain.read = async () => ({ shardA: device.address, shardB, shardC: stranger.address, nonce: 7n });
    const res = await request(app).get(`/v1/wallets/${wallet}/quorum`);
    expect(res.status).toBe(200);
    expect(res.body.deployed).toBe(true);
    expect(res.body.onChain.nonce).toBe("7");
    expect(res.body.matches).toEqual({ shardA: true, shardB: true, shardC: false });
    expect(res.body.coSigner.signing).toBe(true);
    expect(res.body.recoveryPaths.recoveryKeyRotation).toBe("planned");
  });

  test("still answers when the account is not deployed or the chain is unreachable", async () => {
    quorumChain.read = async () => null;
    const undeployed = await request(app).get(`/v1/wallets/${wallet}/quorum`);
    expect(undeployed.body.deployed).toBe(false);
    expect(undeployed.body.matches).toBeNull();

    quorumChain.read = async () => { throw new Error("rpc down"); };
    const offline = await request(app).get(`/v1/wallets/${wallet}/quorum`);
    expect(offline.status).toBe(200);
    expect(offline.body.chainError).toContain("could not be reached");
  });

  test("only Shard A or Shard C can freeze", async () => {
    expect((await freeze(stranger)).status).toBe(403);
  });

  test("a recovery-key freeze cannot be changed or lifted by the device key", async () => {
    const frozen = await freeze(recovery, 72, "Phone stolen");
    expect(frozen.status).toBe(200);
    expect(frozen.body.initiatedBy).toBe("recovery");

    const shorten = await freeze(device, 1, "Never mind");
    expect(shorten.status).toBe(409);
    expect((await unfreeze(device)).status).toBe(403);

    const status = await request(app).get(`/v1/wallets/${wallet}/quorum`);
    expect(status.body.freeze.initiatedBy).toBe("recovery");
    expect(status.body.coSigner.signing).toBe(false);

    const lifted = await unfreeze(recovery);
    expect(lifted.status).toBe(200);
    expect(lifted.body.frozen).toBe(false);
  });

  test("a device freeze can be lifted with either user-held key", async () => {
    expect((await freeze(device)).body.initiatedBy).toBe("device");
    expect((await unfreeze(recovery)).status).toBe(200);
    expect((await freeze(device)).status).toBe(200);
    expect((await unfreeze(device)).status).toBe(200);
  });
});
