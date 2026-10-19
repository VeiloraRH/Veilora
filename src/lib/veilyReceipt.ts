import { recoverMessageAddress, type Hex } from 'viem';
import { API_BASE } from './api';

/**
 * Veily answer receipts: Veilora's server signs what it received from the AI
 * provider and returned for one request. Verifying one shows the answer, the
 * question and the suggested actions are exactly what was signed, by the key
 * Veilora publishes. It does not show the answer is correct.
 */
export type VeilyReceipt = {
 format: 'veily-answer-receipt';
 version: 1;
 payload: string;
 signature: Hex;
 signer: Hex;
 question: string;
 answer: string;
 actions: unknown[];
};
export type ReceiptPayload = {
 v: 1; wallet: string; requestId: string; requestDigest: string; provider: string; model: string; toolCalls: number; issuedAt: string;
 questionSha256: string; answerSha256: string; actionsSha256: string;
};
export type ReceiptCheck = { label: string; ok: boolean; detail: string };
export type ReceiptVerification = { valid: boolean; payload: ReceiptPayload | null; checks: ReceiptCheck[] };

export async function sha256(text: string): Promise<string> {
 const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
 return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

export function parseReceipt(value: unknown): VeilyReceipt {
 const r = (typeof value === 'string' ? JSON.parse(value) : value) as Partial<VeilyReceipt> | null;
 if (!r || r.format !== 'veily-answer-receipt' || r.version !== 1 || typeof r.payload !== 'string' || typeof r.signature !== 'string' ||
  typeof r.signer !== 'string' || typeof r.question !== 'string' || typeof r.answer !== 'string' || !Array.isArray(r.actions)) {
  throw new Error('This is not a Veily answer receipt.');
 }
 return r as VeilyReceipt;
}

/** Check the signature, the signer against Veilora's published key, and every hash. */
export async function verifyReceipt(receipt: VeilyReceipt, publishedSigner: string | null): Promise<ReceiptVerification> {
 const checks: ReceiptCheck[] = [];
 let payload: ReceiptPayload | null = null;
 try { payload = JSON.parse(receipt.payload) as ReceiptPayload; } catch { /* reported below */ }
 const recovered = await recoverMessageAddress({ message: receipt.payload, signature: receipt.signature }).catch(() => null);
 checks.push({ label: 'Signature', ok: !!recovered && recovered.toLowerCase() === receipt.signer.toLowerCase(), detail: recovered ? `Signed by ${recovered}` : 'The signature could not be read' });
 checks.push(publishedSigner
  ? { label: 'Signed by Veilora', ok: !!recovered && recovered.toLowerCase() === publishedSigner.toLowerCase(), detail: `Veilora publishes ${publishedSigner}` }
  : { label: 'Signed by Veilora', ok: false, detail: 'Veilora’s published key could not be loaded, so the signer is unconfirmed' });
 if (!payload || payload.v !== 1) checks.push({ label: 'Receipt contents', ok: false, detail: 'The signed payload is not readable' });
 else {
  checks.push({ label: 'Question', ok: payload.questionSha256 === await sha256(receipt.question), detail: 'Matches the signed hash' });
  checks.push({ label: 'Answer', ok: payload.answerSha256 === await sha256(receipt.answer), detail: 'Matches the signed hash' });
  checks.push({ label: 'Suggested actions', ok: payload.actionsSha256 === await sha256(JSON.stringify(receipt.actions)), detail: 'Matches the signed hash' });
 }
 for (const check of checks) if (!check.ok && check.detail === 'Matches the signed hash') check.detail = 'Does not match: this text was changed after signing';
 return { valid: checks.every(c => c.ok), payload, checks };
}

export async function fetchAttestationAddress(): Promise<string> {
 const response = await fetch(`${API_BASE}/v1/veily/attestation`);
 const body = await response.json().catch(() => ({}));
 if (!response.ok || typeof body.address !== 'string') throw new Error(body.error || 'Could not load Veilora’s receipt key');
 return body.address;
}

export function downloadReceipt(receipt: VeilyReceipt) {
 const url = URL.createObjectURL(new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' }));
 const link = document.createElement('a');
 link.href = url; link.download = `veily-receipt-${(JSON.parse(receipt.payload) as ReceiptPayload).requestId.slice(0, 8)}.json`; link.click();
 setTimeout(() => URL.revokeObjectURL(url), 1000);
}
