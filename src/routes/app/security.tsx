import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, Fingerprint, Laptop, Loader2, Server, X } from "lucide-react";
import { COSIGNER_VISIBILITY, SHARDS } from "@/demo/data";
import { Badge, Button, Card, DemoNote, KV, PageHeader } from "@/components/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/security")({
  component: SecurityScreen,
});

const SHARD_ICON = { A: Laptop, B: Server, C: Fingerprint } as const;

const DRILL = [
  "Pretend this device is lost (Shard A offline)",
  "Approve with your passkey (Shard C)",
  "Co-signer confirms policy (Shard B)",
  "New Shard A created on this device",
  "Old Shard A retired. Quorum restored",
];

const ORDER = [
  "Build intent",
  "Simulate transparent and shielded effects",
  "Evaluate policy and provenance",
  "Generate or validate proof inputs",
  "Show final plan and disclosures",
  "Explicit user approval",
  "Collect threshold signatures",
  "Submit via a permitted broadcaster",
  "Verify settlement and note commitments",
];

function SecurityScreen() {
  const [drill, setDrill] = useState(-1);
  const timer = useRef<number>(0);
  useEffect(() => {
    if (drill < 0 || drill >= DRILL.length) return;
    timer.current = window.setTimeout(() => setDrill((d) => d + 1), 1000);
    return () => clearTimeout(timer.current);
  }, [drill]);

  return (
    <>
      <PageHeader
        eyebrow="Custody and recovery"
        title="No single key can move funds."
        description="Your vault is split across three shards. Any two can sign; one alone can do nothing. Lose one, and the other two replace it."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {SHARDS.map((s) => {
          const Icon = SHARD_ICON[s.id];
          return (
            <div key={s.id} className="panel p-5">
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-gold-400/40 bg-gold-400/5 text-gold-300">
                  <Icon className="h-5 w-5" />
                </span>
                <Badge tone={s.status === "healthy" ? "teal" : "mist"}>{s.status}</Badge>
              </div>
              <p className="mt-4 font-display text-2xl text-cream">
                Shard {s.id} · {s.name}
              </p>
              <p className="mt-1 text-sm text-mist">{s.where}</p>
              <p className="mt-3 text-sm text-cream-dim">{s.role}</p>
              <p className="mt-3 text-xs text-mist">Last used {s.lastUsed}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="What the co-signer sees" eyebrow="Shard B trust boundary">
          <ul className="space-y-2.5">
            {COSIGNER_VISIBILITY.map((c) => (
              <li key={c.item} className="flex items-center gap-3 text-sm">
                {c.sees ? <Check className="h-4 w-4 text-gold-300" /> : <X className="h-4 w-4 text-teal-300" />}
                <span className="flex-1 text-cream-dim">{c.item}</span>
                <span className={cn("text-xs", c.sees ? "text-gold-300" : "text-teal-300")}>{c.sees ? "Sees" : "Never sees"}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5">
            <KV k="Stores" v="Plan hash and policy decision, 90 days" />
            <KV k="If it is unavailable" v="Sign with A + C instead. Policy is still checked on-device" />
            <KV k="If it misbehaves" v="It cannot sign alone. Rotate it out with A + C" />
            <KV k="Self-host" v="Deploy your own Shard B and audit its policy engine" />
          </div>
        </Card>

        <Card title="Recovery drill" eyebrow="Practise before you need it">
          <ol className="space-y-2.5">
            {DRILL.map((d, i) => {
              const done = drill > i;
              const active = drill === i;
              return (
                <li key={d} className={cn("flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm", done ? "border-teal-400/40" : active ? "border-gold-400/50" : "border-ink-600/60")}>
                  {done ? <Check className="h-4 w-4 text-teal-300" /> : active ? <Loader2 className="h-4 w-4 animate-spin text-gold-300" /> : <span className="h-4 w-4 rounded-full border border-ink-500" />}
                  <span className={done || active ? "text-cream" : "text-mist"}>{d}</span>
                </li>
              );
            })}
          </ol>
          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-xs text-mist">{drill >= DRILL.length ? "Drill passed. Nothing was moved." : "Last drill: Sep 12. Runs without moving funds."}</p>
            <Button variant={drill >= DRILL.length ? "outline" : "primary"} disabled={drill >= 0 && drill < DRILL.length} onClick={() => setDrill(0)}>
              {drill >= DRILL.length ? "Run again" : "Start drill"}
            </Button>
          </div>
        </Card>
      </div>

      <Card title="Signature and proof order" eyebrow="A proof is never an approval. A signature is never a proof." className="mt-6">
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ORDER.map((o, i) => (
            <li key={o} className="flex items-center gap-3 rounded-lg border border-ink-600/60 px-3.5 py-2.5 text-sm">
              <span className="font-display text-lg text-gold-300">{i + 1}</span>
              <span className="text-cream-dim">{o}</span>
            </li>
          ))}
        </ol>
        <div className="mt-4">
          <DemoNote />
        </div>
      </Card>
    </>
  );
}
