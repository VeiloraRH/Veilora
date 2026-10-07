import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Clock, Fuel, ListChecks, Percent, ShieldCheck, Wallet } from "lucide-react";
import { POLICIES, type Policy } from "@/demo/data";
import {
  Badge,
  Button,
  Card,
  Modal,
  PageHeader,
  Stat,
  StatusModal,
} from "@/components/ui";
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
  { when: "Recent", what: "Send 12,000 USDG to an unverified address", why: "Over daily limit and not on allowlist" },
  { when: "Recent", what: "Bridge via non-standard provider at 0.62%", why: "Exceeded 0.50% fee ceiling" },
  { when: "Recent", what: "Swap leaving less than 0.05 ETH reserve", why: "Violates minimum gas floor protection" },
];

function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", on ? "bg-gold-400" : "bg-ink-600")}
    >
      <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-cream transition-all", on ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

export function PoliciesScreen() {
  const [policies, setPolicies] = useState(POLICIES);
  const [pendingPolicy, setPendingPolicy] = useState<{ policy: Policy; newStatus: boolean } | null>(null);

  // Status modal
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

  const enabled = policies.filter((p) => p.enabled).length;

  const handleConfirmToggle = () => {
    if (!pendingPolicy) return;
    const { policy, newStatus } = pendingPolicy;

    setPolicies((xs) =>
      xs.map((x) => (x.id === policy.id ? { ...x, enabled: newStatus } : x))
    );
    setPendingPolicy(null);

    setStatusModal({
      open: true,
      type: "success",
      title: "Policy Modification Queued",
      message: `The proposal to ${newStatus ? "enable" : "disable"} "${policy.name}" has been prepared. Like all security changes, it requires 2-of-3 quorum signatures before taking effect on Robinhood Chain.`,
      details: `Rule: ${policy.rule}\nTarget State: ${newStatus ? "Enabled" : "Disabled"}`,
    });
  };

  return (
    <>
      <PageHeader
        eyebrow="Policies & Guardrails"
        title="Rules the Co-Signer Enforces"
        description="Shard B evaluates these strict safety invariants before co-signing any transaction on Robinhood Chain. Changing a policy requires 2-of-3 threshold quorum approval."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active Rules" value={`${enabled} / ${policies.length}`} />
        <Stat label="Policy Version" value="v14" sub="Signed & Active" />
        <Stat label="Blocked Attempts" value="3" sub="Protected" tone="gold" />
        <Stat label="Unauthorized Bypasses" value="0" sub="Zero allowed" tone="teal" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card title="Active Policies" eyebrow="Policy Set v14" bodyClassName="p-0">
          <ul>
            {policies.map((p) => {
              const Icon = ICON[p.kind];
              return (
                <li key={p.id} className="flex items-start gap-4 border-t border-ink-600/50 px-5 py-4 first:border-0">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-gold-400/30 bg-gold-400/5 text-gold-300">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm font-medium", p.enabled ? "text-cream" : "text-mist")}>
                      {p.name}
                    </p>
                    <p className="text-sm text-mist">{p.rule}</p>
                    <p className="mt-1 text-xs text-mist/80">Applies to: {p.scope}</p>
                  </div>
                  <Toggle
                    label={p.name}
                    on={p.enabled}
                    onChange={() => setPendingPolicy({ policy: p, newStatus: !p.enabled })}
                  />
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="space-y-6">
          <Card title="Blocked by Guardrails" eyebrow="Recent Protection Events" bodyClassName="p-0">
            <ul>
              {BLOCKED.map((b, idx) => (
                <li key={idx} className="border-t border-ink-600/50 px-5 py-3.5 first:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-cream">{b.what}</p>
                    <Badge tone="coral">Blocked</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-mist">
                    {b.when} · {b.why}
                  </p>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Enforcement Architecture" eyebrow="Trust Boundary">
            <p className="text-sm leading-relaxed text-mist">
              Policies are checked twice: first locally on your device during simulation, and
              second by the Veilora Co-signer before it adds the second threshold signature.
              No transaction can execute if it violates any enabled guardrail.
            </p>
          </Card>
        </div>
      </div>

      {/* Confirmation Modal for Policy Change */}
      <Modal
        open={!!pendingPolicy}
        onClose={() => setPendingPolicy(null)}
        title="Modify Security Policy"
        description="Confirm policy rule status change."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setPendingPolicy(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmToggle}
            >
              Confirm Change
            </Button>
          </>
        }
      >
        {pendingPolicy && (
          <div className="space-y-3 text-sm text-cream-dim">
            <p>
              Are you sure you want to{" "}
              <strong className={pendingPolicy.newStatus ? "text-teal-300" : "text-coral-400"}>
                {pendingPolicy.newStatus ? "enable" : "disable"}
              </strong>{" "}
              the following rule?
            </p>
            <div className="rounded-lg border border-ink-600 bg-ink-950/60 p-3">
              <p className="font-semibold text-cream">{pendingPolicy.policy.name}</p>
              <p className="text-xs text-mist mt-1">{pendingPolicy.policy.rule}</p>
            </div>
            <p className="text-xs text-mist">
              This modification will be staged for 2-of-3 threshold signature verification.
            </p>
          </div>
        )}
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
            <p className="rounded-lg border border-ink-600 bg-ink-950/60 p-3 font-mono text-xs text-gold-200 whitespace-pre-wrap">
              {statusModal.details}
            </p>
          ) : undefined
        }
      />
    </>
  );
}
