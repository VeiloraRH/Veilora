import { getAddress, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { API_BASE } from './api';

/**
 * Authenticator app codes that can freeze the wallet from any device. Setup
 * and removal are signed by the device key; removal also needs a current code.
 * A code can only freeze — unfreezing still needs the recovery key.
 */
type Action = 'status' | 'setup' | 'confirm' | 'remove';
export const authenticatorMessage = (action: Action, wallet: string, timestamp: number, code = '') =>
 `Veilora authenticator ${action}\nwallet:${getAddress(wallet)}${code ? `\ncode:${code}` : ''}\ntimestamp:${timestamp}`;

const now = () => Math.floor(Date.now() / 1000);
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
 const response = await fetch(`${API_BASE}/v1/wallets/${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } });
 const body = await response.json().catch(() => ({}));
 if (!response.ok) throw new Error(body.error || `Request failed with status ${response.status}`);
 return body as T;
}
async function signed(action: Action, wallet: string, key: Hex, code = '') {
 const timestamp = now();
 return { code, timestamp, shardASignature: await privateKeyToAccount(key).signMessage({ message: authenticatorMessage(action, wallet, timestamp, code) }) };
}

export async function authenticatorStatus(wallet: string, key: Hex): Promise<{ enabled: boolean; enabledAt: string | null }> {
 const timestamp = now();
 const signature = await privateKeyToAccount(key).signMessage({ message: authenticatorMessage('status', wallet, timestamp) });
 return request(`${wallet}/authenticator`, { headers: { 'x-veilora-timestamp': String(timestamp), 'x-veilora-signature': signature } });
}
export const startAuthenticatorSetup = async (wallet: string, key: Hex) =>
 request<{ secret: string; uri: string }>(`${wallet}/authenticator/setup`, { method: 'POST', body: JSON.stringify(await signed('setup', wallet, key)) });
export const confirmAuthenticator = async (wallet: string, key: Hex, code: string) =>
 request<{ enabled: boolean }>(`${wallet}/authenticator/confirm`, { method: 'POST', body: JSON.stringify(await signed('confirm', wallet, key, code)) });
export const removeAuthenticator = async (wallet: string, key: Hex, code: string) =>
 request<{ enabled: boolean }>(`${wallet}/authenticator/remove`, { method: 'POST', body: JSON.stringify(await signed('remove', wallet, key, code)) });
export const freezeWithCode = (wallet: string, code: string, hours: number) =>
 request<{ frozen: boolean; frozenUntil: string | null }>(`${wallet}/authenticator/freeze`, { method: 'POST', body: JSON.stringify({ code, hours }) });
