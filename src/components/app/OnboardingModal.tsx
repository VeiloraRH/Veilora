import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  EyeOff,
  Sparkles,
  Laptop,
  Server,
  Fingerprint,
  CheckCircle2,
  Loader2,
  X,
} from "lucide-react";
import { useWallet, type CreatedAccountDetails } from "@/lib/walletContext";
import { Button, Field, StatusModal, inputClass } from "@/components/ui";
import { KeyBackupModal } from "./KeyBackupModal";
import { cn } from "@/lib/utils";

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
}

export function OnboardingModal({ open, onClose }: OnboardingModalProps) {
  const { createAccount, setWalletAddress } = useWallet();
  const [slide, setSlide] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [existingMode, setExistingMode] = useState(false);
  const [existingAddr, setExistingAddr] = useState("");
  const [createdAccount, setCreatedAccount] = useState<CreatedAccountDetails | null>(null);
  const [showBackupModal, setShowBackupModal] = useState(false);

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

  const totalSlides = 3;

  const handleNext = () => {
    if (slide < totalSlides - 1) {
      setSlide((s) => s + 1);
    }
  };

  const handlePrev = () => {
    if (slide > 0) {
      setSlide((s) => s - 1);
    }
  };

  const handleCreateNew = async () => {
    setSubmitting(true);
    try {
      const res = await createAccount();
      setCreatedAccount(res);
      setShowBackupModal(true);
    } catch (err: any) {
      setStatusModal({
        open: true,
        type: "error",
        title: "Account Creation Failed",
        message: err?.message || "Could not generate smart account. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackupConfirm = () => {
    localStorage.setItem("veilora:onboarded", "true");
    setShowBackupModal(false);
    onClose();
  };

  const handleConnectExisting = () => {
    const clean = existingAddr.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(clean)) return;

    setWalletAddress(clean);
    localStorage.setItem("veilora:onboarded", "true");
    onClose();
    setStatusModal({
      open: true,
      type: "success",
      title: "Account Connected",
      message: "Connected to your existing Veilora smart account on Robinhood Chain.",
      details: `Address: ${clean}`,
    });
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-ink-950/85 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />

        {/* Modal Carousel Window */}
        <div className="panel relative z-10 w-full max-w-lg overflow-hidden border border-ink-600/80 bg-ink-900 shadow-2xl transition-all">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-ink-600/60 px-6 py-4">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-[0.16em] text-mist">
                Step {slide + 1} of {totalSlides}
              </span>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-mist hover:bg-ink-700 hover:text-cream transition-colors"
              aria-label="Close onboarding"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Slide Content */}
          <div className="p-6">
            {slide === 0 && (
              <div className="space-y-4">
                <div className="grid h-12 w-12 place-items-center rounded-xl border border-gold-400/40 bg-gold-400/10 text-gold-300">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-display text-2xl font-semibold text-cream">
                    No Single Key Can Move Your Funds
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-cream-dim">
                    Veilora replaces risky seed phrases with a modern 2-of-3 threshold smart account on Robinhood Chain.
                  </p>
                </div>

                <div className="space-y-2.5 pt-2">
                  <div className="flex items-start gap-3 rounded-lg border border-ink-600/60 bg-ink-950/40 p-3 text-xs">
                    <Laptop className="h-4 w-4 text-gold-300 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-cream">Shard A · Device Key</p>
                      <p className="text-mist">Saved securely in your local browser storage.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border border-ink-600/60 bg-ink-950/40 p-3 text-xs">
                    <Server className="h-4 w-4 text-gold-300 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-cream">Shard B · Veilora Co-Signer</p>
                      <p className="text-mist">Automatically evaluates your safety rules before adding its signature.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border border-ink-600/60 bg-ink-950/40 p-3 text-xs">
                    <Fingerprint className="h-4 w-4 text-gold-300 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-cream">Shard C · Recovery Key</p>
                      <p className="text-mist">Restores your account seamlessly if you ever lose access to this device.</p>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-mist pt-1">
                  Any two keys can authorize a move; one alone cannot touch funds.
                </p>
              </div>
            )}

            {slide === 1 && (
              <div className="space-y-4">
                <div className="grid h-12 w-12 place-items-center rounded-xl border border-teal-400/40 bg-teal-400/10 text-teal-300">
                  <EyeOff className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-display text-2xl font-semibold text-cream">
                    Zero-Knowledge Privacy on Robinhood Chain
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-cream-dim">
                    Standard blockchain transfers expose your full balance and transaction history to everyone. Veilora keeps your finances private.
                  </p>
                </div>

                <ul className="space-y-3 pt-2 text-xs">
                  <li className="flex items-start gap-3 rounded-lg border border-ink-600/60 bg-ink-950/40 p-3">
                    <CheckCircle2 className="h-4 w-4 text-teal-300 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-cream">Shielded Balances</p>
                      <p className="text-mist">
                        Transform public USDG into private zero-knowledge notes inside the Veilora shielded pool.
                      </p>
                    </div>
                  </li>

                  <li className="flex items-start gap-3 rounded-lg border border-ink-600/60 bg-ink-950/40 p-3">
                    <CheckCircle2 className="h-4 w-4 text-teal-300 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-cream">Clean Provenance Proofs</p>
                      <p className="text-mist">
                        Prove your funds come from untainted sources using cryptographic association sets without revealing your deposit history.
                      </p>
                    </div>
                  </li>

                  <li className="flex items-start gap-3 rounded-lg border border-ink-600/60 bg-ink-950/40 p-3">
                    <CheckCircle2 className="h-4 w-4 text-teal-300 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-cream">Selective Disclosure</p>
                      <p className="text-mist">
                        Share read-only view keys with tax accountants or auditors on your terms.
                      </p>
                    </div>
                  </li>
                </ul>
              </div>
            )}

            {slide === 2 && (
              <div className="space-y-4">
                <div className="grid h-12 w-12 place-items-center rounded-xl border border-gold-400/40 bg-gold-400/10 text-gold-300">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-display text-2xl font-semibold text-cream">
                    Ready to Get Started?
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-cream-dim">
                    Deploy your smart account in one click. No extensions or external downloads required.
                  </p>
                </div>

                {!existingMode ? (
                  <div className="space-y-3 pt-2">
                    <Button
                      variant="primary"
                      className="w-full py-3 text-base"
                      disabled={submitting}
                      onClick={handleCreateNew}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" /> Generating Keys…
                        </>
                      ) : (
                        "Create My Smart Account"
                      )}
                    </Button>

                    <button
                      onClick={() => setExistingMode(true)}
                      className="w-full text-center text-xs text-gold-300 hover:text-gold-200 transition-colors pt-2"
                    >
                      I already have an account address
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 pt-2">
                    <Field label="Enter Existing Smart Account (0x…)">
                      <input
                        className={inputClass}
                        placeholder="0x…"
                        value={existingAddr}
                        onChange={(e) => setExistingAddr(e.target.value)}
                      />
                    </Field>

                    <Button
                      variant="primary"
                      className="w-full"
                      disabled={!/^0x[0-9a-fA-F]{40}$/.test(existingAddr.trim())}
                      onClick={handleConnectExisting}
                    >
                      Connect Account
                    </Button>

                    <button
                      onClick={() => setExistingMode(false)}
                      className="w-full text-center text-xs text-mist hover:text-cream transition-colors"
                    >
                      Back to One-Click Account Creation
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Carousel Footer Navigation */}
          <div className="flex items-center justify-between border-t border-ink-600/60 bg-ink-950/40 px-6 py-4">
            <Button
              variant="ghost"
              disabled={slide === 0}
              onClick={handlePrev}
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>

            {/* Slide Dots Indicator */}
            <div className="flex items-center gap-1.5" role="tablist" aria-label="Carousel pagination">
              {Array.from({ length: totalSlides }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setSlide(idx)}
                  className={cn(
                    "h-2 rounded-full transition-all",
                    slide === idx ? "w-6 bg-gold-400" : "w-2 bg-ink-600 hover:bg-ink-500"
                  )}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>

            {slide < totalSlides - 1 ? (
              <Button variant="primary" onClick={handleNext}>
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <span className="w-16" />
            )}
          </div>
        </div>
      </div>

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

      <KeyBackupModal
        open={showBackupModal}
        accountDetails={createdAccount}
        onConfirm={handleBackupConfirm}
      />
    </>
  );
}
