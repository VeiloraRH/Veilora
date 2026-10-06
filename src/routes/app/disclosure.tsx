import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { KeyRound, Plus, X } from "lucide-react";
import { ACCESS_LOG, PROOFS, VIEW_KEYS, type ViewKey } from "@/demo/data";
import { Badge, Button, Card, DemoNote, Field, KV, PageHeader, Tabs, inputClass } from "@/components/ui";

export const Route = createFileRoute("/app/disclosure")({
  component: DisclosureScreen,
});

const KEY_TYPES: ViewKey["type"][] = ["Time-limited", "Tax period", "Note", "Counterparty", "Account"];
const STATUS_TONE = { active: "teal", expired: "mist", revoked: "coral" } as const;

function DisclosureScreen() {
  const [tab, setTab] = useState<"keys" | "proofs">("keys");
  return (
    <>
      <PageHeader
        eyebrow="Selective disclosure"
        title="Prove what's needed. Nothing more."
        description="Give an auditor, tax tool or counterparty a scoped, revocable view, and prove clean provenance without exposing your full book."
        actions={
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { id: "keys", label: "View keys" },
              { id: "proofs", label: "Provenance proofs" },
            ]}
          />
        }
      />
      {tab === "keys" ? <ViewKeys /> : <Proofs />}
    </>
  );
}

function ViewKeys() {
  const [keys, setKeys] = useState(VIEW_KEYS);
  const [log, setLog] = useState(ACCESS_LOG);
  const [issuing, setIssuing] = useState(false);
  const [holder, setHolder] = useState("");
  const [type, setType] = useState<ViewKey["type"]>("Time-limited");
  const [scope, setScope] = useState("Shielded USDG activity, Q4 2026");
  const [expires, setExpires] = useState("2027-01-31");

  const revoke = (k: ViewKey) => {
    setKeys((xs) => xs.map((x) => (x.id === k.id ? { ...x, status: "revoked" } : x)));
    setLog((l) => [{ when: "Just now", who: "You", what: `Revoked ${k.id} (${k.holder})` }, ...l]);
  };

  const issue = () => {
    const id = `vk-${String(keys.length + 8).padStart(2, "0")}`;
    const date = new Date(expires + "T00:00:00");
    const exp = isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    setKeys((xs) => [{ id, holder, scope, type, expires: exp, status: "active", lastAccess: "Never" }, ...xs]);
    setLog((l) => [{ when: "Just now", who: "You", what: `Issued ${id} to ${holder}` }, ...l]);
    setIssuing(false);
    setHolder("");
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
      <Card
        title="Who can see what"
        eyebrow={`${keys.filter((k) => k.status === "active").length} active view keys`}
        action={
          <Button variant="outline" className="!px-3 !py-1.5 text-xs" onClick={() => setIssuing((v) => !v)}>
            {issuing ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />} {issuing ? "Cancel" : "Issue key"}
          </Button>
        }
        bodyClassName="p-0"
      >
        {issuing && (
          <div className="grid gap-4 border-b border-ink-600/60 bg-ink-950/30 p-5 sm:grid-cols-2">
            <Field label="Holder">
              <input className={inputClass} placeholder="e.g. Harbor & Pike LLP" value={holder} onChange={(e) => setHolder(e.target.value)} />
            </Field>
            <Field label="Type">
              <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as ViewKey["type"])}>
                {KEY_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Scope">
              <input className={inputClass} value={scope} onChange={(e) => setScope(e.target.value)} />
            </Field>
            <Field label="Expires">
              <input type="date" className={inputClass} value={expires} onChange={(e) => setExpires(e.target.value)} />
            </Field>
            <div className="flex items-center justify-between gap-3 sm:col-span-2">
              <p className="text-xs text-mist">The holder can read only this scope. You can revoke it at any time; what they already saw stays with them.</p>
              <Button disabled={!holder.trim()} onClick={issue} className="shrink-0">
                <KeyRound className="h-4 w-4" /> Issue
              </Button>
            </div>
          </div>
        )}
        <ul>
          {keys.map((k) => (
            <li key={k.id} className="flex flex-col gap-3 border-t border-ink-600/50 px-5 py-4 first:border-0 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-cream">{k.holder}</p>
                  <Badge tone={STATUS_TONE[k.status]}>{k.status}</Badge>
                  <Badge>{k.type}</Badge>
                </div>
                <p className="mt-1 text-sm text-mist">{k.scope}</p>
                <p className="mt-0.5 text-xs text-mist/80">
                  Expires {k.expires} · Last access {k.lastAccess}
                </p>
              </div>
              {k.status === "active" && (
                <Button variant="danger" className="!px-3 !py-1.5 text-xs" onClick={() => revoke(k)}>
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <div className="space-y-6">
        <Card title="Access history" eyebrow="Every read and change" bodyClassName="p-0">
          <ul>
            {log.map((l, i) => (
              <li key={i} className="border-t border-ink-600/50 px-5 py-3 first:border-0">
                <p className="text-sm text-cream">{l.what}</p>
                <p className="text-xs text-mist">
                  {l.when} · {l.who}
                </p>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Good to know" eyebrow="Limits">
          <p className="text-sm leading-relaxed text-mist">
            Disclosed information is not private from the person you disclosed it to. Revoking a key stops future reads where the scheme allows it, but cannot pull back what was
            already seen.
          </p>
        </Card>
      </div>
    </div>
  );
}

function Proofs() {
  return (
    <div className="space-y-6">
      <div className="panel p-5 text-sm leading-relaxed text-mist">
        A clean-provenance proof shows that your inputs are members of a defined association set, without revealing your history. It is only as good as the set, its freshness and
        its coverage. It is not a universal “clean” guarantee.
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {PROOFS.map((p) => (
          <Card key={p.id} title={p.set} eyebrow={p.provider} action={<Badge tone={p.status === "valid" ? "teal" : "mist"}>{p.status}</Badge>}>
            <KV k="Set timestamp" v={p.timestamp} />
            <KV k="Freshness" v={p.freshness} />
            <KV k="Assets and routes covered" v={p.coverage} />
            <KV k="Valid until" v={p.validUntil} />
            <KV k="What it reveals" v={p.reveals} />
            <KV k="If the provider is unavailable" v={p.fallback} />
          </Card>
        ))}
      </div>
      <DemoNote>Demo data. Provider names and sets are placeholders.</DemoNote>
    </div>
  );
}
