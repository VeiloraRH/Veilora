import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, Download } from "lucide-react";
import { RECEIPTS, type Receipt } from "@/demo/data";
import { Badge, Button, KV, PageHeader, Tabs } from "@/components/ui";
import { useMode } from "@/lib/mode";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/activity")({
  component: ActivityScreen,
});

type Filter = "all" | "private" | "public" | "disclosure";

const STATUS_TONE = { settled: "teal", pending: "gold", refunded: "gold", blocked: "coral" } as const;
const PRIVATE_KINDS: Receipt["kind"][] = ["shield", "unshield", "recipe", "receive"];

function exportCsv() {
  const cols: (keyof Receipt)[] = ["id", "time", "title", "kind", "status", "route", "fee", "proof", "provedOn", "commitment", "tx"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.join(","), ...RECEIPTS.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "veilora-receipts.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function ActivityScreen() {
  const { mode } = useMode();
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(RECEIPTS[0].id);
  const rows = RECEIPTS.filter((r) =>
    filter === "all" ? true : filter === "private" ? PRIVATE_KINDS.includes(r.kind) : filter === "disclosure" ? r.kind === "disclosure" : !PRIVATE_KINDS.includes(r.kind) && r.kind !== "disclosure",
  );

  return (
    <>
      <PageHeader
        eyebrow="Receipts"
        title="A local record of what happened."
        description="Every action saves a receipt on this device: the plan, the route, where the proof ran and the final commitment. Export it for an auditor when you choose to."
        actions={
          <Button variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />
      <div className="mb-5">
        <Tabs
          value={filter}
          onChange={setFilter}
          items={[
            { id: "all", label: "All" },
            { id: "private", label: "Shielded" },
            { id: "public", label: "Public" },
            { id: "disclosure", label: "Disclosures" },
          ]}
        />
      </div>
      <ul className="space-y-3">
        {rows.map((r) => {
          const isOpen = open === r.id;
          return (
            <li key={r.id} className="panel overflow-hidden">
              <button onClick={() => setOpen(isOpen ? null : r.id)} className="flex w-full items-center gap-4 px-5 py-4 text-left">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-cream">{r.title}</p>
                  <p className="text-xs text-mist">
                    {r.time} · {r.route}
                  </p>
                </div>
                <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-mist transition-transform", isOpen && "rotate-180")} />
              </button>
              {isOpen && (
                <div className="grid gap-x-8 border-t border-ink-600/60 px-5 py-3 sm:grid-cols-2">
                  <div>
                    <KV k="Receipt" v={r.id} mono />
                    <KV k="Type" v={r.kind} />
                    <KV k="Fee" v={r.fee} />
                  </div>
                  <div>
                    <KV k="Proof" v={r.proof} />
                    <KV k="Proved on" v={r.provedOn} />
                    {mode === "control" && r.commitment && <KV k="Note commitment" v={r.commitment} mono />}
                    {mode === "control" && r.tx && <KV k="Transaction" v={r.tx} mono />}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
