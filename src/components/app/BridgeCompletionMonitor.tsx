import { useEffect } from 'react';
import { getBridgeStatus } from '@/lib/api';
import { useWallet } from '@/lib/walletContext';
import { usePrivacyMode } from '@/lib/privacyMode';
import { bridgeTrackingChangedEvent, isBridgeStatusFinal, loadBridgeRecords, saveBridgeRecords, type BridgeRecord } from '@/lib/bridgeTracking';
import { notifyBridgeOutcome } from '@/lib/bridgeNotifications';

/** Watches this device's submitted bridge requests while Veilora is open, regardless of current screen. */
export function BridgeCompletionMonitor({ enabled }: { enabled: boolean }) {
  const { walletAddress } = useWallet();
  const privacy = usePrivacyMode();

  useEffect(() => {
    if (!enabled || !walletAddress) return;
    let stopped = false;
    let checking = false;
    const poll = async () => {
      if (stopped || checking) return;
      checking = true;
      try {
        const initial = loadBridgeRecords(walletAddress);
        const pending = initial.filter((record) => record.sourceHash && !isBridgeStatusFinal(record.status)).slice(0, 20);
        let changed = false;
        const byId = new Map<string, BridgeRecord>();
        const refresh = async (record: BridgeRecord) => {
          try {
            const { status } = await getBridgeStatus(record.requestId);
            const updated = { ...record, status: status.status, destinationHashes: status.outTxHashes, updatedAt: status.updatedAt || undefined };
            if (isBridgeStatusFinal(updated.status)) notifyBridgeOutcome(walletAddress, updated, privacy);
            if (updated.status !== record.status || updated.updatedAt !== record.updatedAt || JSON.stringify(updated.destinationHashes) !== JSON.stringify(record.destinationHashes)) changed = true;
            return updated;
          } catch { return record; }
        };
        for (let offset = 0; offset < pending.length; offset += 4) {
          const batch = await Promise.all(pending.slice(offset, offset + 4).map(refresh));
          batch.forEach((record) => byId.set(record.requestId, record));
          if (stopped) return;
        }
        if (changed) saveBridgeRecords(walletAddress, initial.map((record) => byId.get(record.requestId) ?? record));
      } finally { checking = false; }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 30_000);
    const changed = (event?: Event) => {
      const owner = (event as CustomEvent<{ wallet?: string }> | undefined)?.detail?.wallet;
      if (!owner || owner === walletAddress.toLowerCase()) void poll();
    };
    window.addEventListener(bridgeTrackingChangedEvent, changed);
    window.addEventListener('storage', changed);
    return () => { stopped = true; window.clearInterval(timer); window.removeEventListener(bridgeTrackingChangedEvent, changed); window.removeEventListener('storage', changed); };
  }, [enabled, walletAddress, privacy]);

  return null;
}
