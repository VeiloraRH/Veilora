import { useQuery } from '@tanstack/react-query';
import { getAddress, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { API_BASE } from './api';
import { useWallet } from './walletContext';

export type SpendingPolicy = {
  perTransactionPercent: number;
  dailyTotalPercent: number;
  dailySpend: Record<string, { spent: string; balance: string | null }>;
};
const now = () => Math.floor(Date.now() / 1000);
const sign = (key: Hex, message: string) => privateKeyToAccount(key).signMessage({ message });
async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed with status ${response.status}`);
  return body as T;
}
export async function fetchSpendingPolicy(wallet: string, key: Hex): Promise<SpendingPolicy> {
  const timestamp = now();
  const message = `Veilora spending limits access\nwallet:${getAddress(wallet)}\ntimestamp:${timestamp}`;
  return request(`/v1/wallets/${wallet}/spending-policy`, { method: 'GET', headers: { 'x-veilora-timestamp': String(timestamp), 'x-veilora-signature': await sign(key, message) } });
}
export async function saveSpendingPolicy(wallet: string, key: Hex, perTransactionPercent: number, dailyTotalPercent: number): Promise<SpendingPolicy> {
  const timestamp = now();
  const message = `Veilora spending limits update\nwallet:${getAddress(wallet)}\nperTransactionPercent:${perTransactionPercent}\ndailyTotalPercent:${dailyTotalPercent}\ntimestamp:${timestamp}`;
  return request(`/v1/wallets/${wallet}/spending-policy`, { method: 'PUT', body: JSON.stringify({ perTransactionPercent, dailyTotalPercent, timestamp, shardASignature: await sign(key, message) }) });
}
export function useSpendingPolicy() {
  const { walletAddress, getStoredDeviceKey } = useWallet();
  const key = getStoredDeviceKey();
  return useQuery({ queryKey: ['spending-policy', walletAddress], enabled: !!walletAddress && !!key, retry: 1, queryFn: () => fetchSpendingPolicy(walletAddress, key as Hex) });
}
