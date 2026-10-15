import { useQuery } from '@tanstack/react-query';
import { getAddress, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { API_BASE } from './api';
import { useWallet } from './walletContext';

export type AlertItem = { id: string; type: 'price' | 'incoming' | 'rule' | 'security'; severity: 'info' | 'success' | 'warn' | 'danger'; title: string; body: string; data: { txHash?: string; ruleId?: string }; createdAt: string; read: boolean };
export type PriceAlert = { id: string; asset: string; direction: 'above' | 'below'; priceUsdg: string; armed: boolean; lastPriceRaw: string | null; lastTriggeredAt: string | null; createdAt: string };
export type AlertsState = { alerts: AlertItem[]; unread: number; settings: { incoming: boolean; rules: boolean; prices: boolean; security: true }; priceAlerts: PriceAlert[]; priceAssets: string[] };

// Must match backend/src/routes/alerts.ts.
const readMessage = (w: string, ts: number) => `Veilora alerts access\nwallet:${getAddress(w)}\ntimestamp:${ts}`;
const changeMessage = (w: string, action: string, payload: string, ts: number) => `Veilora alerts change\nwallet:${getAddress(w)}\naction:${action}\npayload:${payload}\ntimestamp:${ts}`;
const now = () => Math.floor(Date.now() / 1000);

async function call<T>(path: string, init: RequestInit): Promise<T> {
 const response = await fetch(`${API_BASE}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } });
 const body = await response.json().catch(() => ({}));
 if (!response.ok) throw new Error(body.error || `Request failed with status ${response.status}`);
 return body as T;
}

export async function fetchAlerts(wallet: string, key: Hex): Promise<AlertsState> {
 const ts = now();
 return call(`/v1/wallets/${wallet}/alerts`, { method: 'GET', headers: { 'x-veilora-timestamp': String(ts), 'x-veilora-signature': await privateKeyToAccount(key).signMessage({ message: readMessage(wallet, ts) }) } });
}
export async function changeAlerts(wallet: string, key: Hex, action: 'read-all' | 'read-one' | 'unread-one' | 'settings' | 'price-add' | 'price-remove', payload: string): Promise<AlertsState> {
 const ts = now();
 return call(`/v1/wallets/${wallet}/alerts/change`, { method: 'POST', body: JSON.stringify({ action, payload, timestamp: ts, shardASignature: await privateKeyToAccount(key).signMessage({ message: changeMessage(wallet, action, payload, ts) }) }) });
}

/** Alerts for the active wallet, polled while the device key is unlocked. */
export function useAlerts() {
 const { walletAddress, getStoredDeviceKey } = useWallet(); const key = getStoredDeviceKey();
 return useQuery({ queryKey: ['alerts', walletAddress], enabled: !!walletAddress && !!key, refetchInterval: 30000, retry: 1, queryFn: () => fetchAlerts(walletAddress, key as Hex) });
}

const NOTIFY_KEY = 'veilora:alerts:desktop';
export const desktopNotificationsOn = () => { try { return localStorage.getItem(NOTIFY_KEY) === 'on' && typeof Notification !== 'undefined' && Notification.permission === 'granted'; } catch { return false; } };
export async function setDesktopNotifications(on: boolean): Promise<boolean> {
 if (on) {
  if (typeof Notification === 'undefined') throw new Error('This browser does not support notifications.');
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications are blocked for Veilora in this browser. Allow them in the site settings.');
 }
 try { localStorage.setItem(NOTIFY_KEY, on ? 'on' : 'off'); } catch { /* storage unavailable */ }
 return on;
}
