import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { Badge, Button, Card, KV, PageHeader } from "@/components/ui";
import { useWallet } from "@/lib/walletContext";
import { getWalletAudit } from "@/lib/api";

export const Route = createFileRoute("/app/activity")({ component: ActivityScreen });

type AuditRecord = {
  id: string | number;
  user_op_hash: string;
  status: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function exportCsv(records: AuditRecord[]) {
  const cols: (keyof AuditRecord)[] = ["id", "created_at", "status", "user_op_hash", "metadata"];
  const esc = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.join(","), ...records.map((record) => cols.map((key) => esc(typeof record[key] === "object" ? JSON.stringify(record[key]) : record[key])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "veilora-audit-events.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function ActivityScreen() {
  const { walletAddress } = useWallet();
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRecords = useCallback(async () => {
    if (!walletAddress) {
      setRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await getWalletAudit(walletAddress);
      setRecords(response.records);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load wallet audit events.");
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => { void loadRecords(); }, [loadRecords]);

  return (
    <>
      <PageHeader
        eyebrow="Audit events"
        title="Co-signing activity from your wallet."
        description="These events come from the Veilora backend audit log. It records Shard B approval or refusal events; it is not a complete on-chain transaction history."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void loadRecords()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button variant="outline" onClick={() => exportCsv(records)} disabled={!records.length}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>
        }
      />

      {loading ? (
        <Card className="p-6 text-sm text-mist">Loading audit events…</Card>
      ) : error ? (
        <Card className="space-y-4 p-6">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-cream">Could not load audit events</h2>
            <p role="alert" className="mt-1 text-sm text-rose-600">{error}</p>
          </div>
          <Button variant="outline" onClick={() => void loadRecords()}>Try again</Button>
        </Card>
      ) : records.length === 0 ? (
        <Card className="p-6">
          <h2 className="font-semibold text-slate-900 dark:text-cream">No co-signing events yet</h2>
          <p className="mt-1 text-sm text-mist">Shard B approvals and refusals for this wallet will appear here.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {records.map((record) => {
            const metadata = record.metadata ?? {};
            const approved = record.status === "APPROVED";
            return (
              <li key={record.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-900">
                <div className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 dark:text-cream">{approved ? "Shard B approved request" : "Shard B refused request"}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-mist">{formatDate(record.created_at)} · Event {record.id}</p>
                  </div>
                  <Badge tone={approved ? "teal" : "coral"}>{record.status}</Badge>
                </div>
                <div className="grid gap-x-8 border-t border-slate-100 px-5 py-3 dark:border-ink-700/60 sm:grid-cols-2">
                  <div>
                    <KV k="Request digest" v={record.user_op_hash} mono />
                    {typeof metadata.target === "string" && <KV k="Target" v={metadata.target} mono />}
                  </div>
                  <div>
                    {metadata.nonce !== undefined && <KV k="Nonce" v={String(metadata.nonce)} />}
                    {typeof metadata.reason === "string" && <KV k="Reason" v={metadata.reason} />}
                    {typeof metadata.timestamp === "string" && <KV k="Recorded at" v={formatDate(metadata.timestamp)} />}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
