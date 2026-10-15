export type BridgeRecord = {
  requestId: string; chainId: number; chainName: string; explorer: string; sourceSymbol: string; amount: string;
  outputSymbol: string; outputAmount: string; recipient: string; approvalHash?: string; sourceHash?: string; status: string;
  error?: string; destinationHashes: string[]; updatedAt?: string;
};

const keyFor = (wallet: string) => `veilora:bridge:tracking:${wallet.toLowerCase()}`;
const changedEvent = 'veilora:bridge:tracking:changed';
const notificationKeyFor = (wallet: string) => `veilora:bridge:notifications:${wallet.toLowerCase()}`;
const finalStatuses = new Set(['success', 'completed', 'failure', 'failed', 'refund', 'refunded', 'action_required', 'rejected', 'expired']);

export function isBridgeStatusFinal(status: string) {
  return finalStatuses.has(status.toLowerCase());
}

export function loadBridgeRecords(wallet: string): BridgeRecord[] {
  if (!wallet) return [];
  try {
    const value: unknown = JSON.parse(localStorage.getItem(keyFor(wallet)) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is BridgeRecord => !!item && typeof item.requestId === 'string' && item.requestId.length <= 200 &&
      typeof item.chainId === 'number' && typeof item.chainName === 'string' && typeof item.explorer === 'string' &&
      typeof item.sourceSymbol === 'string' && typeof item.amount === 'string' && typeof item.outputSymbol === 'string' &&
      typeof item.outputAmount === 'string' && typeof item.recipient === 'string' && typeof item.status === 'string' &&
      Array.isArray(item.destinationHashes)).slice(0, 20);
  } catch { return []; }
}

export function saveBridgeRecords(wallet: string, records: BridgeRecord[]) {
  if (!wallet) return;
  localStorage.setItem(keyFor(wallet), JSON.stringify(records.slice(0, 20)));
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(changedEvent, { detail: { wallet: wallet.toLowerCase() } }));
}

/** Returns true only once per request/status, including across tabs on this device. */
export function claimBridgeNotification(wallet: string, requestId: string, status: string) {
  if (!wallet || !requestId || !isBridgeStatusFinal(status)) return false;
  try {
    const key = notificationKeyFor(wallet);
    const stored = JSON.parse(localStorage.getItem(key) || '{}') as Record<string, string>;
    if (stored[requestId] === status.toLowerCase()) return false;
    const next = { ...stored, [requestId]: status.toLowerCase() };
    const entries = Object.entries(next).slice(-100);
    localStorage.setItem(key, JSON.stringify(Object.fromEntries(entries)));
    return true;
  } catch { return false; }
}

export function clearBridgeNotifications(wallet: string) {
  if (wallet) localStorage.removeItem(notificationKeyFor(wallet));
}

export const bridgeTrackingChangedEvent = changedEvent;
