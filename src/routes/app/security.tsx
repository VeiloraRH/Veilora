import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Check,
  Fingerprint,
  Laptop,
  Server,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Unlock,
  PlusCircle,
  Copy,
} from "lucide-react";
import { useWallet } from "@/lib/walletContext";
import {
  Badge,
  Button,
  Card,
  Field,
  KV,
  Modal,
  PageHeader,
  StatusModal,
  inputClass,
} from "@/components/ui";

export const Route = createFileRoute("/app/security")({
  component: SecurityScreen,
});

export function SecurityScreen() {
  const {
    wallet,
    loading,
    freezeAccount,
    unfreezeAccount,
    createAccount,
    auditTrail,
  } = useWallet();

  // Modals for user input
  const [freezeModalOpen, setFreezeModalOpen] = useState(false);
  const [freezeHours, setFreezeHours] = useState("24");
  const [freezeReason, setFreezeReason] = useState("Suspicious activity detected");
  const [freezeSubmitting, setFreezeSubmitting] = useState(false);

  const [unfreezeModalOpen, setUnfreezeModalOpen] = useState(false);
  const [unfreezeSubmitting, setUnfreezeSubmitting] = useState(false);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Status Modals for success / error notifications
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

  const [copiedShard, setCopiedShard] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard?.writeText(text).catch(() => undefined);
    setCopiedShard(label);
    setTimeout(() => setCopiedShard(null), 1500);
  };

  const handleFreezeSubmit = async () => {
    setFreezeSubmitting(true);
    try {
      const hours = parseInt(freezeHours, 10) || 24;
      await freezeAccount(hours, freezeReason.trim() || "Emergency freeze");
      setFreezeModalOpen(false);
      setStatusModal({
        open: true,
        type: "success",
        title: "Account Frozen",
        message:
          "Your smart account is now frozen. No transactions can be co-signed until the freeze duration expires or you unlock it with your recovery keys.",
        details: `Duration: ${hours} hours · Reason: ${freezeReason}`,
      });
    } catch (err: any) {
      setStatusModal({
        open: true,
        type: "error",
        title: "Freeze Failed",
        message: err?.message || "Could not freeze the account. Please try again.",
      });
    } finally {
      setFreezeSubmitting(false);
    }
  };

  const handleUnfreezeSubmit = async () => {
    setUnfreezeSubmitting(true);
    try {
      await unfreezeAccount();
      setUnfreezeModalOpen(false);
      setStatusModal({
        open: true,
        type: "success",
        title: "Account Unfrozen",
        message: "Your smart account is now active again. 2-of-3 quorum transactions are permitted.",
      });
    } catch (err: any) {
      setStatusModal({
        open: true,
        type: "error",
        title: "Unlock Failed",
        message: err?.message || "Could not unlock the account. Please check your credentials.",
      });
    } finally {
      setUnfreezeSubmitting(false);
    }
  };

  const handleCreateAccountSubmit = async () => {
    setCreateSubmitting(true);
    try {
      const newAcc = await createAccount();
      setCreateModalOpen(false);
      setStatusModal({
        open: true,
        type: "success",
        title: "New Smart Account Created",
        message:
          "Your new 2-of-3 threshold account was generated on Robinhood Chain using CREATE2 deterministic factory.",
        details: `Address: ${newAcc.address}`,
      });
    } catch (err: any) {
      setStatusModal({
        open: true,
        type: "error",
        title: "Creation Failed",
        message: err?.message || "Failed to create account. Please try again.",
      });
    } finally {
      setCreateSubmitting(false);
    }
  };

  const shards = [
    {
      id: "A",
      name: "Device Shard",
      holder: "Stored securely on this local browser / device",
      address: wallet?.shardA || "0xe961…A7b3",
      icon: Laptop,
      status: "Active",
      tone: "teal" as const,
    },
    {
      id: "B",
      name: "Veilora Co-Signer",
      holder: "Automated policy co-signer on Robinhood Chain",
      address: wallet?.shardB || "0xF1d2…895d",
      icon: Server,
      status: "Active",
      tone: "teal" as const,
    },
    {
      id: "C",
      name: "Recovery Shard",
      holder: "Offline recovery key or passkey shard",
      address: wallet?.shardC || "0xC2Ae…a6e1",
      icon: Fingerprint,
      status: "Standby",
      tone: "gold" as const,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Custody & Recovery"
        title="No single key can move funds."
        description="Your smart account is secured by 2-of-3 threshold custody on Robinhood Chain. Any two shards can authorize an action; one shard alone can do nothing."
        actions={
          <div className="flex flex-wrap gap-2">
            {wallet?.isFrozen ? (
              <Button
                variant="primary"
                onClick={() => setUnfreezeModalOpen(true)}
              >
                <Unlock className="h-4 w-4" /> Lift Freeze
              </Button>
            ) : (
              <Button
                variant="danger"
                onClick={() => setFreezeModalOpen(true)}
              >
                <Lock className="h-4 w-4" /> Emergency Freeze
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setCreateModalOpen(true)}
            >
              <PlusCircle className="h-4 w-4" /> New Account
            </Button>
          </div>
        }
      />

      {/* Account Status Overview */}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="panel p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-mist">Account Status</span>
            <Badge tone={wallet?.isFrozen ? "coral" : "teal"}>
              {wallet?.isFrozen ? "Frozen" : "Active"}
            </Badge>
          </div>
          <p className="mt-3 font-display text-xl text-cream truncate">
            {wallet?.address || (loading ? "Loading…" : "No account connected")}
          </p>
          <p className="mt-1 text-xs text-mist">
            {wallet?.isFrozen
              ? `Frozen until ${new Date(wallet.frozenUntil || "").toLocaleString()}`
              : "2-of-3 quorum verified"}
          </p>
        </div>

        <div className="panel p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-mist">Quorum Rule</span>
            <Badge tone="teal">2 of 3</Badge>
          </div>
          <p className="mt-3 font-display text-xl text-cream">Threshold Signing</p>
          <p className="mt-1 text-xs text-mist">Requires two valid signatures for any transaction</p>
        </div>

        <div className="panel p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-mist">Deployment Mode</span>
            <Badge tone="teal">{wallet?.isDeployed ? "On-Chain" : "Deterministic CREATE2"}</Badge>
          </div>
          <p className="mt-3 font-display text-xl text-cream">Counterfactual Vault</p>
          <p className="mt-1 text-xs text-mist">Deployable on Robinhood Chain upon first execution</p>
        </div>
      </div>

      {/* Three Shards */}
      <div className="grid gap-4 md:grid-cols-3">
        {shards.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.id} className="panel p-5">
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-gold-400/40 bg-gold-400/5 text-gold-300">
                  <Icon className="h-5 w-5" />
                </span>
                <Badge tone={s.tone}>{s.status}</Badge>
              </div>
              <p className="mt-4 font-display text-xl text-cream">
                Shard {s.id} · {s.name}
              </p>
              <p className="mt-1 text-xs text-mist">{s.holder}</p>
              <div className="mt-4 flex items-center justify-between rounded-lg border border-ink-600/60 bg-ink-950/40 px-3 py-2">
                <span className="font-mono text-xs text-cream truncate mr-2">
                  {s.address}
                </span>
                <button
                  onClick={() => copyToClipboard(s.address, s.id)}
                  className="text-mist hover:text-cream transition-colors shrink-0"
                  aria-label={`Copy Shard ${s.id}`}
                >
                  {copiedShard === s.id ? (
                    <Check className="h-4 w-4 text-teal-300" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Co-Signer Trust Boundary" eyebrow="What Shard B evaluates">
          <div className="space-y-3">
            {[
              { rule: "Evaluates intent policy limits before adding signature", ok: true },
              { rule: "Cannot move funds unilaterally without your device signature", ok: true },
              { rule: "Never sees unblinded shielded note secrets or recipients", ok: true },
              { rule: "Refuses signing immediately if an emergency freeze is triggered", ok: true },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 text-sm">
                <ShieldCheck className="h-4 w-4 text-teal-300 shrink-0" />
                <span className="text-cream-dim">{item.rule}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-ink-600/60 pt-4">
            <KV k="Network" v="Robinhood Chain" />
            <KV k="Co-Signer Policy Engine" v="Veilora HSM Co-Signer" />
            <KV k="Threshold Required" v="2 of 3" />
            <KV k="Emergency Action" v="Panic Freeze available at any time" />
          </div>
        </Card>

        <Card title="Security & Co-Signing Audit Trail" eyebrow="Audit records">
          {auditTrail.length === 0 ? (
            <div className="text-center py-6">
              <ShieldAlert className="mx-auto h-8 w-8 text-mist/50 mb-2" />
              <p className="text-sm text-mist">No signature requests logged yet for this account.</p>
              <p className="text-xs text-mist/80 mt-1">Actions co-signed by Shard B will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {auditTrail.slice(0, 5).map((rec) => (
                <div
                  key={rec.id}
                  className="flex items-center justify-between rounded-lg border border-ink-600/60 p-3 text-xs"
                >
                  <div>
                    <p className="font-mono text-cream truncate max-w-[220px]">
                      {rec.user_op_hash}
                    </p>
                    <p className="text-mist mt-0.5">
                      {new Date(rec.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Badge tone={rec.status === "APPROVED" ? "teal" : "gold"}>
                    {rec.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* MODAL 1: Emergency Freeze Input */}
      <Modal
        open={freezeModalOpen}
        onClose={() => setFreezeModalOpen(false)}
        title="Emergency Freeze Account"
        description="Immediately halt co-signing permissions for your smart account on Robinhood Chain."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setFreezeModalOpen(false)}
              disabled={freezeSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleFreezeSubmit}
              disabled={freezeSubmitting}
            >
              {freezeSubmitting ? "Freezing…" : "Confirm Emergency Freeze"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Freeze Duration (Hours)" hint="The co-signer will reject all requests for this duration.">
            <select
              className={inputClass}
              value={freezeHours}
              onChange={(e) => setFreezeHours(e.target.value)}
            >
              <option value="6">6 Hours</option>
              <option value="12">12 Hours</option>
              <option value="24">24 Hours (Standard)</option>
              <option value="48">48 Hours</option>
              <option value="72">72 Hours (Extended)</option>
            </select>
          </Field>

          <Field label="Reason for Freeze" hint="Recorded securely in your account audit log.">
            <input
              className={inputClass}
              value={freezeReason}
              onChange={(e) => setFreezeReason(e.target.value)}
              placeholder="e.g. Lost device, suspicious transaction attempt"
            />
          </Field>

          <div className="rounded-lg border border-coral-500/30 bg-coral-500/10 p-3 text-xs text-cream-dim">
            <p className="font-medium text-coral-400 mb-1">Immediate Safety Lock</p>
            Once confirmed, Shard B will decline all co-signing operations. You can unlock early at any time using your recovery shard.
          </div>
        </div>
      </Modal>

      {/* MODAL 2: Lift Freeze Confirmation */}
      <Modal
        open={unfreezeModalOpen}
        onClose={() => setUnfreezeModalOpen(false)}
        title="Lift Account Freeze"
        description="Re-enable normal 2-of-3 threshold transactions for this account."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setUnfreezeModalOpen(false)}
              disabled={unfreezeSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleUnfreezeSubmit}
              disabled={unfreezeSubmitting}
            >
              {unfreezeSubmitting ? "Unlocking…" : "Confirm Lift Freeze"}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-cream-dim">
          Are you sure you want to lift the emergency freeze on{" "}
          <span className="font-mono text-gold-300">{wallet?.address}</span>?
          This will restore normal co-signing permissions.
        </p>
      </Modal>

      {/* MODAL 3: Generate Account Input */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create 2-of-3 Smart Account"
        description="Deploy a new deterministic smart account on Robinhood Chain."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setCreateModalOpen(false)}
              disabled={createSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateAccountSubmit}
              disabled={createSubmitting}
            >
              {createSubmitting ? "Generating…" : "Generate Account"}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-cream-dim leading-relaxed">
          <p>
            This action creates a fresh smart account with:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-xs text-mist">
            <li>Shard A: Generated for this device</li>
            <li>Shard B: Configured with Veilora Co-signer</li>
            <li>Shard C: Generated for emergency recovery</li>
          </ul>
          <p className="text-xs text-mist">
            Address computation is deterministic via VeiloraFactory on Robinhood Chain.
          </p>
        </div>
      </Modal>

      {/* MODAL 4: Global Status Modal for Success / Error */}
      <StatusModal
        open={statusModal.open}
        onClose={() => setStatusModal((s) => ({ ...s, open: false }))}
        type={statusModal.type}
        title={statusModal.title}
        message={statusModal.message}
        details={
          statusModal.details ? (
            <p className="rounded-lg border border-ink-600 bg-ink-950/60 p-3 font-mono text-xs text-gold-200">
              {statusModal.details}
            </p>
          ) : undefined
        }
      />
    </>
  );
}
