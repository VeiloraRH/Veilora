import { Link } from "@tanstack/react-router";
import { CheckCircle2, ArrowRight } from "lucide-react";

interface ActivityQueueProps {
  auditTrail: Array<{
    id: string;
    user_op_hash: string;
    status: string;
    created_at: string;
  }>;
}

export function ActivityQueue({ auditTrail }: ActivityQueueProps) {
  return (
    <div className="panel p-6 bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-cream">Signing Queue</h3>
          <p className="text-xs text-slate-500 dark:text-mist">2-of-3 threshold approval status</p>
        </div>
        <Link to="/app/outbox" className="text-xs text-[#eaba65] hover:underline font-medium flex items-center gap-1">
          <span>Open Outbox</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-100 dark:border-ink-800 bg-slate-50/70 dark:bg-ink-950/40 p-4 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-400/10 text-teal-600 dark:text-teal-300 mx-auto mb-2">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <p className="text-sm font-semibold text-slate-900 dark:text-cream">All queues signed and clear</p>
        <p className="text-xs text-slate-500 dark:text-mist mt-0.5">
          0 operations awaiting your device or co-signer signatures.
        </p>
      </div>

      <div>
        <p className="text-xs font-medium text-slate-500 dark:text-mist mb-2">Recent Audit Events</p>
        {auditTrail.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-mist py-2">
            No past transactions recorded on this account yet.
          </p>
        ) : (
          <div className="space-y-2">
            {auditTrail.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-ink-800 bg-slate-50 dark:bg-ink-950/60 p-2.5 text-xs"
              >
                <div>
                  <span className="font-mono text-slate-900 dark:text-cream font-medium">
                    {item.user_op_hash.slice(0, 12)}…
                  </span>
                  <p className="text-[11px] text-slate-400 dark:text-mist">
                    {new Date(item.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="rounded-full bg-teal-400/10 px-2 py-0.5 text-[10px] font-semibold text-teal-600 dark:text-teal-300">
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
