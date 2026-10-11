import { expect, test, describe } from "bun:test";
import request from "supertest";
import { app } from "../src/app";
import { generateShardKey } from "../src/crypto";
import { getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "node:crypto";

describe("Privacy Plane API (Notes, Provenance & View Keys)", () => {
  let noteCommitment: string;
  let viewKeyToken: string;
  let walletAddress: string;
  let shardAPrivateKey: `0x${string}`;

  test("registers a wallet for the owned-note tests", async () => {
    const shardA = generateShardKey();
    shardAPrivateKey = shardA.privateKey;
    const walletRes = await request(app).post("/v1/wallets").send({
      shardAAddress: shardA.address,
      shardCAddress: generateShardKey().address,
    });

    expect(walletRes.status).toBe(201);
    walletAddress = getAddress(walletRes.body.address);
  });

  test("POST /v1/privacy/notes creates a shielded note commitment", async () => {
    const assetSymbol = "USDG";
    const amountWei = "100000000000000000000";
    const creationRequestId = `0x${randomBytes(32).toString("hex")}`;
    const message = `Veilora shield note creation\nwallet:${walletAddress}\nasset:${assetSymbol}\namount:${amountWei}\nrequest:${creationRequestId}`;
    const shardASignature = await privateKeyToAccount(shardAPrivateKey).signMessage({ message });
    const res = await request(app)
      .post("/v1/privacy/notes")
      .send({
        assetSymbol,
        amountWei,
        ownerAddress: walletAddress,
        creationRequestId,
        shardASignature,
      });

    expect(res.status).toBe(201);
    expect(res.body.note.commitment).toBeString();
    expect(res.body.note.status).toBe("unspent");
    expect(res.body.nullifierSecret).toBeString();
    expect(res.body.blindingSecret).toBeString();

    noteCommitment = res.body.note.commitment;
  });

  test("POST /v1/privacy/notes/:commitment/verify verifies status for the owning wallet", async () => {
    const message = `Veilora note status request: ${walletAddress}:${noteCommitment}`;
    const shardASignature = await privateKeyToAccount(shardAPrivateKey).signMessage({ message });
    const res = await request(app)
      .post(`/v1/privacy/notes/${noteCommitment}/verify`)
      .send({ walletAddress, shardASignature });

    expect(res.status).toBe(200);
    expect(res.body.exists).toBe(true);
    expect(res.body.isUnspent).toBe(true);
    expect(res.body.asset).toBe("USDG");
  });

  test("rejects shielded-note creation without a valid Shard A signature", async () => {
    const otherShard = generateShardKey();
    const creationRequestId = `0x${randomBytes(32).toString("hex")}`;
    const message = `Veilora shield note creation\nwallet:${walletAddress}\nasset:USDG\namount:1000000000000000000\nrequest:${creationRequestId}`;
    const shardASignature = await privateKeyToAccount(otherShard.privateKey).signMessage({ message });
    const res = await request(app).post("/v1/privacy/notes").send({
      assetSymbol: "USDG",
      amountWei: "1000000000000000000",
      ownerAddress: walletAddress,
      creationRequestId,
      shardASignature,
    });

    expect(res.status).toBe(403);
  });

  test("POST /v1/privacy/provenance/prove generates clean-provenance association proof", async () => {
    const res = await request(app)
      .post("/v1/privacy/provenance/prove")
      .send({
        depositCommitment: noteCommitment,
        targetAsset: "USDG",
      });

    expect(res.status).toBe(200);
    expect(res.body.proofId).toBeString();
    expect(res.body.status).toBe("action_eligible");
    expect(res.body.isEligibleForExecution).toBe(true);
    expect(res.body.disclosures.reveals).toBeString();
  });

  test("GET /v1/privacy/provenance/sets lists active sets", async () => {
    const res = await request(app).get("/v1/privacy/provenance/sets");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.sets)).toBe(true);
    expect(res.body.sets.length).toBeGreaterThan(0);
  });

  test("POST /v1/privacy/viewkeys & GET /v1/privacy/viewkeys/:token manages selective disclosure", async () => {
    const walletRes = await request(app).post("/v1/wallets").send({
      shardAAddress: generateShardKey().address,
      shardCAddress: generateShardKey().address,
    });
    const testWallet = walletRes.body.address;

    const createRes = await request(app)
      .post("/v1/privacy/viewkeys")
      .send({
        walletAddress: testWallet,
        scope: "account",
        label: "Quarterly Audit",
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.viewKeyToken).toBeString();
    viewKeyToken = createRes.body.viewKeyToken;

    const inspectRes = await request(app).get(`/v1/privacy/viewkeys/${viewKeyToken}`);
    expect(inspectRes.status).toBe(200);
    expect(inspectRes.body.valid).toBe(true);
    expect(inspectRes.body.viewKey.label).toBe("Quarterly Audit");
    expect(inspectRes.body.viewKey.access_count).toBe(1);
  });
});
