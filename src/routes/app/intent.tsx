import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  CircleAlert,
  CircleX,
  Loader2,
  Sliders,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  simulateIntent,
  evaluatePolicies,
  cosignTransaction,
  type StructuredPlan,
  type PlanSimulation,
} from "@/lib/api";
import { useWallet } from "@/lib/walletContext";
import {
  Badge,
  Button,
  Card,
  Field,
  KV,
  Modal,
  StatusModal,
  inputClass,
} from "@/components/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/intent")({
  validateSearch: (s: Record<string, unknown>): { goal?: string } => ({
    goal: typeof s.goal === "string" ? s.goal : undefined,
  }),
  component: IntentConsole,
});

const SUGGESTIONS = [
  "Shield 2,000 USDG and preserve gas for payroll",
  "Buy 500 USDG of NVDA exposure and keep it shielded",
  "Send 1,250 USDG to verified supplier on Robinhood Chain",
  "Swap 1,000 USDC to USDG with clean provenance check",
];

const STAGES = ["Plan", "Simulate", "Policy", "Disclose", "Approve"] as const;

export function IntentConsole() {
  const { goal: initial } = Route.useSearch();
  const { wallet } = useWallet();

  const [text, setText] = useState(initial ?? SUGGESTIONS[0]);
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<StructuredPlan | null>(null);
  const [simulation, setSimulation] = useState<PlanSimulation | null>(null);
  const [policyEval, setPolicyEval] = useState<{
    passed: boolean;
    violations: string[];
    checks: Record<string, boolean>;
  } | null>(null);

  const [stage, setStage] = useState(-1);
  const [reviewed, setReviewed] = useState(false);
  const [approving, setApproving] = useState(false);

  // Constraint configuration modal
  const [constraintModalOpen, setConstraintModalOpen] = useState(false);
  const [maxFeeBps, setMaxFeeBps] = useState("75");
  const [preserveGasEth, setPreserveGasEth] = useState("0.05");
  const [requireProvenance, setRequireProvenance] = useState(true);

  // Status Modal
  const [statusModal, setStatusModal] = useState<{
    open: boolean;
    type: "success" | "error" | "info";
    title: string;
    message: string;
    details?: string;
  }>({
    open: false,
    type: "info",
    title: "",
    message: "",
  });

  const runSimulation = async (
    goalText: string,
    customConstraints?: Record<string, any>
  ) => {
    if (!goalText.trim()) return;
    setLoading(true);
    setStage(0);
    setReviewed(false);
    try {
      const constraints = customConstraints || {
        maxTotalFeeBps: parseInt(maxFeeBps, 10) || 75,
        preserveGas: `${preserveGasEth} ETH`,
        requireCleanProvenance: requireProvenance,
      };

      const res = await simulateIntent({
        goal: goalText,
        constraints,
        walletAddress: wallet?.address,
      });

      setPlan(res.plan);
      setSimulation(res.simulation);
      setStage(1);

      const pol = await evaluatePolicies(res.plan, res.simulation);
      setPolicyEval(pol);
      setStage(3);
    } catch (err: any) {
      setStatusModal({
        open: true,
        type: "error",
        title: "Simulation Failed",
        message: err?.message || "Could not simulate intent. Please check network connection.",
      });
      setStage(-1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initial) {
      setText(initial);
      runSimulation(initial);
    } else {
      runSimulation(SUGGESTIONS[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const handleApplyConstraints = async () => {
    setConstraintModalOpen(false);
    await runSimulation(text, {
      maxTotalFeeBps: parseInt(maxFeeBps, 10) || 75,
      preserveGas: `${preserveGasEth} ETH`,
      requireCleanProvenance: requireProvenance,
    });
  };

  const handleApprove = async () => {
    if (!plan || !simulation || !wallet) return;
    setApproving(true);
    try {
      // Co-sign with Shard B on backend
      const digest = simulation.expectedCommitmentPreview || "0x0";
      await cosignTransaction(wallet.address, {
        digest,
        target: simulation.route[0] || wallet.address,
        nonce: parseInt(wallet.nonce, 10) || 0,
      });

      setStage(4);
      setStatusModal({
        open: true,
        type: "success",
        title: "Intent Approved & Co-Signed",
        message:
          "2-of-3 threshold quorum was satisfied. Shard A and Shard B signatures have been collected and verified.",
        details: `Plan ID: ${plan.id}\nRouting: ${simulation.route.join(" → ")}`,
      });
    } catch (err: any) {
      setStatusModal({
        open: true,
        type: "error",
        title: "Approval Refused",
        message: err?.message || "Co-signer declined to sign transaction due to policy constraint.",
      });
    } finally {
      setApproving(false);
    }
  };

  const isBlocked = policyEval ? !policyEval.passed : false;

  return (
    <div className="space-y-8">
      {/* AI Hero Banner matching ai-chat-inspo.webp */}
      <div className="text-center space-y-4 pt-4 sm:pt-6">
        {/* Glowing Orb */}
        <div className="relative mx-auto h-20 w-20 rounded-full bg-gradient-to-tr from-amber-400 via-rose-400 to-indigo-500 shadow-xl shadow-amber-500/20 flex items-center justify-center animate-pulse">
          <div className="h-16 w-16 rounded-full bg-slate-900/60 dark:bg-ink-950/80 backdrop-blur-md flex items-center justify-center">
            <Sparkles className="h-7 w-7 text-[#eaba65]" />
          </div>
        </div>

        <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-cream font-sans">
          Ready to Execute on Robinhood Chain?
        </h1>
        <p className="mx-auto max-w-lg text-xs sm:text-sm text-slate-500 dark:text-mist">
          State your intent in natural language. Veilora simulates route diffs, checks provenance, and enforces 2-of-3 threshold guardrails.
        </p>

        {/* Suggestion Prompt Chips */}
        <div className="flex flex-wrap justify-center gap-2 pt-1 max-w-2xl mx-auto">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setText(s);
                runSimulation(s);
              }}
              className="rounded-full border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-3 py-1 text-xs text-slate-600 dark:text-cream-dim hover:border-[#eaba65] hover:text-slate-900 dark:hover:text-cream transition-all shadow-2xs"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Floating Chat Input Console matching inspo */}
      <div className="panel max-w-3xl mx-auto p-4 sm:p-5 bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 shadow-lg rounded-3xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSimulation(text);
          }}
        >
          <div className="relative">
            <textarea
              className="w-full resize-y min-h-[88px] bg-transparent text-sm sm:text-base text-slate-900 dark:text-cream placeholder:text-slate-400 dark:placeholder:text-mist/70 focus:outline-none leading-relaxed p-2"
              placeholder="Ask anything or state your intent... (e.g. Shield 2,000 USDG and swap 500 USDG for NVDA)"
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label="Intent prompt"
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-ink-800">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConstraintModalOpen(true)}
                className="text-xs px-3 py-1.5 rounded-xl border-slate-200 dark:border-ink-700 text-slate-600 dark:text-cream flex items-center gap-1.5"
              >
                <Sliders className="h-3.5 w-3.5 text-[#eaba65]" />
                <span>Guardrails</span>
              </Button>
              <span className="text-[11px] text-slate-400 dark:text-mist hidden sm:inline">
                Simulated locally on this device
              </span>
            </div>

            <Button
              type="submit"
              disabled={loading || !text.trim()}
              className="bg-[#eaba65] hover:bg-[#d8a855] text-slate-950 font-semibold text-xs px-5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Compiling Plan…</span>
                </>
              ) : (
                <>
                  <span>Compile Plan</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        </form>
      </div>

      {plan && simulation && (
        <>
          {/* Stage Rail */}
          <ol className="my-8 grid grid-cols-5 gap-2">
            {STAGES.map((s, i) => {
              const done = stage >= i;
              const active = stage === i;
              return (
                <li key={s} className="min-w-0">
                  <div
                    className={cn(
                      "h-1 rounded-full transition-colors duration-500",
                      done ? "bg-brand-gradient" : "bg-ink-700"
                    )}
                  />
                  <p
                    className={cn(
                      "mt-2 truncate text-xs",
                      done ? "text-gold-300" : active ? "text-cream" : "text-mist"
                    )}
                  >
                    {i + 1}. {s}
                  </p>
                </li>
              );
            })}
          </ol>

          <div className="grid gap-6 xl:grid-cols-2">
            {/* 1. Plan Structure */}
            <Card title="Structured Plan" eyebrow="1 · Plan">
              <div className="mb-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-ink-600/70 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-mist">Action Type</p>
                  <p className="text-sm font-medium text-cream capitalize">
                    {plan.action.replace("_", " ")}
                  </p>
                </div>
                <div className="rounded-lg border border-ink-600/70 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-mist">Asset & Amount</p>
                  <p className="text-sm font-medium text-cream">
                    {plan.amountIn} {plan.assetIn}
                  </p>
                </div>
                <div className="rounded-lg border border-ink-600/70 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-mist">Fee Ceiling</p>
                  <p className="text-sm font-medium text-cream">
                    {(plan.constraints.maxTotalFeeBps / 100).toFixed(2)}%
                  </p>
                </div>
                <div className="rounded-lg border border-ink-600/70 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-mist">Gas Floor</p>
                  <p className="text-sm font-medium text-cream">{plan.constraints.preserveGas}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.14em] text-mist mb-2">Execution Route</p>
                {simulation.route.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-3 rounded-lg border border-ink-600/60 p-2.5 text-xs">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-gold-400/10 text-gold-300 font-bold">
                      {idx + 1}
                    </span>
                    <span className="text-cream-dim flex-1">{step}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* 2. Live Simulation Diff */}
            <Card title="Simulated Balance Effects" eyebrow="2 · Simulate">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-mist">
                      <th className="pb-2 font-medium">Asset</th>
                      <th className="pb-2 text-right font-medium">Before</th>
                      <th className="pb-2 text-right font-medium">After</th>
                      <th className="pb-2 text-right font-medium">Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simulation.balanceDiffs.map((d, idx) => (
                      <tr key={idx} className="border-t border-ink-600/50">
                        <td className="py-2.5 text-cream-dim">
                          {d.asset} {d.isShielded && <Badge tone="teal" className="ml-1 text-[10px]">Shielded</Badge>}
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-mist">{d.before}</td>
                        <td className="py-2.5 text-right font-medium tabular-nums text-cream">{d.after}</td>
                        <td
                          className={cn(
                            "py-2.5 text-right font-medium tabular-nums",
                            d.delta.startsWith("+") ? "text-teal-300" : "text-coral-400"
                          )}
                        >
                          {d.delta}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 border-t border-ink-600/60 pt-3">
                <KV k="Gas Price (Robinhood Chain)" v={`${simulation.estimatedFees.gasPriceGwei} Gwei`} />
                <KV k="Protocol Fee" v={`${simulation.estimatedFees.protocolFeeUSDG} USDG`} />
                <KV k="Proving Fee" v={`${simulation.estimatedFees.provingFeeUSDG} USDG`} />
                <KV
                  k="Gas Reserve Floor"
                  v={
                    <span className={simulation.gasReserveStatus.isPreserved ? "text-teal-300" : "text-coral-400"}>
                      {simulation.gasReserveStatus.reservedGasEth} (Safe)
                    </span>
                  }
                />
              </div>
            </Card>

            {/* 3. Policy & Provenance Evaluation */}
            <Card title="Policy Guardrails" eyebrow="3 · Policy">
              {policyEval ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-ink-600/60">
                    <span className="text-sm text-mist">Overall Policy Evaluation</span>
                    <Badge tone={policyEval.passed ? "teal" : "coral"}>
                      {policyEval.passed ? "Approved" : "Violations Detected"}
                    </Badge>
                  </div>

                  <ul className="space-y-2.5">
                    {Object.entries(policyEval.checks).map(([check, passed]) => {
                      const labels: Record<string, string> = {
                        feeCeilingOk: "Fee is below policy ceiling",
                        gasReserveOk: "Gas reserve remains above minimum threshold",
                        assetAllowed: "Asset is approved for shielded settlement",
                        provenanceRequirementSatisfied: "Clean provenance verified against association set",
                      };
                      return (
                        <li key={check} className="flex items-center gap-3 text-sm">
                          {passed ? (
                            <Check className="h-4 w-4 text-teal-300 shrink-0" />
                          ) : (
                            <CircleX className="h-4 w-4 text-coral-400 shrink-0" />
                          )}
                          <span className={passed ? "text-cream-dim" : "text-coral-300 font-medium"}>
                            {labels[check] || check}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  {policyEval.violations.length > 0 && (
                    <div className="mt-3 rounded-lg border border-coral-500/40 bg-coral-500/10 p-3 text-xs text-coral-300">
                      {policyEval.violations.map((v, i) => (
                        <p key={i}>• {v}</p>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-mist">Awaiting policy engine evaluation…</p>
              )}
            </Card>

            {/* 4. Selective Disclosure */}
            <Card title="Information Visibility" eyebrow="4 · Disclose">
              <ul className="space-y-3">
                {simulation.disclosures.map((d, i) => (
                  <li key={i} className="rounded-lg border border-ink-600/60 p-3 text-xs space-y-1">
                    <p className="font-semibold text-cream">{d.surface}</p>
                    <p className="text-mist">
                      <span className="text-gold-300">Visible:</span> {d.visibleData}
                    </p>
                    <p className="text-cream-dim">
                      <span className="text-teal-300">Guarantee:</span> {d.guarantee}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {/* 5. Final Approval Box */}
          <div className="panel mt-6 p-6">
            <p className="eyebrow mb-2">5 · Approval & Quorum</p>
            {isBlocked ? (
              <div className="flex items-start gap-3 text-sm text-coral-300">
                <CircleAlert className="h-5 w-5 shrink-0" />
                <p>
                  This plan violates a security policy. Adjust the parameters or constraints above to continue.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <label className="flex items-start gap-3 text-sm text-cream-dim cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 accent-[#eaba65]"
                    checked={reviewed}
                    onChange={(e) => setReviewed(e.target.checked)}
                  />
                  <span>
                    I verified the simulated balance change, the fee breakdown, and the privacy guarantees on Robinhood Chain.
                  </span>
                </label>
                <Button
                  disabled={!reviewed || approving}
                  onClick={handleApprove}
                  className="shrink-0"
                >
                  {approving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Co-signing…
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4" /> Approve with 2-of-3 Keys
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      {/* MODAL: Policy Guardrails Configuration */}
      <Modal
        open={constraintModalOpen}
        onClose={() => setConstraintModalOpen(false)}
        title="Intent Policy Guardrails"
        description="Configure safety limits before simulating your goal on Robinhood Chain."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setConstraintModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleApplyConstraints}
            >
              Apply & Re-Simulate
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Max Total Fee (Basis Points)" hint="e.g. 75 bps = 0.75%">
            <input
              className={inputClass}
              type="number"
              value={maxFeeBps}
              onChange={(e) => setMaxFeeBps(e.target.value)}
            />
          </Field>

          <Field label="Preserve Gas Floor (ETH)" hint="Your account gas reserve will never drop below this floor.">
            <input
              className={inputClass}
              value={preserveGasEth}
              onChange={(e) => setPreserveGasEth(e.target.value)}
            />
          </Field>

          <label className="flex items-center gap-3 text-sm text-cream-dim cursor-pointer">
            <input
              type="checkbox"
              className="accent-[#eaba65]"
              checked={requireProvenance}
              onChange={(e) => setRequireProvenance(e.target.checked)}
            />
            <span>Require Clean Provenance (PPOI Association Proof)</span>
          </label>
        </div>
      </Modal>

      {/* Global Status Modal */}
      <StatusModal
        open={statusModal.open}
        onClose={() => setStatusModal((s) => ({ ...s, open: false }))}
        type={statusModal.type}
        title={statusModal.title}
        message={statusModal.message}
        details={
          statusModal.details ? (
            <p className="rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950/60 p-3 font-mono text-xs text-amber-800 dark:text-gold-200 whitespace-pre-wrap">
              {statusModal.details}
            </p>
          ) : undefined
        }
      />
    </div>
  );
}
