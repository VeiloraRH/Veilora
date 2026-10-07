import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, CircleX, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { OUTBOX, OUTBOX_STATUS, PLANS, usd, type OutboxItem, type SigState } from "@/demo/data";
import { cosignTransaction } from "@/lib/api";
import { useWallet } from "@/lib/walletContext";
import {
  Badge,
  Button,
  Card,
  Dot,
  KV,
  Modal,
  PageHeader,
  StatusModal,
} from "@/components/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/outbox")({
  component: OutboxScreen,
});

const SHARD_LABEL = { A: "Device Key", B: "Veilora Co-Signer", C: "Passkey Recovery" } as const;

function SigPill({ id, s, busy }: { id: "A" | "B" | "C"; s: SigState; busy?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3.5 py-2.5",
        s === "signed" ? "border-teal-400/40 bg-teal-400/5" : "border-ink-600"
      )}
    >
      <span className="grid h-7 w-7 place-items-center rounded-full border border-gold-400/40 font-display text-gold-300">
        {id}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-cream">{SHARD_LABEL[id]}</p>
        <p className="text-xs text-mist">
          {s === "signed"
            ? "Signed & Verified"
            : s === "pending"
            ? busy
              ? "Signing…"
              : "Awaiting signature"
            : "Standby (2-of-3 threshold reached)"}
        </p>
      </div>
      {s === "signed" ? (
        <Check className="h-4 w-4 text-teal-300" />
      ) : busy ? (
        <Loader2 className="h-4 w-4 animate-spin text-gold-300" />
      ) : null}
    </div>
  );
}

export function OutboxScreen() {
  const { wallet } = useWallet();
  const [items, setItems] = useState<OutboxItem[]>(OUTBOX);
  const [selectedId, setSelectedId] = useState(OUTBOX[0]?.id || "");
  const [busy, setBusy] = useState(false);

  // Reject confirmation modal
  const [rejectItem, setRejectItem] = useState<OutboxItem | null>(null);

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

  const item = items.find((i) => i.id === selectedId) || items[0];
  const plan = PLANS.find((p) => p.id === item?.planId);

  const update = (id: string, patch: Partial<OutboxItem>) =>
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const handleApprove = async (o: OutboxItem) => {
    if (!wallet?.address) return;
    setBusy(true);
    try {
      // Co-sign with Shard B on backend
      const digest = `0x${o.id.replace(/-/g, "").padEnd(64, "0")}`;
      await cosignTransaction(wallet.address, {
        digest,
        target: wallet.address,
        nonce: parseInt(wallet.nonce, 10) || 0,
      });

      update(o.id, {
        status: "ready",
        signatures: { A: "signed", B: "signed", C: "standby" },
        expires: "Broadcasted to Robinhood Chain",
      });

      setStatusModal({
        open: true,
        type: "success",
        title: "2-of-3 Signatures Collected",
        message:
          `"${o.title}" has been authorized with Device Key (Shard A) and Veilora Co-signer (Shard B).`,
        details: `Item ID: ${o.id}\nNetwork: Robinhood Chain\nBroadcaster: ${o.broadcaster}`,
      });
    } catch (err: any) {
      setStatusModal({
        open: true,
        type: "error",
        title: "Co-signing Declined",
        message: err?.message || "Co-signer rejected signing request due to policy violation.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmReject = () => {
    if (!rejectItem) return;
    const removedId = rejectItem.id;
    const remaining = items.filter((x) => x.id !== removedId);
    setItems(remaining);
    setSelectedId(remaining[0]?.id || "");
    setRejectItem(null);

    setStatusModal({
      open: true,
      type: "info",
      title: "Action Discarded",
      message: `"${rejectItem.title}" has been removed from the signing queue. No funds were moved.`,
    });
  };

  return (
    <>
      <PageHeader
        eyebrow="Outbox"
        title="Nothing moves without your yes."
        description="Every planned transaction waits here. When you approve with your device key, the policy co-signer adds the second signature only if your safety rules pass."
      />

      {!item ? (
        <Card>
          <div className="py-8 text-center">
            <ShieldCheck className="mx-auto h-8 w-8 text-teal-300 mb-2" />
            <p className="text-sm text-cream">The outbox is clear.</p>
            <p className="text-xs text-mist mt-1">No pending transactions waiting for signature.</p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_1.25fr]">
          <ul className="space-y-3">
            {items.map((o) => (
              <li key={o.id}>
                <button
                  onClick={() => setSelectedId(o.id)}
                  className={cn(
                    "panel w-full p-4 text-left transition-colors",
                    o.id === item.id ? "!border-gold-400/70" : "hover:!border-ink-500"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Dot tone={OUTBOX_STATUS[o.status].tone} />
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

          <Card
            title={item.title}
            eyebrow={`${item.id} · ${OUTBOX_STATUS[item.status].label}`}
            className="xl:sticky xl:top-24 xl:self-start"
          >
            {item.status === "blocked" && (
              <div className="mb-5 flex gap-3 rounded-lg border border-coral-500/40 bg-coral-500/5 p-4 text-sm">
                <CircleX className="h-5 w-5 shrink-0 text-coral-400" />
                <div>
                  <p className="text-cream font-medium">Policy Violation Detected</p>
                  <p className="text-xs text-mist mt-0.5">
                    12,000 USDG exceeds the 10,000 USDG daily limit, and the address is not on your allowlist.
                    The co-signer declined to sign.
                  </p>
                </div>
              </div>
            )}

            <p className="mb-2 text-xs uppercase tracking-[0.14em] text-mist">
              Signatures · 2 of 3 Needed
            </p>
            <div className="grid gap-2">
              {(["A", "B", "C"] as const).map((k) => (
                <SigPill key={k} id={k} s={item.signatures[k]} busy={busy && k === "B"} />
              ))}
            </div>

            <div className="mt-5 space-y-2 text-sm border-t border-ink-600/60 pt-4">
              <KV k="Transaction Value" v={usd(item.amountUsd)} />
              <KV
                k="Policy Check"
                v={
                  <Badge tone={item.policy === "pass" ? "teal" : item.policy === "warn" ? "gold" : "coral"}>
                    {item.policy}
                  </Badge>
                }
              />
              <KV k="Broadcaster Relayer" v={item.broadcaster} />
              <KV k="Status" v={item.expires} />
              {plan && <KV k="Fee Ceiling" v={`${(plan.totalFeeBps / 100).toFixed(2)}%`} />}
            </div>

            <div className="mt-6 flex flex-col gap-3 border-t border-ink-600/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-mist">Robinhood Chain Settlement</span>
              <div className="flex gap-2">
                {item.status !== "ready" && (
                  <Button variant="danger" onClick={() => setRejectItem(item)}>
                    <Trash2 className="h-4 w-4" />
                    {item.status === "blocked" ? "Dismiss" : "Reject"}
                  </Button>
                )}
                {item.status === "awaiting-approval" && (
                  <Button onClick={() => handleApprove(item)} disabled={busy}>
                    {busy ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Co-signing…
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4" /> Approve
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Reject Confirmation Modal */}
      <Modal
        open={!!rejectItem}
        onClose={() => setRejectItem(null)}
        title="Reject Action"
        description="Remove this transaction from the outbox."
        actions={
          <>
            <Button variant="outline" onClick={() => setRejectItem(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmReject}>
              Confirm Reject
            </Button>
          </>
        }
      >
        {rejectItem && (
          <p className="text-sm text-cream-dim leading-relaxed">
            Are you sure you want to dismiss{" "}
            <strong className="text-cream">{rejectItem.title}</strong>? This planned transaction
            will be cancelled without moving any funds.
          </p>
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
