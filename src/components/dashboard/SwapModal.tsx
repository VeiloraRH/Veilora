import { useState } from "react";
import { ArrowDownUp, ChevronDown, X } from "lucide-react";
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
  { symbol: "ETH", name: "Ethereum", price: 3120.00 },
  { symbol: "COIN", name: "Coinbase Global", price: 215.30 },
  { symbol: "TSLA", name: "Tesla Inc", price: 242.80 },
];

export function SwapModal({ open, onClose, publicUsdg, onSuccess }: SwapModalProps) {
  const [targetEquity, setTargetEquity] = useState(EQUITIES[0]);
  const [usdgAmount, setUsdgAmount] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const parsedUsdg = parseFloat(usdgAmount) || 0;
  const estimatedShares = parsedUsdg > 0 ? (parsedUsdg / targetEquity.price).toFixed(4) : "0";

  const handleApplyPercent = (pct: number) => {
    const val = (publicUsdg * pct).toFixed(2);
    setUsdgAmount(val);
  };

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
      <div
        className="fixed inset-0 bg-slate-900/60 dark:bg-ink-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog matching swap-inspo.webp */}
      <div className="panel relative z-10 w-full max-w-md overflow-hidden bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 shadow-2xl rounded-3xl p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-ink-800">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900 dark:text-cream">
              Swap
            </h2>
            <span className="rounded-full bg-teal-500/10 px-2 py-0.5 text-[10px] font-semibold text-teal-600 dark:text-teal-400">
              Robinhood AMM
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 dark:bg-ink-800 text-slate-400 hover:text-slate-700 dark:text-mist dark:hover:text-cream transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Card 1: SELL (USDG) */}
          <div className="rounded-2xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950/60 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-mist">
              <span className="font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[11px]">
                SELL
              </span>
              <div className="flex items-center gap-1.5">
                <span>Bal: {publicUsdg.toFixed(2)} USDG</span>
                <button
                  type="button"
                  onClick={() => setUsdgAmount(publicUsdg.toString())}
                  className="rounded bg-[#eaba65]/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-gold-300 hover:bg-[#eaba65]/30 transition-colors"
                >
                  MAX
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              {/* Asset Badge */}
              <div className="flex items-center gap-2 rounded-xl bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-700 px-3 py-1.5 shadow-xs">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-500/15 text-teal-600 font-bold text-xs">
                  $
                </span>
                <span className="text-sm font-semibold text-slate-900 dark:text-cream">
                  USDG
                </span>
              </div>

              {/* Big Input Amount */}
              <div className="text-right flex-1">
                <input
                  type="number"
                  step="any"
                  autoFocus
                  placeholder="0"
                  value={usdgAmount}
                  onChange={(e) => setUsdgAmount(e.target.value)}
                  className="w-full text-right text-2xl font-bold text-slate-900 dark:text-cream bg-transparent focus:outline-none"
                  required
                />
                <p className="text-[11px] text-slate-400 dark:text-mist">
                  ~${parsedUsdg > 0 ? parsedUsdg.toFixed(2) : "0.00"}
                </p>
              </div>
            </div>
          </div>

          {/* Floating Swap Direction Button */}
          <div className="relative flex justify-center -my-3 z-10">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-850 text-slate-600 dark:text-cream shadow-sm">
              <ArrowDownUp className="h-4 w-4" />
            </div>
          </div>

          {/* Card 2: BUY (Target Equity) */}
          <div className="rounded-2xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950/60 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-mist">
              <span className="font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[11px]">
                BUY
              </span>
              <span>1 {targetEquity.symbol} ≈ ${targetEquity.price.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              {/* Asset Dropdown Selector */}
              <div className="relative">
                <select
                  value={targetEquity.symbol}
                  onChange={(e) => {
                    const found = EQUITIES.find((eq) => eq.symbol === e.target.value);
                    if (found) setTargetEquity(found);
                  }}
                  className="appearance-none flex items-center gap-2 rounded-xl bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-700 pl-3 pr-8 py-1.5 text-sm font-semibold text-slate-900 dark:text-cream shadow-xs cursor-pointer focus:outline-none"
                >
                  {EQUITIES.map((eq) => (
                    <option key={eq.symbol} value={eq.symbol} className="bg-white dark:bg-ink-900">
                      {eq.symbol} · {eq.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              </div>

              {/* Big Calculated Output */}
              <div className="text-right flex-1">
                <p className="text-2xl font-bold text-slate-900 dark:text-cream truncate">
                  {estimatedShares}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-mist">
                  ~${parsedUsdg > 0 ? parsedUsdg.toFixed(2) : "0.00"}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Percentage Pills (25%, 50%, 75%, Max) like Solflare & inspo */}
          <div className="grid grid-cols-4 gap-2 pt-1">
            {[0.25, 0.5, 0.75, 1].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => handleApplyPercent(pct)}
                className="rounded-xl border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 py-1.5 text-xs font-semibold text-slate-700 dark:text-cream hover:border-[#eaba65] transition-colors"
              >
                {pct === 1 ? "Max" : `${pct * 100}%`}
              </button>
            ))}
          </div>

          {/* Rate & Route Meta */}
          <div className="rounded-xl border border-slate-100 dark:border-ink-800/80 bg-slate-50/50 dark:bg-ink-950/40 p-3 text-xs space-y-1 text-slate-500 dark:text-mist">
            <div className="flex justify-between">
              <span>Route:</span>
              <span className="text-teal-600 dark:text-teal-400 font-medium">Best Rate (Direct Pool)</span>
            </div>
            <div className="flex justify-between">
              <span>Network Fee:</span>
              <span className="font-mono text-slate-700 dark:text-cream">~0.0001 ETH</span>
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              disabled={loading || parsedUsdg <= 0}
              className="w-full py-3 rounded-2xl bg-[#eaba65] hover:bg-[#d8a855] text-slate-950 font-semibold text-xs transition-all shadow-sm"
            >
              {loading ? "Authorizing Swap…" : parsedUsdg > 0 ? "Authorize Swap" : "Enter amount"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
