import { query } from "../db/index";

export type AlertType = "price" | "incoming" | "rule" | "security";
export type AlertSeverity = "info" | "success" | "warn" | "danger";
export type NewAlert = { type: AlertType; severity: AlertSeverity; title: string; body: string; ref: string; data?: Record<string, unknown> };

/**
 * Record an alert once per wallet and reference. Incoming and rule alerts
 * respect the owner's settings; security alerts are always recorded.
 * Never throws: an alert must not break the action that caused it.
 */
export async function recordAlert(walletAddress: string, alert: NewAlert): Promise<boolean> {
  try {
    const wallet = walletAddress.toLowerCase();
    if (alert.type === "incoming" || alert.type === "rule" || alert.type === "price") {
      const settings = await query<{ incoming: boolean; rules: boolean; prices: boolean }>("SELECT incoming, rules, prices FROM wallet_alert_settings WHERE wallet_address = $1", [wallet]);
      const row = settings.rows[0];
      if (row && ((alert.type === "incoming" && !row.incoming) || (alert.type === "rule" && !row.rules) || (alert.type === "price" && !row.prices))) return false;
    }
    const inserted = await query(
      `INSERT INTO wallet_alerts (wallet_address, type, severity, title, body, ref, data)
       SELECT $1, $2, $3, $4, $5, $6, $7 WHERE EXISTS (SELECT 1 FROM wallets WHERE address = $1)
       ON CONFLICT (wallet_address, ref) DO NOTHING RETURNING id`,
      [wallet, alert.type, alert.severity, alert.title.slice(0, 120), alert.body.slice(0, 400), alert.ref.slice(0, 200), JSON.stringify(alert.data ?? {})],
    );
    return inserted.rows.length > 0;
  } catch (error) {
    console.warn(JSON.stringify({ msg: "alert not recorded", type: alert.type, error: error instanceof Error ? error.message : String(error) }));
    return false;
  }
}
