import { useEffect, useRef } from 'react';
import { Link } from '@tanstack/react-router';
import { Bell } from 'lucide-react';
import { desktopNotificationsOn, useAlerts } from '@/lib/alertsApi';
import { usePrivacyMode } from '@/lib/privacyMode';

/** Header bell with the unread count; shows desktop notifications for new alerts while the tab is open. */
export function AlertsBell() {
 const alerts = useAlerts(); const privacy = usePrivacyMode();
 const unread = alerts.data?.unread ?? 0;
 const seen = useRef<string | null>(null);
 useEffect(() => {
  const list = alerts.data?.alerts; if (!list?.length) return;
  const newest = list[0].id;
  // The first load only sets the baseline, so opening the app never replays old alerts.
  if (seen.current !== null && desktopNotificationsOn()) {
   for (const a of list.filter(a => !a.read && BigInt(a.id) > BigInt(seen.current!)).slice(0, 3).reverse()) {
    try { new Notification(privacy ? 'Veilora' : a.title, { body: privacy ? 'New alert. Open Veilora to see it.' : a.body, tag: `veilora-alert-${a.id}`, icon: '/favicon.png' }); } catch { /* notifications unavailable */ }
   }
  }
  if (seen.current === null || BigInt(newest) > BigInt(seen.current)) seen.current = newest;
 }, [alerts.data, privacy]);
 return <Link to="/app/alerts" className="wallet-icon-button wallet-alerts-bell" aria-label={unread ? `Alerts, ${unread} unread` : 'Alerts'} title="Alerts"><Bell size={18}/>{unread > 0 && <b>{unread > 99 ? '99+' : unread}</b>}</Link>;
}
