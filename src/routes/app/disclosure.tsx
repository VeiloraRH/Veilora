import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Plus,
  ShieldCheck,
  Search,
  Lock,
} from "lucide-react";
import {
  createViewKey,
  inspectViewKey,
  getProvenanceSets,
  generateProvenanceProof,
} from "@/lib/api";
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
  Tabs,
  inputClass,
} from "@/components/ui";

export const Route = createFileRoute("/app/disclosure")({
  component: DisclosureScreen,
});

interface LocalViewKey {
  id: string;
  holder: string;
  scope: string;
  token: string;
  validUntil: string;
  status: "active" | "revoked";
}

const INITIAL_KEYS: LocalViewKey[] = [
  {
    id: "2fa80c91",
    holder: "Harbor & Pike LLP",
    scope: "Audit: Shielded USDG activity, Q4 2026",
    token: "vk_a709843df3c2a0bb48e9a2c7c0cab8bbcefbb5c8286a424d",
    validUntil: "Jan 5, 2027",
    status: "active",
  },
];

export function DisclosureScreen() {
  const [tab, setTab] = useState<"keys" | "proofs">("keys");
  const { wallet } = useWallet();

  // Keys state
  const [keys, setKeys] = useState<LocalViewKey[]>(() => {
    try {
      const saved = localStorage.getItem("veilora:view_keys");
      return saved ? JSON.parse(saved) : INITIAL_KEYS;
    } catch {
      return INITIAL_KEYS;
    }
  });

  const saveKeys = (updated: LocalViewKey[]) => {
    setKeys(updated);
    try {
      localStorage.setItem("veilora:view_keys", JSON.stringify(updated));
    } catch {
      // Storage fallback
    }
  };

  // Modals for user input
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [holderInput, setHolderInput] = useState("");
  const [scopeInput, setScopeInput] = useState("Audit: Shielded activity overview");
  const [validDaysInput, setValidDaysInput] = useState("90");
  const [submittingKey, setSubmittingKey] = useState(false);

  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [inspectTokenInput, setInspectTokenInput] = useState("");
  const [inspecting, setInspecting] = useState(false);

  // Provenance Sets state
  const [sets, setSets] = useState<Array<{
    set_id: string;
    name: string;
    root_hash: string;
    member_count: string;
    freshness_timestamp: string;
    is_active: boolean;
  }>>([]);

  // Provenance Proof input modal
  const [proveModalOpen, setProveModalOpen] = useState(false);
  const [proveCommitmentInput, setProveCommitmentInput] = useState("");
  const [submittingProof, setSubmittingProof] = useState(false);

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

  useEffect(() => {
    getProvenanceSets()
      .then((res) => setSets(res.sets))
      .catch(() => undefined);
  }, []);

  const handleIssueKey = async () => {
    if (!wallet?.address || !holderInput.trim()) return;
    setSubmittingKey(true);
    try {
      const res = await createViewKey({
        walletAddress: wallet.address,
        label: holderInput.trim(),
        scope: scopeInput.trim(),
        validDays: parseInt(validDaysInput, 10) || 90,
      });

      const newKey: LocalViewKey = {
        id: res.key_id.slice(0, 8),
        holder: res.label,
        scope: res.scope,
        token: res.viewKeyToken,
        validUntil: new Date(res.valid_until).toLocaleDateString(),
        status: "active",
      };

      saveKeys([newKey, ...keys]);
      setIssueModalOpen(false);
      setHolderInput("");

      setStatusModal({
        open: true,
        type: "success",
        title: "View Key Issued",
        message:
          "Scoped audit view key generated successfully. Provide the bearer token below to the authorized auditor.",
        details: `Token: ${res.viewKeyToken}\nScope: ${res.scope}\nValid Until: ${res.valid_until}`,
      });
    } catch (err: any) {
      setStatusModal({
        open: true,
        type: "error",
        title: "Key Issuance Failed",
        message: err?.message || "Failed to generate view key. Please try again.",
      });
    } finally {
      setSubmittingKey(false);
    }
  };

  const handleInspectKey = async () => {
    if (!inspectTokenInput.trim()) return;
    setInspecting(true);
    try {
      const res = await inspectViewKey(inspectTokenInput.trim());
      setInspectModalOpen(false);
      setInspectTokenInput("");

      setStatusModal({
        open: true,
        type: "success",
        title: "View Key Validated",
        message: `Key is active for holder: ${res.viewKey.label}.`,
        details: `Key ID: ${res.viewKey.key_id}\nScope: ${res.viewKey.scope}\nTotal Access Reads: ${res.viewKey.access_count}\nValid Until: ${res.viewKey.valid_until}`,
      });
    } catch (err: any) {
      setStatusModal({
        open: true,
        type: "error",
        title: "Key Lookup Failed",
        message: err?.message || "Invalid or expired view key token.",
      });
    } finally {
      setInspecting(false);
    }
  };

  const handleGenerateProof = async () => {
    if (!proveCommitmentInput.trim()) return;
    setSubmittingProof(true);
    try {
      const proof = await generateProvenanceProof(proveCommitmentInput.trim(), "USDG");
      setProveModalOpen(false);
      setProveCommitmentInput("");

      setStatusModal({
        open: true,
        type: "success",
        title: "Provenance Proof Generated",
        message:
          "Cryptographic PPOI proof verified against Robinhood Chain clean set.",
        details: `Proof ID: ${proof.proofId}\nSet ID: ${proof.setId}\nRoot Hash: ${proof.rootHash}\nReveals: ${proof.disclosures.reveals}\nGuarantee: ${proof.disclosures.guarantee}`,
      });
    } catch (err: any) {
      setStatusModal({
        open: true,
        type: "error",
        title: "Proof Generation Failed",
        message: err?.message || "Commitment verification failed against association set.",
      });
    } finally {
      setSubmittingProof(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Selective Disclosure"
        title="Prove what's needed. Nothing more."
        description="Share scoped, revocable audit views with tax advisors or compliance partners, and verify clean provenance without exposing your full history."
        actions={
          <div className="flex flex-wrap gap-2">
            <Tabs
              value={tab}
              onChange={setTab}
              items={[
                { id: "keys", label: "View Keys" },
                { id: "proofs", label: "Clean Provenance Proofs" },
              ]}
            />
            {tab === "keys" ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setInspectModalOpen(true)}
                >
                  <Search className="h-4 w-4" /> Inspect Key
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setIssueModalOpen(true)}
                >
                  <Plus className="h-4 w-4" /> Issue Key
                </Button>
              </div>
            ) : (
              <Button
                variant="primary"
                onClick={() => setProveModalOpen(true)}
              >
                <ShieldCheck className="h-4 w-4" /> Generate Proof
              </Button>
            )}
          </div>
        }
      />

      {tab === "keys" ? (
        <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <Card
            title="Active View Keys"
            eyebrow={`${keys.filter((k) => k.status === "active").length} active keys`}
            bodyClassName="p-0"
          >
            {keys.length === 0 ? (
              <div className="p-6 text-center text-sm text-mist">
                No view keys issued. Click "Issue Key" to grant a scoped audit view.
              </div>
            ) : (
              <ul>
                {keys.map((k) => (
                  <li
                    key={k.id}
                    className="flex flex-col gap-3 border-t border-ink-600/50 px-5 py-4 first:border-0 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-cream">{k.holder}</p>
                        <Badge tone={k.status === "active" ? "teal" : "coral"}>{k.status}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-mist">{k.scope}</p>
                      <p className="mt-0.5 font-mono text-xs text-mist/80 truncate">
                        Token: {k.token.slice(0, 16)}…
                      </p>
                      <p className="mt-0.5 text-xs text-mist">Valid until {k.validUntil}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="space-y-6">
            <Card title="How View Keys Work" eyebrow="Zero-Knowledge Audit">
              <p className="text-sm leading-relaxed text-mist">
                View keys grant read access only to the selected time window and asset scope.
                The auditor can verify balances and transaction integrity without obtaining
                spending authority or revealing historical counterparties.
              </p>
              <div className="mt-4 rounded-lg border border-teal-400/30 bg-teal-400/5 p-3 text-xs text-teal-200">
                <Lock className="h-4 w-4 inline mr-1 text-teal-300" />
                Keys can never be used to sign or transfer funds.
              </div>
            </Card>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="panel p-5 text-sm leading-relaxed text-mist">
            Clean-provenance proofs show that your shielded funds belong to a verified, untainted
            Robinhood Chain association set without exposing which specific note is yours.
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {sets.map((s) => (
              <Card
                key={s.set_id}
                title={s.name}
                eyebrow={`Association Set · ${s.set_id}`}
                action={<Badge tone={s.is_active ? "teal" : "mist"}>{s.is_active ? "Active" : "Inactive"}</Badge>}
              >
                <div className="space-y-2 text-sm">
                  <KV k="Network" v="Robinhood Chain" />
                  <KV k="Merkle Root Hash" v={<span className="font-mono text-xs">{s.root_hash.slice(0, 18)}…</span>} />
                  <KV k="Verified Members" v={Number(s.member_count).toLocaleString("en-US")} />
                  <KV k="Freshness Oracle" v={new Date(s.freshness_timestamp).toLocaleString()} />
                  <KV k="Coverage" v="USDG Shielded Deposits" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: Issue View Key */}
      <Modal
        open={issueModalOpen}
        onClose={() => setIssueModalOpen(false)}
        title="Issue Scoped View Key"
        description="Create an auditor view key for selective compliance reporting."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setIssueModalOpen(false)}
              disabled={submittingKey}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!holderInput.trim() || submittingKey}
              onClick={handleIssueKey}
            >
              {submittingKey ? "Issuing…" : "Issue View Key"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Holder / Auditor Name" hint="e.g. Harbor & Pike LLP or Internal Tax Team">
            <input
              className={inputClass}
              placeholder="e.g. Harbor & Pike LLP"
              value={holderInput}
              onChange={(e) => setHolderInput(e.target.value)}
            />
          </Field>

          <Field label="Scope Description">
            <input
              className={inputClass}
              value={scopeInput}
              onChange={(e) => setScopeInput(e.target.value)}
            />
          </Field>

          <Field label="Validity Duration (Days)">
            <select
              className={inputClass}
              value={validDaysInput}
              onChange={(e) => setValidDaysInput(e.target.value)}
            >
              <option value="30">30 Days</option>
              <option value="90">90 Days (Quarterly Audit)</option>
              <option value="180">180 Days</option>
              <option value="365">365 Days (Annual)</option>
            </select>
          </Field>
        </div>
      </Modal>

      {/* MODAL 2: Inspect Key */}
      <Modal
        open={inspectModalOpen}
        onClose={() => setInspectModalOpen(false)}
        title="Inspect View Key Token"
        description="Verify an existing view key bearer token against the registry."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setInspectModalOpen(false)}
              disabled={inspecting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!inspectTokenInput.trim() || inspecting}
              onClick={handleInspectKey}
            >
              {inspecting ? "Checking…" : "Inspect Token"}
            </Button>
          </>
        }
      >
        <Field label="Bearer Token (vk_…)">
          <input
            className={inputClass}
            placeholder="vk_…"
            value={inspectTokenInput}
            onChange={(e) => setInspectTokenInput(e.target.value)}
          />
        </Field>
      </Modal>

      {/* MODAL 3: Generate Provenance Proof */}
      <Modal
        open={proveModalOpen}
        onClose={() => setProveModalOpen(false)}
        title="Generate Provenance Proof"
        description="Compute an association-set membership proof for a note commitment."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setProveModalOpen(false)}
              disabled={submittingProof}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!proveCommitmentInput.trim() || submittingProof}
              onClick={handleGenerateProof}
            >
              {submittingProof ? "Proving…" : "Generate PPOI Proof"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Deposit Commitment (0x…)">
            <input
              className={inputClass}
              placeholder="0x…"
              value={proveCommitmentInput}
              onChange={(e) => setProveCommitmentInput(e.target.value.trim())}
            />
          </Field>
          <div className="rounded-lg border border-teal-400/30 bg-teal-400/5 p-3 text-xs text-cream-dim">
            Proof will be generated against the active Robinhood Chain clean set (<span className="text-teal-300">rhc-clean-v1</span>).
          </div>
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
            <p className="rounded-lg border border-ink-600 bg-ink-950/60 p-3 font-mono text-xs text-gold-200 whitespace-pre-wrap">
              {statusModal.details}
            </p>
          ) : undefined
        }
      />
    </>
  );
}
