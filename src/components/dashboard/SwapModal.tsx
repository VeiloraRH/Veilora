import { useState } from "react";
import { ArrowLeftRight, X, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui";

interface SwapModalProps {
  open: boolean;
  onClose: () => void;
  publicUsdg: number;
  onSuccess: (details: string) => void;
}

const EQUITIES = [
  { symbol: "NVDA", name: "NVIDIA Corp", price: 131.25 },
  { symbol: "AAPL", name: "Apple Inc", price: 228.40 },
  { symbol: "MSFT", name: "Microsoft Corp", price: 418.10 },
  { symbol: "AMZN", name: "Amazon.com Inc", price: 186.50 },
  { symbol: "COIN", name: "Coinbase Global", price: 215.30 },
  { symbol: "TSLA", name: "Tesla Inc", price: 242.80 },
];

export function SwapModal({ open, onClose, publicUsdg, onSuccess }: SwapModalProps) {
  const [targetEquity, setTargetEquity] = useState(EQUITIES[0]);
  const [usdgAmount, setUsdgAmount] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const parsedUsdg = parseFloat(usdgAmount) || 0;
  const estimatedShares = parsedUsdg > 0 ? (parsedUsdg / targetEquity.price).toFixed(4) : "0.0000";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedUsdg <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onClose();
      onSuccess(`Swapped ${parsedUsdg} USDG for ${estimatedShares} ${targetEquity.symbol}`);
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
              <ArrowLeftRight className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-cream">Swap Assets</h2>
              <p className="text-xs text-slate-500 dark:text-mist">Trade USDG for Robinhood tokenized equities</p>
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
          {/* You Pay */}
          <div className="rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950/60 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-mist">
              <span>You Pay</span>
              <span>Available: {publicUsdg.toFixed(2)} USDG</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <input
                type="number"
                step="any"
                className="w-full bg-transparent text-xl font-semibold text-slate-900 dark:text-cream focus:outline-none"
                placeholder="0.00"
                value={usdgAmount}
                onChange={(e) => setUsdgAmount(e.target.value)}
                required
              />
              <span className="rounded-lg bg-slate-200 dark:bg-ink-800 px-2.5 py-1 text-xs font-semibold text-slate-900 dark:text-cream">
                USDG
              </span>
            </div>
          </div>

          {/* You Receive */}
          <div className="rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950/60 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-mist">
              <span>You Receive (Estimated)</span>
              <span>Price: ${targetEquity.price.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xl font-semibold text-slate-900 dark:text-cream">
                {estimatedShares}
              </span>
              <select
                value={targetEquity.symbol}
                onChange={(e) => {
                  const found = EQUITIES.find((eq) => eq.symbol === e.target.value);
                  if (found) setTargetEquity(found);
                }}
                className="rounded-lg border border-slate-300 dark:border-ink-700 bg-white dark:bg-ink-800 px-2 py-1 text-xs font-semibold text-slate-900 dark:text-cream focus:outline-none"
              >
                {EQUITIES.map((eq) => (
                  <option key={eq.symbol} value={eq.symbol}>
                    {eq.symbol} — {eq.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-teal-400/20 bg-teal-400/5 p-3 flex items-center gap-2 text-xs text-teal-600 dark:text-teal-300">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>Executed via Uniswap V3 on Robinhood Chain under 2-of-3 quorum.</span>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-ink-800">
            <Button type="button" variant="outline" onClick={onClose} className="text-xs">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || parsedUsdg <= 0}
              className="bg-[#eaba65] hover:bg-[#d8a855] text-slate-950 font-medium text-xs"
            >
              {loading ? "Swapping…" : `Swap for ${targetEquity.symbol}`}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
