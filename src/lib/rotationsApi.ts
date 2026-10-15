import { useQuery } from '@tanstack/react-query';
import { encodeFunctionData, getAddress, parseAbi, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { API_BASE, broadcastTransaction, getWallet } from './api';
import { executionDigest, readAccountNonce } from './walletChain';

export type RotationKind = 'device' | 'recovery';
export type KeyRotation = { id: string; kind: RotationKind; newAddress: string; status: 'pending' | 'completed' | 'cancelled' | 'expired'; ready: boolean; maturesAt: string; expiresAt: string; cancelledBy: 'device' | 'recovery' | null; txHash: string | null; createdAt: string; resolvedAt: string | null };

// Must match backend/src/routes/rotations.ts.
const requestMessage = (w: string, kind: RotationKind, n: string, ts: number) => `Veilora key rotation\naction:request\nwallet:${getAddress(w)}\nkind:${kind}\nnew:${getAddress(n)}\ntimestamp:${ts}`;
const cancelMessage = (w: string, id: string, ts: number) => `Veilora key rotation\naction:cancel\nwallet:${getAddress(w)}\nrotation:${id}\ntimestamp:${ts}`;
const now = () => Math.floor(Date.now() / 1000);

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
 const response = await fetch(`${API_BASE}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } });
 const body = await response.json().catch(() => ({}));
 if (!response.ok) throw new Error(body.error || `Request failed with status ${response.status}`);
 return body as T;
}

export const getRotations = (wallet: string) => call<{ delaySeconds: number; rotations: KeyRotation[] }>(`/v1/wallets/${wallet}/rotations`);
export function useRotations(wallet: string) {
 return useQuery({ queryKey: ['rotations', wallet], enabled: !!wallet, refetchInterval: 60000, queryFn: () => getRotations(wallet) });
}

/** kind "device" is signed with the recovery key; kind "recovery" with the device key. */
export async function requestRotation(wallet: string, signingKey: Hex, kind: RotationKind, newAddress: string): Promise<KeyRotation> {
 const ts = now();
 return call(`/v1/wallets/${wallet}/rotations`, { method: 'POST', body: JSON.stringify({ kind, newAddress, timestamp: ts, signature: await privateKeyToAccount(signingKey).signMessage({ message: requestMessage(wallet, kind, newAddress, ts) }) }) });
}

/** Either personal key can cancel. */
export async function cancelRotation(wallet: string, signingKey: Hex, id: string): Promise<KeyRotation> {
 const ts = now();
 return call(`/v1/wallets/${wallet}/rotations/${id}/cancel`, { method: 'POST', body: JSON.stringify({ timestamp: ts, signature: await privateKeyToAccount(signingKey).signMessage({ message: cancelMessage(wallet, id, ts) }) }) });
}

/**
 * Finish a matured rotation: sign the exact rotateShard call, have the
 * co-signer add its signature, submit it through the relayer, then confirm the
 * new key is live. The signature is computed locally from the call itself.
 */
export async function finishRotation(walletAddress: string, signingKey: Hex, rotation: KeyRotation, onStatus: (s: string) => void): Promise<KeyRotation> {
 const wallet = getAddress(walletAddress) as Address;
 onStatus('Preparing the key replacement…');
 const [nonce, metadata] = await Promise.all([readAccountNonce(wallet), getWallet(wallet)]);
 const accountVersion = metadata.accountVersion === 2 ? 2 : 1;
 const data = encodeFunctionData({ abi: parseAbi(['function rotateShardA(address newShardA)', 'function rotateShardC(address newShardC)']), functionName: rotation.kind === 'device' ? 'rotateShardA' : 'rotateShardC', args: [getAddress(rotation.newAddress)] });
 const deadline = now() + 240;
 const signature = await privateKeyToAccount(signingKey).signMessage({ message: { raw: executionDigest(wallet, accountVersion, wallet, 0n, data, nonce, deadline) } });
 onStatus('Getting the co-signer’s signature…');
 const cosigned = await call<{ data: Hex; combinedSignatures: string }>(`/v1/wallets/${wallet}/rotations/${rotation.id}/cosign`, { method: 'POST', body: JSON.stringify({ nonce: nonce.toString(), deadline: String(deadline), signature }) });
 if (cosigned.data.toLowerCase() !== data.toLowerCase()) throw new Error('The co-signer prepared a different call. Nothing was submitted.');
 onStatus('Submitting on Robinhood Chain…');
 const result = await broadcastTransaction({ walletAddress: wallet, target: wallet, value: '0', data, nonce: Number(nonce), deadline, signatures: cosigned.combinedSignatures });
 if (!result.success) throw new Error(`The rotation transaction reverted: ${result.transactionHash}`);
 onStatus('Confirming the new key…');
 return call(`/v1/wallets/${wallet}/rotations/${rotation.id}/complete`, { method: 'POST', body: JSON.stringify({ txHash: result.transactionHash }) });
}

/** The new device key waits here, encrypted with the user's passphrase, until its rotation finishes. */
const PENDING_DEVICE = (wallet: string) => `veilora:rotation:new-device:${wallet.toLowerCase()}`;
export type PendingDeviceKey = { address: string; encrypted: string; rotationId: string | null; createdAt: string };
export function getPendingDeviceKey(wallet: string): PendingDeviceKey | null {
 try { const p = JSON.parse(localStorage.getItem(PENDING_DEVICE(wallet)) || 'null'); return p && typeof p.encrypted === 'string' && typeof p.address === 'string' ? p : null; } catch { return null; }
}
export function savePendingDeviceKey(wallet: string, value: PendingDeviceKey) { localStorage.setItem(PENDING_DEVICE(wallet), JSON.stringify(value)); }
export function clearPendingDeviceKey(wallet: string) { try { localStorage.removeItem(PENDING_DEVICE(wallet)); } catch { /* storage unavailable */ } }

export const timeUntil = (iso: string) => {
 const ms = Date.parse(iso) - Date.now();
 if (ms <= 0) return 'now';
 const h = Math.floor(ms / 3_600_000), m = Math.ceil((ms % 3_600_000) / 60_000);
 return h >= 1 ? `${h}h ${m}m` : `${m}m`;
};
