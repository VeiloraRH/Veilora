import { createHash, hkdfSync } from "node:crypto";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";

/**
 * Signed receipts for Veily answers. A receipt proves what Veilora's server
 * received from the AI provider and returned for one signed request: provider,
 * model, time, and hashes of the question, answer and suggested actions. It
 * does not prove the answer is correct.
 *
 * The attestation key is its own key, never Shard B. It is
 * VEILY_ATTESTATION_PRIVATE_KEY when set, otherwise derived with HKDF from the
 * server's encryption key material under a separate label, so it stays the
 * same across deploys without exposing that material.
 */
const RECEIPT_FORMAT = "veily-answer-receipt";

function attestationKey(): Hex {
  const configured = process.env.VEILY_ATTESTATION_PRIVATE_KEY;
  if (configured && /^0x[0-9a-fA-F]{64}$/.test(configured)) return configured as Hex;
  const material = process.env.SHARD_B_ENCRYPTION_KEY || process.env.CO_SIGNER_SHARD_B_SECRET;
  if (!material) throw new Error("Veily answer receipts need VEILY_ATTESTATION_PRIVATE_KEY or SHARD_B_ENCRYPTION_KEY");
  const derived = Buffer.from(hkdfSync("sha256", material, "veilora", "veily-answer-attestation-v1", 32));
  return `0x${derived.toString("hex")}` as Hex;
}

export const attestationAccount = () => privateKeyToAccount(attestationKey());
export const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

export type VeilyReceipt = {
  format: typeof RECEIPT_FORMAT;
  version: 1;
  payload: string;
  signature: Hex;
  signer: Hex;
  question: string;
  answer: string;
  actions: unknown[];
};

export async function issueAnswerReceipt(input: {
  wallet: string; requestId: string; requestDigest: string; provider: string; model: string;
  question: string; answer: string; actions: unknown[]; toolCalls: number; issuedAt?: Date;
}): Promise<VeilyReceipt> {
  const account = attestationAccount();
  const payload = JSON.stringify({
    v: 1,
    wallet: input.wallet,
    requestId: input.requestId,
    requestDigest: input.requestDigest,
    provider: input.provider,
    model: input.model,
    toolCalls: input.toolCalls,
    issuedAt: (input.issuedAt ?? new Date()).toISOString(),
    questionSha256: sha256(input.question),
    answerSha256: sha256(input.answer),
    actionsSha256: sha256(JSON.stringify(input.actions)),
  });
  return {
    format: RECEIPT_FORMAT, version: 1, payload,
    signature: await account.signMessage({ message: payload }),
    signer: account.address,
    question: input.question, answer: input.answer, actions: input.actions,
  };
}
