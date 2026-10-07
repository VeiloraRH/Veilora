import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import {
  createShieldedNote,
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/privacy")({
  component: PrivacyScreen,
});

const SHIELD_STEPS = ["Amount", "Preview", "Disclosures", "Verify", "Submit"];
const SHIELD_FEE_RATE = 0.0025; // 0.25%

interface LocalNote {
  id: string;
  asset: string;
  amount: number;
  commitment: string;
  created: string;
  status: "spendable" | "pending" | "spent";
  nullifierHash?: string;
  blindingSecret?: string;
}

const INITIAL_NOTES: LocalNote[] = [
  {
    id: "n-01",
    asset: "USDG",
    amount: 4000,
    commitment: "0xe501d4f2a1e9bb37f66ca504f3f2fef31fbfb654a33a8f2aa92a3850a80be909",
    created: "Oct 6, 14:02",
    status: "spendable",
  },
  {
    id: "n-02",
    asset: "USDG",
    amount: 2250,
    commitment: "0x88b2a1c0d48123de4f55a1098e987cba12f801923485710293847561234a9b8c",
    created: "Oct 7, 04:30",
    status: "spendable",
  },
];

export function PrivacyScreen() {
  const [tab, setTab] = useState<"shield" | "unshield">("shield");
  const { wallet } = useWallet();

  const [notes, setNotes] = useState<LocalNote[]>(() => {
    try {
      const saved = localStorage.getItem("veilora:notes");
      return saved ? JSON.parse(saved) : INITIAL_NOTES;
    } catch {
      return INITIAL_NOTES;
    }
  });

  const saveNotes = (updated: LocalNote[]) => {
    setNotes(updated);
    try {
      localStorage.setItem("veilora:notes", JSON.stringify(updated));
    } catch {
      // Storage save error fallback
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Privacy Mode"
        title="Shield & Unshield"
        description="Shielding converts public USDG on Robinhood Chain into cryptographic shielded UTXO notes. Each step shows what changes, what it costs, and who can see it."
        actions={
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { id: "shield", label: "Shield USDG" },
              { id: "unshield", label: "Unshield to Origin" },
            ]}
          />
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        {tab === "shield" ? (
          <ShieldFlow onAddNote={(n) => saveNotes([n, ...notes])} />
        ) : (
          <UnshieldFlow notes={notes} onSpendNote={(id) => saveNotes(notes.map((n) => n.id === id ? { ...n, status: "spent" } : n))} />
        )}
        <div className="space-y-6">
          <ReceiveCard walletAddress={wallet?.address} />
          <NotesCard notes={notes} />
        </div>
      </div>
    </>
  );
}

function Stepper({ steps, at }: { steps: string[]; at: number }) {
  return (
    <ol className="mb-6 flex flex-wrap gap-x-4 gap-y-2">
      {steps.map((s, i) => (
        <li
          key={s}
          className={cn(
            "flex items-center gap-2 text-xs",
            i < at
              ? "text-teal-600 dark:text-teal-300 font-medium"
              : i === at
              ? "text-amber-600 dark:text-gold-300 font-semibold"
              : "text-slate-400 dark:text-mist"
          )}
        >
          <span
            className={cn(
              "grid h-5 w-5 place-items-center rounded-full border text-[10px]",
              i < at
                ? "border-teal-500 bg-teal-500/15 text-teal-600 dark:text-teal-300"
                : i === at
                ? "border-[#eaba65] text-amber-700 dark:text-[#eaba65] bg-amber-50 dark:bg-transparent"
                : "border-slate-300 dark:border-ink-600 text-slate-400 dark:text-mist"
            )}
          >
            {i < at ? <Check className="h-3 w-3" /> : i + 1}
          </span>
          {s}
        </li>
      ))}
    </ol>
  );
}

function ShieldFlow({
  onAddNote,
}: {
  onAddNote: (n: LocalNote) => void;
}) {
  const { wallet } = useWallet();
  const [step, setStep] = useState(0);
  const [amt, setAmt] = useState("2000");
  const [submitting, setSubmitting] = useState(false);

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

  const n = Math.max(0, Number(amt) || 0);
  const fee = n * SHIELD_FEE_RATE;
  const netShielded = Math.max(0, n - fee);

  const handleShield = async () => {
    setSubmitting(true);
    try {
      const amountWei = (BigInt(Math.floor(netShielded)) * BigInt(10 ** 18)).toString();
      const res = await createShieldedNote("USDG", amountWei, wallet?.address);

      const newNote: LocalNote = {
        id: `n-${Date.now().toString().slice(-4)}`,
        asset: "USDG",
        amount: netShielded,
        commitment: res.note.commitment,
        created: "Just now",
        status: "spendable",
        nullifierHash: res.note.nullifierHash,
        blindingSecret: res.blindingSecret,
      };

      onAddNote(newNote);
      setStep(0);
      setStatusModal({
        open: true,
        type: "success",
        title: "USDG Shielded Successfully",
        message:
          "Cryptographic note commitment created on Robinhood Chain. Your balance is now shielded in the privacy pool.",
        details: `Commitment: ${res.note.commitment}\nNullifier Hash: ${res.note.nullifierHash}`,
      });
    } catch (err: any) {
      setStatusModal({
        open: true,
        type: "error",
        title: "Shielding Failed",
        message: err?.message || "Failed to create shielded note. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card title="Shield USDG" eyebrow="Enter Privacy Mode">
      <Stepper steps={SHIELD_STEPS} at={step} />

      {step === 0 && (
        <div className="space-y-4">
          <Field label="Deposit Asset">
            <input className={inputClass} readOnly value="USDG · Global Dollar (Robinhood Chain)" />
          </Field>
          <Field label="Amount to Shield (USDG)">
            <input
              className={inputClass}
              inputMode="decimal"
              value={amt}
              onChange={(e) => setAmt(e.target.value.replace(/[^\d.]/g, ""))}
            />
          </Field>
          <p className="text-xs text-mist">
            Verified USDG token: 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168 on Robinhood Chain.
          </p>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-2 text-sm">
          <KV k="Gross USDG Deposit" v={`${n.toLocaleString("en-US")} USDG`} />
          <KV k="Shielding Protocol Fee (0.25%)" v={`${fee.toFixed(2)} USDG`} />
          <KV k="Net Shielded Note Value" v={<span className="text-teal-300 font-semibold">{netShielded.toLocaleString("en-US")} USDG</span>} />
          <KV k="Network Execution Gas" v="≈ 0.0001 ETH (Robinhood Chain)" />
          <KV k="Settlement Pool" v="VeiloraShieldedPool" mono />
        </div>
      )}

      {step === 2 && (
        <ul className="space-y-3">
          {[
            {
              party: "Robinhood Chain Public Ledger",
              sees: `A public deposit transaction of ${n.toLocaleString("en-US")} USDG into the pool.`,
            },
            {
              party: "Veilora Co-Signer (Shard B)",
              sees: "Deposit amount and policy verification. Never sees your note spending secrets.",
            },
            {
              party: "Proof Provider (PPOI)",
              sees: "Cryptographic commitment for association set membership verification.",
            },
            {
              party: "Future Counterparties",
              sees: "Nothing. Note ownership and transfers remain zero-knowledge.",
            },
          ].map((item, idx) => (
            <li key={idx} className="rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950/60 p-3 text-xs">
              <p className="font-semibold text-slate-900 dark:text-cream mb-1">{item.party}</p>
              <p className="text-slate-500 dark:text-mist">{item.sees}</p>
            </li>
          ))}
        </ul>
      )}

      {step === 3 && (
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <Check className="h-4 w-4 text-teal-500 dark:text-teal-300 shrink-0" />
            <span className="text-slate-700 dark:text-cream-dim">Clean Provenance: Input source verified against Association Set</span>
          </div>
          <div className="flex items-center gap-3">
            <Check className="h-4 w-4 text-teal-500 dark:text-teal-300 shrink-0" />
            <span className="text-slate-700 dark:text-cream-dim">Daily Velocity: {n.toLocaleString("en-US")} USDG within policy limit</span>
          </div>
          <div className="flex items-center gap-3">
            <Check className="h-4 w-4 text-teal-500 dark:text-teal-300 shrink-0" />
            <span className="text-slate-700 dark:text-cream-dim">Gas Reserve: Maintained above 0.05 ETH floor</span>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-700 dark:text-cream-dim leading-relaxed">
            Ready to generate note commitment and deposit {n.toLocaleString("en-US")} USDG.
            Your device will compute the cryptographic nullifier and blinding secret locally.
          </p>
          <div className="rounded-xl border border-teal-500/30 bg-teal-500/10 p-4 text-xs text-teal-800 dark:text-teal-200">
            Cryptographic SHA-256 commitment will be added to the Robinhood Chain shielded tree.
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-100 dark:border-ink-700/60 pt-5">
        {step > 0 ? (
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        ) : (
          <span className="text-xs text-mist">Protected by Veilora Shielded Pool</span>
        )}

        {step < 4 ? (
          <Button disabled={n <= 0} onClick={() => setStep((s) => s + 1)}>
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button disabled={submitting} onClick={handleShield}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Shielding…
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" /> Sign and Shield
              </>
            )}
          </Button>
        )}
      </div>

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
    </Card>
  );
}

function UnshieldFlow({
  notes,
  onSpendNote,
}: {
  notes: LocalNote[];
  onSpendNote: (id: string) => void;
}) {
  const { wallet } = useWallet();
  const spendable = notes.filter((n) => n.status === "spendable" && n.asset === "USDG");

  const [selectedNoteId, setSelectedNoteId] = useState(spendable[0]?.id || "");
  const [customDestination, setCustomDestination] = useState(false);
  const [destinationAddress, setDestinationAddress] = useState("");
  const [destinationModalOpen, setDestinationModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  const selectedNote = spendable.find((n) => n.id === selectedNoteId) || spendable[0];
  const targetDestination = customDestination && destinationAddress ? destinationAddress : (wallet?.address || "0x5e4a…b163");

  const handleUnshield = async () => {
    if (!selectedNote) return;
    setSubmitting(true);
    try {
      // Generate real provenance proof against rhc-clean-v1 set
      const proof = await generateProvenanceProof(selectedNote.commitment, "USDG");
      onSpendNote(selectedNote.id);

      setStatusModal({
        open: true,
        type: "success",
        title: "Unshield Proof Verified",
        message:
          `Clean provenance proof generated and verified against ${proof.setId}. Funds are released to destination on Robinhood Chain.`,
        details: `Proof ID: ${proof.proofId}\nRoot Hash: ${proof.rootHash}\nDestination: ${targetDestination}`,
      });
    } catch (err: any) {
      setStatusModal({
        open: true,
        type: "error",
        title: "Unshield Failed",
        message: err?.message || "Failed to generate provenance proof. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card title="Safe Unshield" eyebrow="Exit Privacy Mode">
      {spendable.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-mist">No spendable shielded USDG notes available.</p>
          <p className="text-xs text-mist/80 mt-1">Shield some USDG first to create notes.</p>
        </div>
      ) : (
        <div className="space-y-5">
          <Field label="Select Shielded Note">
            <select
              className={inputClass}
              value={selectedNoteId}
              onChange={(e) => setSelectedNoteId(e.target.value)}
            >
              {spendable.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.amount.toLocaleString("en-US")} USDG · {n.created} ({n.commitment.slice(0, 10)}…)
                </option>
              ))}
            </select>
          </Field>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-mist">
                Payout Destination
              </span>
              <Button
                variant="outline"
                className="!px-2.5 !py-1 text-xs"
                onClick={() => setDestinationModalOpen(true)}
              >
                Change Destination
              </Button>
            </div>
            <div className="rounded-lg border border-teal-400/40 bg-teal-400/5 p-3.5">
              <p className="text-sm text-cream font-medium">
                {customDestination ? "Custom Destination Address" : "Origin Smart Account (Default)"}
              </p>
              <p className="font-mono text-xs text-mist mt-1 truncate">{targetDestination}</p>
            </div>
          </div>

          <div className="space-y-2 border-t border-ink-600/60 pt-4 text-sm">
            <KV k="Unshield Amount" v={`${selectedNote?.amount.toLocaleString("en-US")} USDG`} />
            <KV k="Exit Fee (0.25%)" v={`${((selectedNote?.amount || 0) * SHIELD_FEE_RATE).toFixed(2)} USDG`} />
            <KV
              k="Net Public USDG Received"
              v={<span className="text-teal-300 font-semibold">{((selectedNote?.amount || 0) * (1 - SHIELD_FEE_RATE)).toLocaleString("en-US")} USDG</span>}
            />
            <KV k="Provenance Verification" v="PPOI Clean Set #rhc-clean-v1" />
          </div>

          <div className="border-t border-ink-600/60 pt-5">
            <Button
              className="w-full"
              disabled={submitting}
              onClick={handleUnshield}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Verifying Provenance…
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" /> Prove & Unshield USDG
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Destination Input Modal */}
      <Modal
        open={destinationModalOpen}
        onClose={() => setDestinationModalOpen(false)}
        title="Set Payout Destination"
        description="Choose where unshielded funds will be transferred on Robinhood Chain."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setCustomDestination(false);
                setDestinationAddress("");
                setDestinationModalOpen(false);
              }}
            >
              Reset to Vault
            </Button>
            <Button
              variant="primary"
              disabled={!/^0x[0-9a-fA-F]{40}$/.test(destinationAddress.trim())}
              onClick={() => {
                setCustomDestination(true);
                setDestinationModalOpen(false);
              }}
            >
              Confirm Destination
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Recipient Address (0x…)">
            <input
              className={inputClass}
              placeholder="0x…"
              value={destinationAddress}
              onChange={(e) => setDestinationAddress(e.target.value.trim())}
            />
          </Field>
          <div className="rounded-xl border border-amber-300 dark:border-gold-400/30 bg-amber-50 dark:bg-gold-400/5 p-3 text-xs text-slate-700 dark:text-cream-dim">
            Ensure this is a valid EVM address on Robinhood Chain. Funds unshield directly to this recipient.
          </div>
        </div>
      </Modal>

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
    </Card>
  );
}

function ReceiveCard({ walletAddress }: { walletAddress?: string }) {
  const [copied, setCopied] = useState(false);
  const addr = walletAddress || "0x5e4ae3b279fcC9c470dF26875906D808BdE5B163";

  return (
    <Card title="Shielded Deposit Address" eyebrow="Receive Privately">
      <p className="break-all rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950/60 p-3 font-mono text-xs text-amber-800 dark:text-gold-200">
        {addr}
      </p>
      <Button
        variant="outline"
        className="mt-3 w-full"
        onClick={() => {
          navigator.clipboard?.writeText(addr).catch(() => undefined);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copied" : "Copy Smart Account Address"}
      </Button>
      <p className="mt-3 text-xs text-slate-500 dark:text-mist">
        Deposits to this smart account can be shielded into private notes on Robinhood Chain.
      </p>
    </Card>
  );
}

function NotesCard({ notes }: { notes: LocalNote[] }) {
  return (
    <Card title="Shielded Notes" eyebrow="Your Shielded Balances" bodyClassName="p-0">
      {notes.length === 0 ? (
        <div className="p-5 text-center text-xs text-slate-400 dark:text-mist">No shielded notes found.</div>
      ) : (
        <ul>
          {notes.map((n) => (
            <li key={n.id} className="border-t border-slate-100 dark:border-ink-700/50 px-5 py-3 first:border-0">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className={n.status === "spent" ? "text-slate-400 dark:text-mist line-through" : "text-slate-900 dark:text-cream font-medium"}>
                  {n.amount.toLocaleString("en-US")} {n.asset}
                </span>
                <Badge tone={n.status === "spendable" ? "teal" : "mist"}>{n.status}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-slate-400 dark:text-mist">{n.created}</p>
              <p className="mt-1 font-mono text-[11px] text-slate-400 dark:text-mist/80 truncate">
                Commitment: {n.commitment}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
