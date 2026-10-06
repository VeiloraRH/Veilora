import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
import { Check, CircleX, Loader2, Timer } from "lucide-react";
import { OUTBOX, OUTBOX_STATUS, PLANS, PROOF_STATES, usd, type OutboxItem, type SigState } from "@/demo/data";
import { Badge, Button, Card, DemoNote, Dot, KV, PageHeader, VisibilityBadge } from "@/components/ui";
import { useMode } from "@/lib/mode";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/outbox")({
  component: OutboxScreen,
});

const SHARD_LABEL = { A: "This device", B: "Policy co-signer", C: "Passkey / recovery" } as const;

function SigPill({ id, s, busy }: { id: "A" | "B" | "C"; s: SigState; busy?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-lg border px-3.5 py-2.5", s === "signed" ? "border-teal-400/40 bg-teal-400/5" : "border-ink-600")}>
      <span className="grid h-7 w-7 place-items-center rounded-full border border-gold-400/40 font-display text-gold-300">{id}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-cream">{SHARD_LABEL[id]}</p>
        <p className="text-xs text-mist">{s === "signed" ? "Signed" : s === "pending" ? (busy ? "Signing…" : "Waiting") : "Standby (not needed for 2-of-3)"}</p>
      </div>
      {s === "signed" ? <Check className="h-4 w-4 text-teal-300" /> : busy ? <Loader2 className="h-4 w-4 animate-spin text-gold-300" /> : null}
    </div>
  );
}

function OutboxScreen() {
  const { mode } = useMode();
  const [items, setItems] = useState<OutboxItem[]>(OUTBOX);
  const [selectedId, setSelectedId] = useState(OUTBOX[0].id);
  const [busy, setBusy] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const item = items.find((i) => i.id === selectedId) ?? items[0];
  const plan = PLANS.find((p) => p.id === item?.planId);
  const update = (id: string, patch: Partial<OutboxItem>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const approve = (o: OutboxItem) => {
    update(o.id, { status: "collecting-signatures", signatures: { ...o.signatures, A: "signed" } });
    setBusy(true);
    timers.current.push(
      window.setTimeout(() => {
        update(o.id, { status: "ready", signatures: { A: "signed", B: "signed", C: "standby" }, expires: "Submitting via " + o.broadcaster });
        setBusy(false);
      }, 1600),
    );
  };

  const reject = (o: OutboxItem) => {
    setItems((xs) => xs.filter((x) => x.id !== o.id));
    setSelectedId(items.find((x) => x.id !== o.id)?.id ?? "");
  };

  return (
    <>
      <PageHeader
        eyebrow="Outbox"
        title="Nothing moves without your yes."
        description="Every planned action waits here. Approve it with this device, and the policy co-signer adds the second signature only if your policies pass."
      />

      {!item ? (
        <Card>
          <p className="text-sm text-mist">The outbox is empty.</p>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_1.25fr]">
          <ul className="space-y-3">
            {items.map((o) => (
              <li key={o.id}>
                <button onClick={() => setSelectedId(o.id)} className={cn("panel w-full p-4 text-left transition-colors", o.id === item.id ? "!border-gold-400/70" : "hover:!border-ink-500")}>
                  <div className="flex items-start gap-3">
                    <Dot tone={OUTBOX_STATUS[o.status].tone} pulse={o.status === "awaiting-approval"} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-cream">{o.title}</p>
                      <p className="mt-0.5 text-xs text-mist">
                        {o.created} · {usd(o.amountUsd)}
                      </p>
                    </div>
                    <Badge tone={OUTBOX_STATUS[o.status].tone}>{OUTBOX_STATUS[o.status].label}</Badge>
                  </div>
                </button>
              </li>
            ))}
          </ul>

          <Card title={item.title} eyebrow={`${item.id} · ${OUTBOX_STATUS[item.status].label}`} className="xl:sticky xl:top-24 xl:self-start">
            {item.status === "blocked" && (
              <div className="mb-5 flex gap-3 rounded-lg border border-coral-500/40 bg-coral-500/5 p-4 text-sm">
                <CircleX className="h-5 w-5 shrink-0 text-coral-400" />
                <div>
                  <p className="text-cream">Blocked before signing</p>
                  <p className="text-xs text-mist">12,000 USDG is over the 10,000 daily limit, and the address is not on your allowlist. The co-signer refused to sign.</p>
                </div>
              </div>
            )}

            <p className="mb-2 text-xs uppercase tracking-[0.14em] text-mist">Signatures · 2 of 3 needed</p>
            <div className="grid gap-2">
              {(["A", "B", "C"] as const).map((k) => (
                <SigPill key={k} id={k} s={item.signatures[k]} busy={busy && k === "B"} />
              ))}
            </div>

            {item.status === "proof-pending" && (
              <div className="mt-5">
                <p className="mb-2 text-xs uppercase tracking-[0.14em] text-mist">Proof state</p>
                <ol className="space-y-1.5 text-sm">
                  {PROOF_STATES.map((s, i) => (
                    <li key={s} className="flex items-center gap-2.5">
                      {i === 0 ? <Check className="h-4 w-4 text-teal-300" /> : i === 1 ? <Loader2 className="h-4 w-4 animate-spin text-gold-300" /> : <span className="h-4 w-4 rounded-full border border-ink-500" />}
                      <span className={i <= 1 ? "text-cream" : "text-mist"}>{s}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-2 flex items-center gap-2 text-xs text-mist">
                  <Timer className="h-3.5 w-3.5" /> {item.expires}. Funds are safe in every state.
                </p>
              </div>
            )}

            <div className="mt-5">
              <KV k="Value" v={usd(item.amountUsd)} />
              <KV k="Policy result" v={<Badge tone={item.policy === "pass" ? "teal" : item.policy === "warn" ? "gold" : "coral"}>{item.policy}</Badge>} />
              <KV k="Broadcaster" v={item.broadcaster} />
              <KV k="Expires" v={item.expires} />
              {plan && <KV k="Total cost" v={`${(plan.totalFeeBps / 100).toFixed(2)}%`} />}
            </div>

            {plan && mode === "control" && (
              <div className="mt-5 space-y-2">
                <p className="text-xs uppercase tracking-[0.14em] text-mist">Route · Control mode</p>
                {plan.steps.map((s) => (
                  <div key={s.label} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-cream-dim">{s.label}</span>
                    <VisibilityBadge v={s.visibility} />
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 border-t border-ink-600/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <DemoNote />
              <div className="flex gap-2">
                {item.status !== "ready" && (
                  <Button variant="danger" onClick={() => reject(item)}>
                    {item.status === "blocked" ? "Dismiss" : "Reject"}
                  </Button>
                )}
                {item.status === "awaiting-approval" && (
                  <Button onClick={() => approve(item)} disabled={busy}>
                    Approve
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
