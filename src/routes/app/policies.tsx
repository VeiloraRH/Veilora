import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Clock, Fuel, ListChecks, Percent, ShieldCheck, Wallet } from "lucide-react";
import { POLICIES, POLICY_VERSIONS, type Policy } from "@/demo/data";
import { Badge, Card, PageHeader, Stat } from "@/components/ui";
import { useMode } from "@/lib/mode";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/policies")({
  component: PoliciesScreen,
});

const ICON: Record<Policy["kind"], typeof Clock> = {
  limit: Wallet,
  fee: Percent,
  reserve: Fuel,
  allowlist: ListChecks,
  provenance: ShieldCheck,
  timing: Clock,
};

const BLOCKED = [
  { when: "Yesterday", what: "Send 12,000 USDG to a new address", why: "Over daily limit and not allowlisted" },
  { when: "Oct 1", what: "Bridge via Hop at 0.62%", why: "Over the 0.5% fee ceiling set in the intent" },
  { when: "Sep 26", what: "Swap leaving 0.03 ETH", why: "Would break the 0.05 ETH gas reserve" },
];

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", on ? "bg-gold-400" : "bg-ink-600")}
    >
      <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-cream transition-all", on ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

function PoliciesScreen() {
  const { mode } = useMode();
  const [policies, setPolicies] = useState(POLICIES);
  const [pendingChange, setPendingChange] = useState<string | null>(null);
  const enabled = policies.filter((p) => p.enabled).length;

  return (
    <>
      <PageHeader
        eyebrow="Policies and guardrails"
        title="Rules the co-signer enforces."
        description="Shard B signs only plans that pass these rules. Changing a policy is itself a signed action that needs two of your three keys."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active policies" value={`${enabled} / ${policies.length}`} />
        <Stat label="Policy version" value="v14" sub="Signed Oct 2" />
        <Stat label="Risky actions blocked" value="3" sub="Last 30 days" tone="gold" />
        <Stat label="Bypassed approvals" value="0" sub="Ever" tone="teal" />
      </div>

      {pendingChange && (
        <div className="mb-6 rounded-lg border border-gold-400/40 bg-gold-400/5 px-4 py-3 text-sm text-cream">
          {pendingChange} Policy change v15 is waiting in the outbox for a second signature.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card title="Policies" eyebrow={`Version v14${mode === "control" ? " · hash 0x5e7c…19fa" : ""}`} bodyClassName="p-0">
          <ul>
            {policies.map((p) => {
              const Icon = ICON[p.kind];
              return (
                <li key={p.id} className="flex items-start gap-4 border-t border-ink-600/50 px-5 py-4 first:border-0">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-gold-400/30 bg-gold-400/5 text-gold-300">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm font-medium", p.enabled ? "text-cream" : "text-mist")}>{p.name}</p>
                    <p className="text-sm text-mist">{p.rule}</p>
                    <p className="mt-1 text-xs text-mist/80">Applies to: {p.scope}</p>
                  </div>
                  <Toggle
                    label={p.name}
                    on={p.enabled}
                    onChange={(v) => {
                      setPolicies((xs) => xs.map((x) => (x.id === p.id ? { ...x, enabled: v } : x)));
                      setPendingChange(`${v ? "Enabled" : "Disabled"} “${p.name}”.`);
                    }}
                  />
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="space-y-6">
          <Card title="Blocked before signing" eyebrow="Guardrails at work" bodyClassName="p-0">
            <ul>
              {BLOCKED.map((b) => (
                <li key={b.what} className="border-t border-ink-600/50 px-5 py-3.5 first:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-cream">{b.what}</p>
                    <Badge tone="coral">blocked</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-mist">
                    {b.when} · {b.why}
                  </p>
                </li>
              ))}
            </ul>
          </Card>

          {mode === "control" ? (
            <Card title="Version history" eyebrow="Control mode" bodyClassName="p-0">
              <ul>
                {POLICY_VERSIONS.map((v) => (
                  <li key={v.version} className="border-t border-ink-600/50 px-5 py-3.5 first:border-0">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-mono text-gold-300">{v.version}</span>
                      <span className="text-xs text-mist">
                        {v.date} · {v.author}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-cream-dim">{v.change}</p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <Card title="Where policies run" eyebrow="Trust boundary">
              <p className="text-sm leading-relaxed text-mist">
                Policies are checked twice: on this device before you sign, and by the co-signer before it adds its signature. Organisations can deploy their own co-signer to keep
                policy enforcement in-house.
              </p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
