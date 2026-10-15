import { desktopNotificationsOn } from './alertsApi';
import { claimBridgeNotification, type BridgeRecord } from './bridgeTracking';

/** Notify once when Relay reports a final outcome. Notification content respects screen privacy mode. */
export function notifyBridgeOutcome(wallet: string, record: BridgeRecord, privacy: boolean) {
  if (!claimBridgeNotification(wallet, record.requestId, record.status)) return;
  if (!desktopNotificationsOn() || typeof Notification === 'undefined') return;
  const success = ['success', 'completed'].includes(record.status.toLowerCase());
  const refunded = ['refund', 'refunded'].includes(record.status.toLowerCase());
  const title = privacy ? 'Veilora bridge update' : success ? 'Bridge complete' : refunded ? 'Bridge refunded' : 'Bridge needs attention';
  const body = privacy ? 'A bridge status changed. Open Veilora to review it.' : success
    ? `Relay delivered ${record.outputAmount} to ${record.chainName}.`
    : refunded
      ? `Relay reports a refund for your transfer to ${record.chainName}. Check Bridge activity for details.`
      : `Relay reports ${record.status} for your transfer to ${record.chainName}. Check Bridge activity for details.`;
  try {
    const notification = new Notification(title, { body, tag: `veilora-bridge-${record.requestId}`, icon: '/favicon.png' });
    notification.onclick = () => { window.focus(); window.location.assign('/app/bridge'); notification.close(); };
  } catch { /* Notification permission or support may have changed since the setting was saved. */ }
}
