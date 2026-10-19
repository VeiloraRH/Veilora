import { describe, expect, test } from "bun:test";
import request from "supertest";
import { recoverMessageAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { app } from "../src/app";
import { attestationAccount, issueAnswerReceipt, sha256 } from "../src/veilyAttestation";

const input = {
  wallet: "0x1111111111111111111111111111111111111111", requestId: "8a3c5f1e-1111-4222-8333-944455556666", requestDigest: "ab".repeat(32),
  provider: "groq", model: "qwen/qwen3.8-27b", question: "What can I spend today?", answer: "You can send up to 120 USDG today.",
  actions: [{ screen: "dashboard" }], toolCalls: 1, issuedAt: new Date("2026-10-19T09:00:00Z"),
};

describe("Veily answer receipts", () => {
  test("are signed by the published attestation key over the exact payload", async () => {
    const receipt = await issueAnswerReceipt(input);
    expect(receipt.signer).toBe(attestationAccount().address);
    expect(await recoverMessageAddress({ message: receipt.payload, signature: receipt.signature })).toBe(receipt.signer);
    const payload = JSON.parse(receipt.payload);
    expect(payload).toMatchObject({ v: 1, wallet: input.wallet, requestId: input.requestId, provider: "groq", model: input.model, toolCalls: 1, issuedAt: "2026-10-19T09:00:00.000Z" });
    expect(payload.answerSha256).toBe(sha256(input.answer));
    expect(payload.questionSha256).toBe(sha256(input.question));
    expect(payload.actionsSha256).toBe(sha256(JSON.stringify(input.actions)));
    expect(receipt.payload).not.toContain(input.answer);
  });

  test("use a stable derived key, or the configured one", () => {
    expect(attestationAccount().address).toBe(attestationAccount().address);
    const configured = generatePrivateKey();
    process.env.VEILY_ATTESTATION_PRIVATE_KEY = configured;
    try { expect(attestationAccount().address).toBe(privateKeyToAccount(configured).address); }
    finally { delete process.env.VEILY_ATTESTATION_PRIVATE_KEY; }
  });

  test("publishes the signing address", async () => {
    const res = await request(app).get("/v1/veily/attestation");
    expect(res.status).toBe(200);
    expect(res.body.address).toBe(attestationAccount().address);
  });
});
