import { createHash } from 'node:crypto';
import { expect, test } from 'bun:test';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { parseReceipt, sha256, verifyReceipt, type VeilyReceipt } from '../src/lib/veilyReceipt';

const signer = privateKeyToAccount(generatePrivateKey());
const node = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

// Built the way backend/src/veilyAttestation.ts builds receipts.
async function receipt(): Promise<VeilyReceipt> {
 const question = 'What can I spend today?'; const answer = 'You can send up to 120 USDG today.'; const actions = [{ screen: 'dashboard' }];
 const payload = JSON.stringify({ v: 1, wallet: '0x1111111111111111111111111111111111111111', requestId: '8a3c5f1e-1111-4222-8333-944455556666', requestDigest: 'ab'.repeat(32), provider: 'groq', model: 'qwen', toolCalls: 1, issuedAt: '2026-10-19T09:00:00.000Z', questionSha256: node(question), answerSha256: node(answer), actionsSha256: node(JSON.stringify(actions)) });
 return { format: 'veily-answer-receipt', version: 1, payload, signature: await signer.signMessage({ message: payload }), signer: signer.address, question, answer, actions };
}

test('browser hashing matches the server', async () => {
 expect(await sha256('Veily ✓ answer')).toBe(node('Veily ✓ answer'));
});

test('a genuine receipt verifies against the published key', async () => {
 const result = await verifyReceipt(parseReceipt(JSON.stringify(await receipt())), signer.address);
 expect(result.valid).toBe(true);
 expect(result.payload?.provider).toBe('groq');
});

test('edited text, another signer or a missing key fail clearly', async () => {
 const edited = await verifyReceipt({ ...await receipt(), answer: 'You can send everything.' }, signer.address);
 expect(edited.valid).toBe(false);
 expect(edited.checks.find(c => c.label === 'Answer')).toMatchObject({ ok: false, detail: 'Does not match: this text was changed after signing' });
 const other = await verifyReceipt(await receipt(), privateKeyToAccount(generatePrivateKey()).address);
 expect(other.checks.find(c => c.label === 'Signed by Veilora')?.ok).toBe(false);
 expect((await verifyReceipt(await receipt(), null)).valid).toBe(false);
 expect(() => parseReceipt('{"format":"other"}')).toThrow('not a Veily answer receipt');
});
