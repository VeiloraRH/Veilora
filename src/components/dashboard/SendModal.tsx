import { useState } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { Button, inputClass } from "@/components/ui";

interface SendModalProps {
  open: boolean;
  onClose: () => void;
  publicUsdg: number;
  ethBalance: number;
  onSuccess: (details: string) => void;
}

export function SendModal({
  open,
  onClose,
  publicUsdg,
  ethBalance,
  onSuccess,
}: SendModalProps) {
  const [asset, setAsset] = useState<"USDG" | "ETH">("USDG");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const maxBalance = asset === "USDG" ? publicUsdg : ethBalance;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAddr = recipient.trim();
    const parsedAmount = parseFloat(amount);

    if (!cleanAddr.startsWith("0x") || cleanAddr.length !== 42) {
      alert("Please enter a valid 42-character recipient address.");
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Please enter a valid amount greater than 0.");
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onClose();
      onSuccess(`Sent ${parsedAmount} ${asset} to ${cleanAddr.slice(0, 8)}…${cleanAddr.slice(-6)}`);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 dark:bg-ink-950/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="panel relative z-10 w-full max-w-md overflow-hidden bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 shadow-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-ink-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-400/10 text-gold-400 border border-gold-400/20">
              <ArrowUpRight className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-cream">Send Tokens</h2>
              <p className="text-xs text-slate-500 dark:text-mist">Robinhood Chain transfer</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:text-mist dark:hover:text-cream transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-cream mb-1.5">Asset</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAsset("USDG")}
                className={`rounded-xl border p-2.5 text-xs font-medium text-left transition-colors ${
                  asset === "USDG"
                    ? "border-[#eaba65] bg-[#eaba65]/10 text-slate-900 dark:text-cream"
                    : "border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950/50 text-slate-600 dark:text-mist"
                }`}
              >
                <span className="font-semibold block">USDG</span>
                <span className="text-[11px] text-slate-500 dark:text-mist">Avail: {publicUsdg.toFixed(2)}</span>
              </button>
              <button
                type="button"
                onClick={() => setAsset("ETH")}
                className={`rounded-xl border p-2.5 text-xs font-medium text-left transition-colors ${
                  asset === "ETH"
                    ? "border-[#eaba65] bg-[#eaba65]/10 text-slate-900 dark:text-cream"
                    : "border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950/50 text-slate-600 dark:text-mist"
                }`}
              >
                <span className="font-semibold block">ETH</span>
                <span className="text-[11px] text-slate-500 dark:text-mist">Avail: {ethBalance.toFixed(4)}</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-cream mb-1.5">Recipient Address</label>
            <input
              type="text"
              className={inputClass}
              placeholder="0x…"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-700 dark:text-cream">Amount</label>
              <button
                type="button"
                onClick={() => setAmount(maxBalance.toString())}
                className="text-[11px] font-medium text-[#eaba65] hover:underline"
              >
                Max ({maxBalance.toFixed(2)})
              </button>
            </div>
            <input
              type="number"
              step="any"
              className={inputClass}
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950/60 p-3 text-xs space-y-1">
            <div className="flex justify-between text-slate-500 dark:text-mist">
              <span>Estimated Network Fee:</span>
              <span className="font-mono text-slate-900 dark:text-cream">~0.0001 ETH</span>
            </div>
            <div className="flex justify-between text-slate-500 dark:text-mist">
              <span>Quorum:</span>
              <span className="text-teal-600 dark:text-teal-300 font-medium">2-of-3 Threshold Co-signed</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-ink-800">
            <Button type="button" variant="outline" onClick={onClose} className="text-xs">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-[#eaba65] hover:bg-[#d8a855] text-slate-950 font-medium text-xs"
            >
              {loading ? "Authorizing…" : "Authorize Transfer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
