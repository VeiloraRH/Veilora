import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Copy, Loader2, ShieldAlert, Timer } from "lucide-react";
import { ASSETS, GAS_RESERVE, NOTES, PROOF_STATES, VAULT, amount } from "@/demo/data";
import { Badge, Button, Card, DemoNote, Field, KV, PageHeader, Tabs, inputClass } from "@/components/ui";
import { useMode } from "@/lib/mode";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/privacy")({
  component: PrivacyScreen,
});

const SHIELD_STEPS = ["Choose", "Preview", "Disclosures", "Policy", "Authorize", "Track"];
const SHIELD_FEE = 0.0025;

function PrivacyScreen() {
  const [tab, setTab] = useState<"shield" | "unshield">("shield");
  return (
    <>
      <PageHeader
        eyebrow="Privacy mode"
        title="Shield and unshield, step by step."
        description="Shielding is a clear change of state with a before and after, not a magic button. Each step shows what changes, what it costs and who can see it."
        actions={<Tabs value={tab} onChange={setTab} items={[{ id: "shield", label: "Shield" }, { id: "unshield", label: "Unshield" }]} />}
      />
      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        {tab === "shield" ? <ShieldFlow /> : <UnshieldFlow />}
        <div className="space-y-6">
          <ReceiveCard />
          <NotesCard />
        </div>
      </div>
    </>
  );
}

function Stepper({ steps, at }: { steps: string[]; at: number }) {
  return (
    <ol className="mb-6 flex flex-wrap gap-x-4 gap-y-2">
      {steps.map((s, i) => (
        <li key={s} className={cn("flex items-center gap-2 text-xs", i < at ? "text-teal-300" : i === at ? "text-gold-300" : "text-mist")}>
          <span className={cn("grid h-5 w-5 place-items-center rounded-full border text-[10px]", i < at ? "border-teal-400 bg-teal-400/15" : i === at ? "border-gold-400" : "border-ink-500")}>
            {i < at ? <Check className="h-3 w-3" /> : i + 1}
          </span>
          {s}
        </li>
      ))}
    </ol>
  );
}

function ProofTracker({ onDone }: { onDone?: () => void }) {
  const [at, setAt] = useState(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    if (at >= 3) {
      onDoneRef.current?.();
      return;
    }
    const t = window.setTimeout(() => setAt((a) => a + 1), 1100);
    return () => clearTimeout(t);
  }, [at]);
  return (
    <ol className="space-y-2.5">
      {PROOF_STATES.map((s, i) => {
        const isRefund = i === 4;
        const done = !isRefund && i < at;
        const active = !isRefund && i === at;
        return (
          <li key={s} className={cn("flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm", done ? "border-teal-400/40" : active ? "border-gold-400/50" : "border-ink-600/60", isRefund && "border-dashed")}>
            {done ? <Check className="h-4 w-4 text-teal-300" /> : active ? <Loader2 className="h-4 w-4 animate-spin text-gold-300" /> : isRefund ? <Timer className="h-4 w-4 text-mist" /> : <span className="h-4 w-4 rounded-full border border-ink-500" />}
            <span className={done || active ? "text-cream" : "text-mist"}>{s}</span>
            {isRefund && <span className="ml-auto text-xs text-mist">Only if no proof in 15 min</span>}
          </li>
        );
      })}
    </ol>
  );
}

function ShieldFlow() {
  const { mode } = useMode();
  const shieldable = ASSETS.filter((a) => a.shield === "live");
  const [step, setStep] = useState(0);
  const [symbol, setSymbol] = useState(shieldable[0].symbol);
  const [amt, setAmt] = useState("2000");
  const [prover, setProver] = useState<"local" | "server">("local");
  const [settled, setSettled] = useState(false);
  const asset = ASSETS.find((a) => a.symbol === symbol)!;
  const n = Math.max(0, Number(amt) || 0);
  const fee = n * SHIELD_FEE;
  const tooMuch = n > asset.publicBalance;

  const reset = () => {
    setStep(0);
    setSettled(false);
  };

  return (
    <Card title="Enter privacy mode" eyebrow="Shield">
      <Stepper steps={SHIELD_STEPS} at={settled ? 6 : step} />

      {step === 0 && (
        <div className="space-y-4">
          <Field label="What to protect">
            <select className={inputClass} value={symbol} onChange={(e) => setSymbol(e.target.value)}>
              {shieldable.map((a) => (
                <option key={a.symbol} value={a.symbol}>
                  {a.symbol} · {amount(a.publicBalance)} public
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount" hint={tooMuch ? <span className="text-coral-400">More than your public balance.</span> : `Public balance: ${amount(asset.publicBalance)} ${asset.symbol}`}>
            <input className={inputClass} inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^\d.]/g, ""))} />
          </Field>
          <p className="text-xs text-mist">Only USDG can be shielded today. ETH stays public as your gas reserve.</p>
        </div>
      )}

      {step === 1 && (
        <div>
          <KV k={`Public ${symbol}`} v={<span className="text-coral-400">{amount(asset.publicBalance)} → {amount(asset.publicBalance - n)}</span>} />
          <KV k={`Shielded ${symbol}`} v={<span className="text-teal-300">{amount(asset.shieldedBalance)} → {amount(asset.shieldedBalance + n - fee)}</span>} />
          <KV k="New shielded note" v={`${amount(n - fee)} ${symbol}`} />
          <KV k="Shield fee (0.25%)" v={`${amount(fee, 2)} ${symbol}`} />
          <KV k="Gas" v="≈ 0.0018 ETH" />
          <KV k="Gas reserve after" v={<span className="text-teal-300">{(GAS_RESERVE.available - 0.0018).toFixed(4)} ETH (floor {GAS_RESERVE.reserved})</span>} />
        </div>
      )}

      {step === 2 && (
        <ul className="space-y-3">
          {[
            ["Robinhood Chain (public)", `A ${amount(n)} ${symbol} deposit from ${VAULT.short} into the shielded pool.`],
            ["Co-signer (Shard B)", "The plan hash, amount and policy result. Not the note contents."],
            ["Proof provider", "The new commitment being checked against the association set."],
            ["Nobody", "Which note is yours, or what you do with it next inside the shield."],
          ].map(([p, s]) => (
            <li key={p} className="rounded-lg border border-ink-600/60 px-3.5 py-2.5">
              <p className="text-sm text-cream">{p}</p>
              <p className="text-xs text-mist">{s}</p>
            </li>
          ))}
        </ul>
      )}

      {step === 3 && (
        <ul className="space-y-3 text-sm">
          {[
            ["Clean provenance", `Inputs are in Lumen clean set #412 (6 days old, policy under 7).`],
            ["Daily spend limit", `${amount(n)} of 10,000 USDG used today.`],
            ["Gas reserve", "Stays above 0.05 ETH."],
          ].map(([r, d]) => (
            <li key={r} className="flex gap-3">
              <Check className="mt-0.5 h-4 w-4 text-teal-300" />
              <div>
                <p className="text-cream">{r}</p>
                <p className="text-xs text-mist">{d}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <p className="text-sm text-cream-dim">Choose where the proof is generated, then sign with this device. The co-signer adds the second signature if policy passes.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["local", "On this device", "Highest privacy. About 6 seconds."],
                ["server", "Server-assisted", "Faster. The prover only sees a blinded witness."],
              ] as const
            ).map(([id, t, d]) => (
              <button
                key={id}
                onClick={() => setProver(id)}
                className={cn("rounded-lg border p-3.5 text-left", prover === id ? "border-gold-400 bg-gold-400/5" : "border-ink-600 hover:border-ink-500")}
              >
                <p className="text-sm font-medium text-cream">{t}</p>
                <p className="text-xs text-mist">{d}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-4">
          <ProofTracker onDone={() => setSettled(true)} />
          {settled && (
            <div className="rounded-lg border border-teal-400/40 bg-teal-400/5 p-4 text-sm">
              <p className="font-medium text-teal-300">Shielded {amount(n - fee)} {symbol}</p>
              <p className="mt-1 text-xs text-mist">
                Proof generated {prover === "local" ? "on this device" : "server-assisted (blinded)"}. Receipt saved locally.
                {mode === "control" && <span className="font-mono"> Commitment 0x7be2…41ad.</span>}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-ink-600/60 pt-5">
        {step > 0 && step < 5 ? (
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        ) : (
          <DemoNote />
        )}
        {step < 4 && (
          <Button disabled={n <= 0 || tooMuch} onClick={() => setStep((s) => s + 1)}>
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        )}
        {step === 4 && <Button onClick={() => setStep(5)}>Sign and shield</Button>}
        {step === 5 && settled && (
          <Button variant="outline" onClick={reset}>
            Shield more
          </Button>
        )}
      </div>
    </Card>
  );
}

function UnshieldFlow() {
  const spendable = NOTES.filter((n) => n.status === "spendable" && n.asset === "USDG");
  const [noteId, setNoteId] = useState(spendable[0].id);
  const [customDest, setCustomDest] = useState(false);
  const [dest, setDest] = useState("");
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const note = spendable.find((n) => n.id === noteId)!;

  return (
    <Card title="Safe unshield" eyebrow="Unshield">
      {!started ? (
        <div className="space-y-5">
          <Field label="Note to unshield">
            <select className={inputClass} value={noteId} onChange={(e) => setNoteId(e.target.value)}>
              {spendable.map((n) => (
                <option key={n.id} value={n.id}>
                  {amount(n.amount)} {n.asset} · {n.created}
                </option>
              ))}
            </select>
          </Field>

          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.14em] text-mist">Destination</p>
            <div className="rounded-lg border border-teal-400/40 bg-teal-400/5 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-cream">Your verified origin vault</p>
                  <p className="font-mono text-xs text-mist">{VAULT.short}</p>
                </div>
                <Badge tone="teal">Default</Badge>
              </div>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-cream-dim">
              <input type="checkbox" className="accent-[#eaba65]" checked={customDest} onChange={(e) => setCustomDest(e.target.checked)} />
              Send somewhere else instead
            </label>
            {customDest && (
              <div className="mt-3 space-y-3">
                <input className={inputClass} placeholder="0x… destination address" value={dest} onChange={(e) => setDest(e.target.value)} />
                <div className="flex gap-3 rounded-lg border border-gold-400/40 bg-gold-400/5 p-3.5 text-xs text-cream-dim">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-gold-300" />
                  <p>A new destination needs a fresh review and a 24-hour cooling-off period before submission. Amounts over 2,500 USDG also wait 10 minutes.</p>
                </div>
              </div>
            )}
          </div>

          <div>
            <KV k="You receive" v={`${amount(note.amount * (1 - SHIELD_FEE), 2)} USDG (public)`} />
            <KV k="Unshield fee (0.25%)" v={`${amount(note.amount * SHIELD_FEE, 2)} USDG`} />
            <KV k="Public after exit" v="The amount and destination become visible on-chain" />
            <KV k="If the proof provider is down" v="Queued, then refunded to the note. Never lost" />
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-ink-600/60 pt-5">
            <DemoNote />
            <Button disabled={customDest && !/^0x[0-9a-fA-F]{6,}/.test(dest)} onClick={() => setStarted(true)}>
              {customDest ? "Review new destination" : "Sign and unshield"}
            </Button>
          </div>
        </div>
      ) : customDest ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-gold-400/40 bg-gold-400/5 p-4">
            <Timer className="h-5 w-5 text-gold-300" />
            <div>
              <p className="text-sm text-cream">Cooling-off started</p>
              <p className="text-xs text-mist">
                Submits after 23:59:58 unless you cancel. Destination <span className="font-mono">{dest.slice(0, 8)}…</span> was added to the review queue.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setStarted(false)}>
            Cancel unshield
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <ProofTracker onDone={() => setDone(true)} />
          {done && (
            <div className="rounded-lg border border-teal-400/40 bg-teal-400/5 p-4 text-sm">
              <p className="font-medium text-teal-300">Unshielded to {VAULT.short}</p>
              <p className="mt-1 text-xs text-mist">Settled. Receipt saved locally.</p>
            </div>
          )}
          {done && (
            <Button
              variant="outline"
              onClick={() => {
                setStarted(false);
                setDone(false);
              }}
            >
              Done
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

function ReceiveCard() {
  const [copied, setCopied] = useState(false);
  return (
    <Card title="Shielded receive address" eyebrow="Receive privately">
      <p className="break-all rounded-lg border border-ink-600 bg-ink-950/60 p-3 font-mono text-sm text-gold-200">{VAULT.shieldedAddress}</p>
      <Button
        variant="outline"
        className="mt-3 w-full"
        onClick={() => {
          navigator.clipboard?.writeText(VAULT.shieldedAddress).catch(() => undefined);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy address"}
      </Button>
      <p className="mt-3 text-xs text-mist">Payments to this address land as shielded notes. The sender sees only that they paid a shielded address.</p>
    </Card>
  );
}

function NotesCard() {
  const { mode } = useMode();
  return (
    <Card title="Your notes" eyebrow={mode === "control" ? "Control mode" : "Shielded balance"} bodyClassName="p-0">
      <ul>
        {NOTES.map((n) => (
          <li key={n.id} className="border-t border-ink-600/50 px-5 py-3 first:border-0">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className={n.status === "spent" ? "text-mist line-through" : "text-cream"}>
                {amount(n.amount)} {n.asset}
              </span>
              <Badge tone={n.status === "spendable" ? "teal" : n.status === "pending" ? "gold" : "mist"}>{n.status}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-mist">
              {n.origin} · {n.created}
            </p>
            {mode === "control" && <p className="mt-0.5 font-mono text-[11px] text-mist/80">commitment {n.commitment}</p>}
          </li>
        ))}
      </ul>
    </Card>
  );
}
