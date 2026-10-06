import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, CircleAlert, CircleX, Cpu, Loader2, Lock } from "lucide-react";
import { INTENT_SUGGESTIONS, matchPlan, type Plan, type PolicyCheck } from "@/demo/data";
import { Badge, Button, Card, DemoNote, KV, PageHeader, VisibilityBadge, inputClass } from "@/components/ui";
import { useMode } from "@/lib/mode";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/intent")({
  validateSearch: (s: Record<string, unknown>): { goal?: string } => ({
    goal: typeof s.goal === "string" ? s.goal : undefined,
  }),
  component: IntentConsole,
});

// The control loop, in the order the product doc requires.
const STAGES = ["Plan", "Simulate", "Policy", "Disclose", "Approve"] as const;

type Sign = "idle" | "device" | "cosigner" | "queued";

function PolicyIcon({ r }: { r: PolicyCheck["result"] }) {
  if (r === "pass") return <Check className="h-4 w-4 text-teal-300" />;
  if (r === "warn") return <CircleAlert className="h-4 w-4 text-gold-300" />;
  return <CircleX className="h-4 w-4 text-coral-400" />;
}

function IntentConsole() {
  const { goal: initial } = Route.useSearch();
  const { mode } = useMode();
  const [text, setText] = useState(initial ?? INTENT_SUGGESTIONS[0]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [stage, setStage] = useState(-1); // index into STAGES that has completed
  const [reviewed, setReviewed] = useState(false);
  const [sign, setSign] = useState<Sign>("idle");
  const timers = useRef<number[]>([]);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clear, []);

  const run = (goal: string) => {
    clear();
    setText(goal);
    setPlan(matchPlan(goal));
    setReviewed(false);
    setSign("idle");
    setStage(-1);
    // Each stage resolves in turn so the user watches the plan being checked.
    [0, 1, 2, 3].forEach((i) => timers.current.push(window.setTimeout(() => setStage(i), 350 + i * 450)));
  };

  useEffect(() => {
    if (initial) run(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const approve = () => {
    setStage(4);
    setSign("device");
    timers.current.push(window.setTimeout(() => setSign("cosigner"), 900));
    timers.current.push(window.setTimeout(() => setSign("queued"), 2100));
  };

  const overLimit = plan ? plan.totalFeeBps > plan.limitBps : false;
  const blocked = plan?.policy.some((p) => p.result === "fail") || overLimit;

  return (
    <>
      <PageHeader
        eyebrow="Intent Console"
        title="Say what you want. Review what happens."
        description="Describe a goal in plain words. Veilora plans it on this device, simulates it, checks your policies and shows who sees what. Nothing moves without your yes."
      />

      <div className="panel p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(text);
          }}
        >
          <textarea
            className={cn(inputClass, "min-h-[92px] resize-y font-display text-lg leading-snug")}
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Your goal"
          />
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-xs text-mist">
              <Lock className="h-3.5 w-3.5 text-gold-400" /> Parsed locally. The raw text never leaves this device.
            </p>
            <Button type="submit">
              Plan locally <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {INTENT_SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => run(s)}
              className="max-w-full truncate rounded-full border border-ink-600 px-3 py-1 text-xs text-mist hover:border-gold-400/60 hover:text-cream"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {plan && (
        <>
          {/* Stage rail */}
          <ol className="my-8 grid grid-cols-5 gap-2">
            {STAGES.map((s, i) => {
              const done = stage >= i;
              const active = stage + 1 === i;
              return (
                <li key={s} className="min-w-0">
                  <div className={cn("h-1 rounded-full transition-colors duration-500", done ? "bg-brand-gradient" : "bg-ink-700")} />
                  <p className={cn("mt-2 truncate text-xs", done ? "text-gold-300" : active ? "text-cream" : "text-mist")}>
                    {i + 1}. {s}
                  </p>
                </li>
              );
            })}
          </ol>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card title="Structured plan" eyebrow="1 · Plan" className={stage < 0 ? "opacity-50" : ""}>
              <div className="mb-4 grid gap-2 sm:grid-cols-2">
                {plan.constraints.map((c) => (
                  <div key={c.label} className="rounded-lg border border-ink-600/70 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-mist">{c.label}</p>
                    <p className="text-sm text-cream">{c.value}</p>
                  </div>
                ))}
              </div>
              <ol className="space-y-3">
                {plan.steps.map((s, i) => (
                  <li key={s.label} className="flex gap-3">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-gold-400/40 text-xs text-gold-300">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-cream">{s.label}</p>
                        <VisibilityBadge v={s.visibility} />
                      </div>
                      <p className="text-xs text-mist">{s.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
              {mode === "control" && (
                <pre className="mt-5 overflow-x-auto rounded-lg border border-ink-600 bg-ink-950 p-3 font-mono text-[11px] leading-relaxed text-cream-dim">
                  {JSON.stringify({ id: plan.id, route: plan.route, maxTotalFeeBps: plan.limitBps, steps: plan.steps.map((s) => s.label) }, null, 2)}
                </pre>
              )}
            </Card>

            <Card title="Before and after" eyebrow="2 · Simulate" className={stage < 1 ? "opacity-50" : ""}>
              {stage < 1 ? (
                <p className="flex items-center gap-2 text-sm text-mist">
                  <Loader2 className="h-4 w-4 animate-spin" /> Simulating balances, fees and route…
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-mist">
                          <th className="pb-2 font-medium">Balance</th>
                          <th className="pb-2 text-right font-medium">Before</th>
                          <th className="pb-2 text-right font-medium">After</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plan.diff.map((d) => (
                          <tr key={d.label} className="border-t border-ink-600/50">
                            <td className="py-2.5 text-cream-dim">{d.label}</td>
                            <td className="py-2.5 text-right tabular-nums text-mist">{d.before}</td>
                            <td className={cn("py-2.5 text-right font-medium tabular-nums", d.tone === "teal" ? "text-teal-300" : d.tone === "coral" ? "text-coral-400" : "text-cream")}>
                              {d.after}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-5">
                    {plan.costs.map((c) => (
                      <KV key={c.label} k={c.label} v={c.value} />
                    ))}
                    <KV
                      k={<span className="font-medium text-cream">Total cost</span>}
                      v={
                        <span className={overLimit ? "text-coral-400" : "text-teal-300"}>
                          {(plan.totalFeeBps / 100).toFixed(2)}% <span className="text-mist">/ limit {(plan.limitBps / 100).toFixed(2)}%</span>
                        </span>
                      }
                    />
                  </div>
                  <p className="mt-4 text-xs text-mist">
                    Route: <span className="text-cream-dim">{plan.route}</span> · {plan.eta}
                  </p>
                </>
              )}
            </Card>

            <Card title="Policy and provenance" eyebrow="3 · Policy" className={stage < 2 ? "opacity-50" : ""}>
              {stage < 2 ? (
                <p className="flex items-center gap-2 text-sm text-mist">
                  <Loader2 className="h-4 w-4 animate-spin" /> Checking limits, reserves and provenance…
                </p>
              ) : (
                <ul className="space-y-3">
                  {plan.policy.map((p) => (
                    <li key={p.rule} className="flex gap-3">
                      <PolicyIcon r={p.result} />
                      <div>
                        <p className="text-sm text-cream">{p.rule}</p>
                        <p className="text-xs text-mist">{p.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="What leaves this device" eyebrow="4 · Disclose" className={stage < 3 ? "opacity-50" : ""}>
              {stage < 3 ? (
                <p className="flex items-center gap-2 text-sm text-mist">
                  <Loader2 className="h-4 w-4 animate-spin" /> Listing every party that will see something…
                </p>
              ) : (
                <ul className="space-y-3">
                  {plan.disclosures.map((d) => (
                    <li key={d.party} className="rounded-lg border border-ink-600/60 px-3.5 py-2.5">
                      <p className="text-sm text-cream">{d.party}</p>
                      <p className="text-xs text-mist">{d.sees}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* Approval */}
          <div className={cn("panel mt-6 p-6", stage < 3 && "pointer-events-none opacity-50")}>
            <p className="eyebrow mb-2">5 · Approve</p>
            {blocked ? (
              <div className="flex items-start gap-3 text-sm">
                <CircleX className="mt-0.5 h-5 w-5 text-coral-400" />
                <p className="text-cream">This plan breaks a policy, so it cannot be approved. Change the goal or the policy first.</p>
              </div>
            ) : sign === "idle" ? (
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <label className="flex items-start gap-3 text-sm text-cream-dim">
                  <input type="checkbox" className="mt-1 accent-[#eaba65]" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />
                  <span>I reviewed the balance changes, the policy results and what each party will see.</span>
                </label>
                <Button disabled={!reviewed} onClick={approve} className="shrink-0">
                  Approve with this device
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <SignStep label="Shard A · this device" done />
                <SignStep label="Shard B · policy co-signer" done={sign === "cosigner" || sign === "queued"} busy={sign === "device"} />
                <SignStep label="Queued in outbox" done={sign === "queued"} busy={sign === "cosigner"} />
              </div>
            )}
            {sign === "queued" && (
              <div className="mt-5 flex flex-col gap-3 border-t border-ink-600/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-2 text-sm text-cream">
                  <Cpu className="h-4 w-4 text-gold-400" /> 2-of-3 reached. The plan is in the outbox, ready for its broadcaster.
                </p>
                <Link to="/app/outbox">
                  <Button variant="outline">
                    Open outbox <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            )}
            <div className="mt-4">
              <DemoNote />
            </div>
          </div>
        </>
      )}
    </>
  );
}

function SignStep({ label, done, busy }: { label: string; done?: boolean; busy?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-lg border px-3.5 py-3", done ? "border-teal-400/40 bg-teal-400/5" : "border-ink-600")}>
      {done ? <Check className="h-4 w-4 text-teal-300" /> : busy ? <Loader2 className="h-4 w-4 animate-spin text-gold-300" /> : <span className="h-4 w-4 rounded-full border border-ink-500" />}
      <span className="text-sm text-cream">{label}</span>
      {done && <Badge tone="teal" className="ml-auto">done</Badge>}
    </div>
  );
}
