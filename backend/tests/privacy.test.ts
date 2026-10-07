import { expect, test, describe } from "bun:test";
import request from "supertest";
import { app } from "../src/app";

describe("Privacy Plane API (Notes, Provenance & View Keys)", () => {
  let noteCommitment: string;
  let viewKeyToken: string;

  test("POST /v1/privacy/notes creates a shielded note commitment", async () => {
    const res = await request(app)
      .post("/v1/privacy/notes")
      .send({
        assetSymbol: "USDG",
        amountWei: "100000000000000000000", // 100 USDG
      });

    expect(res.status).toBe(201);
    expect(res.body.note.commitment).toBeString();
    expect(res.body.note.status).toBe("unspent");
    expect(res.body.nullifierSecret).toBeString();
    expect(res.body.blindingSecret).toBeString();

    noteCommitment = res.body.note.commitment;
  });

  test("GET /v1/privacy/notes/:commitment verifies status", async () => {
    const res = await request(app).get(`/v1/privacy/notes/${noteCommitment}`);

    expect(res.status).toBe(200);
    expect(res.body.exists).toBe(true);
    expect(res.body.isUnspent).toBe(true);
    expect(res.body.asset).toBe("USDG");
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
    const walletRes = await request(app).post("/v1/wallets").send({});
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
