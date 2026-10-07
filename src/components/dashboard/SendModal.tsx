import { useState } from "react";
import { ArrowLeft, ArrowUpRight, ChevronRight, UserCheck, X, Building2, Wallet } from "lucide-react";
import { Button, inputClass } from "@/components/ui";
import { QuorumIndicator } from "@/components/app/QuorumIndicator";

interface SendModalProps {
  open: boolean;
  onClose: () => void;
  publicUsdg: number;
  ethBalance: number;
  onSuccess: (details: string) => void;
}

const RECENT_CONTACTS = [
  {
    name: "Verified Vendor",
    tag: "Supplier",
    address: "0x9fE129B7Fca8406798031d6833c8b417eC0104b3",
    icon: Building2,
  },
  {
    name: "Payroll Distribution",
    tag: "Operations",
    address: "0x51c072bE892a0Fe861A721Ea648D4a18928A8A2d",
    icon: UserCheck,
  },
  {
    name: "Operational Reserve",
    tag: "Treasury",
    address: "0x7A3f9c2E41b8D05a6F1e3C27b94d0aE58c1FC91e",
    icon: Wallet,
  },
];

export function SendModal({
  open,
  onClose,
  publicUsdg,
  ethBalance,
  onSuccess,
}: SendModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [asset, setAsset] = useState<"USDG" | "ETH">("USDG");
  const [recipient, setRecipient] = useState("");
  const [recipientLabel, setRecipientLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const maxBalance = asset === "USDG" ? publicUsdg : ethBalance;
  const parsedAmount = parseFloat(amount) || 0;

  const handlePickContact = (contact: (typeof RECENT_CONTACTS)[0]) => {
    setRecipient(contact.address);
    setRecipientLabel(contact.name);
    setStep(2);
  };

  const handleContinueFromStep1 = () => {
    const clean = recipient.trim();
    if (!clean.startsWith("0x") || clean.length !== 42) {
      alert("Please enter a valid 42-character EVM address.");
      return;
    }
    setStep(2);
  };

  const handleContinueFromStep2 = () => {
    if (parsedAmount <= 0) {
      alert("Please enter an amount greater than 0.");
      return;
    }
    if (parsedAmount > maxBalance) {
      alert("Amount exceeds your available balance.");
      return;
    }
    setStep(3);
  };

  const handleConfirmSend = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onClose();
      setStep(1);
      setRecipient("");
      setRecipientLabel("");
      setAmount("");
      onSuccess(`Sent ${parsedAmount} ${asset} to ${recipient.slice(0, 8)}…${recipient.slice(-6)}`);
    }, 600);
  };

  const handleClose = () => {
    setStep(1);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 dark:bg-ink-950/80 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Modal Dialog (Carousel Step Format) */}
      <div className="panel relative z-10 w-full max-w-md overflow-hidden bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 shadow-2xl rounded-3xl p-6">
        {/* Header with Navigation */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-ink-800">
          <div className="flex items-center gap-2">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-cream hover:bg-slate-200 transition-colors"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#eaba65]/10 text-amber-600 dark:text-[#eaba65]">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            )}
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-cream">
                {step === 1 ? "Select Recipient" : step === 2 ? "Enter Amount" : "Review Transfer"}
              </h2>
              <p className="text-[11px] text-slate-400 dark:text-mist">
                Step {step} of 3
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 dark:bg-ink-800 text-slate-400 hover:text-slate-700 dark:text-mist dark:hover:text-cream transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Carousel Slide 1: Recipient Selection */}
        {step === 1 && (
          <div className="py-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-cream mb-1.5">
                Recipient Address (0x…)
              </label>
              <div className="relative">
                <input
                  type="text"
                  className={`${inputClass} pr-16`}
                  placeholder="0x…"
                  value={recipient}
                  onChange={(e) => {
                    setRecipient(e.target.value.trim());
                    setRecipientLabel("");
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      if (text) setRecipient(text.trim());
                    } catch {
                      // clipboard fallback
                    }
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-medium text-[#eaba65] px-2 py-1 hover:underline"
                >
                  Paste
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-mist mb-2">
                Recent / Verified Contacts:
              </p>
              <div className="space-y-2">
                {RECENT_CONTACTS.map((c) => {
                  const Icon = c.icon;
                  return (
                    <button
                      key={c.address}
                      type="button"
                      onClick={() => handlePickContact(c)}
                      className="w-full flex items-center justify-between p-3 rounded-2xl border border-slate-100 dark:border-ink-800 hover:border-[#eaba65] bg-slate-50 dark:bg-ink-950/60 hover:bg-slate-100/60 dark:hover:bg-ink-850 text-left transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-700 text-slate-700 dark:text-cream group-hover:border-[#eaba65]">
                          <Icon className="h-4 w-4 text-[#eaba65]" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-900 dark:text-cream">
                            {c.name}
                          </p>
                          <p className="font-mono text-[10px] text-slate-400 dark:text-mist">
                            {c.address.slice(0, 10)}…{c.address.slice(-6)}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-cream transition-transform group-hover:translate-x-0.5" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="button"
                disabled={!recipient.trim()}
                onClick={handleContinueFromStep1}
                className="w-full py-2.5 rounded-xl bg-[#eaba65] hover:bg-[#d8a855] text-slate-950 font-semibold text-xs"
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Carousel Slide 2: Amount & Asset */}
        {step === 2 && (
          <div className="py-4 space-y-5">
            {/* Selected Recipient Pill */}
            <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-ink-950/60 border border-slate-100 dark:border-ink-800 p-2.5 text-xs">
              <span className="text-slate-500 dark:text-mist">Sending to:</span>
              <span className="font-mono text-slate-900 dark:text-cream font-medium">
                {recipientLabel ? `${recipientLabel} (${recipient.slice(0, 6)}…)` : `${recipient.slice(0, 8)}…${recipient.slice(-6)}`}
              </span>
            </div>

            {/* Asset Selector */}
            <div className="flex rounded-xl bg-slate-100 dark:bg-ink-850 p-1">
              <button
                type="button"
                onClick={() => setAsset("USDG")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  asset === "USDG"
                    ? "bg-white dark:bg-ink-700 text-slate-900 dark:text-cream shadow-xs"
                    : "text-slate-500 dark:text-mist hover:text-slate-900 dark:hover:text-cream"
                }`}
              >
                USDG (Global Dollar)
              </button>
              <button
                type="button"
                onClick={() => setAsset("ETH")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  asset === "ETH"
                    ? "bg-white dark:bg-ink-700 text-slate-900 dark:text-cream shadow-xs"
                    : "text-slate-500 dark:text-mist hover:text-slate-900 dark:hover:text-cream"
                }`}
              >
                ETH (Native Gas)
              </button>
            </div>

            {/* Big Numeral Amount Input (like inspo) */}
            <div className="rounded-2xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950/40 p-5 text-center space-y-2">
              <span className="text-xs text-slate-400 dark:text-mist uppercase tracking-wider font-semibold">
                Amount to Send
              </span>
              <div className="flex items-center justify-center">
                <input
                  type="number"
                  step="any"
                  autoFocus
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full text-center text-4xl font-bold text-slate-900 dark:text-cream bg-transparent focus:outline-none"
                />
              </div>
              <div className="flex items-center justify-center gap-2 pt-1 text-xs text-slate-500 dark:text-mist">
                <span>Available: {maxBalance.toFixed(2)} {asset}</span>
                <button
                  type="button"
                  onClick={() => setAmount(maxBalance.toString())}
                  className="rounded-full bg-[#eaba65]/20 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-gold-300 hover:bg-[#eaba65]/30 transition-colors"
                >
                  MAX
                </button>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="button"
                disabled={parsedAmount <= 0}
                onClick={handleContinueFromStep2}
                className="w-full py-2.5 rounded-xl bg-[#eaba65] hover:bg-[#d8a855] text-slate-950 font-semibold text-xs"
              >
                Review Transfer
              </Button>
            </div>
          </div>
        )}

        {/* Carousel Slide 3: Review & Confirm */}
        {step === 3 && (
          <div className="py-4 space-y-4">
            <div className="rounded-2xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950/60 p-4 space-y-3">
              <div className="text-center pb-3 border-b border-slate-200 dark:border-ink-800">
                <p className="text-xs text-slate-500 dark:text-mist">Transfer Amount</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-cream mt-0.5">
                  {parsedAmount.toFixed(2)} {asset}
                </p>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-mist">Recipient:</span>
                  <span className="font-mono text-slate-900 dark:text-cream font-medium">
                    {recipient.slice(0, 10)}…{recipient.slice(-6)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-mist">Network Fee:</span>
                  <span className="font-mono text-slate-900 dark:text-cream font-medium">
                    ~0.0001 ETH
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-500 dark:text-mist">Security:</span>
                  <div className="flex items-center gap-1.5 text-slate-900 dark:text-cream font-medium">
                    <QuorumIndicator />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(2)}
                className="flex-1 text-xs py-2.5 rounded-xl"
              >
                Edit
              </Button>
              <Button
                type="button"
                disabled={loading}
                onClick={handleConfirmSend}
                className="flex-1 py-2.5 rounded-xl bg-[#eaba65] hover:bg-[#d8a855] text-slate-950 font-semibold text-xs"
              >
                {loading ? "Signing…" : "Confirm & Send"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
