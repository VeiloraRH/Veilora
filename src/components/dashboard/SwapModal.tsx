import { useState } from "react";
import { ArrowDownUp, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-md bg-card border-border text-foreground p-6 rounded-3xl space-y-4">
        {/* Header */}
        <DialogHeader className="pb-2 border-b border-border text-left">
          <DialogTitle className="text-base font-semibold text-foreground">
            Swap Assets
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. SELL CARD (USDG) */}
          <div className="rounded-2xl bg-muted/40 p-4 border border-border/50 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>You pay</span>
              <span>Available: {publicUsdg.toLocaleString()} USDG</span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <input
                type="number"
                step="any"
                placeholder="0.00"
                value={usdgAmount}
                onChange={(e) => setUsdgAmount(e.target.value)}
                className="w-full text-2xl font-bold bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
              />

              <div className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5 border border-border shadow-sm shrink-0">
                <div className="h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-xs">
                  $
                </div>
                <span className="text-xs font-semibold text-foreground">USDG</span>
              </div>
            </div>

            {/* Quick Percentage Pills */}
            <div className="flex items-center gap-1.5 pt-1">
              {[0.25, 0.5, 0.75, 1].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => handleApplyPercent(pct)}
                  className="px-2.5 py-1 text-[11px] font-medium rounded-full bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border transition-colors"
                >
                  {pct === 1 ? "Max" : `${pct * 100}%`}
                </button>
              ))}
            </div>
          </div>

          {/* Floating Swap Divider */}
          <div className="flex justify-center -my-2 relative z-10">
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-card border border-border shadow-md text-muted-foreground hover:text-foreground hover:scale-105 transition-all"
            >
              <ArrowDownUp className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* 2. BUY CARD (Equities / Tokens) */}
          <div className="rounded-2xl bg-muted/40 p-4 border border-border/50 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>You receive (est.)</span>
              <span>1 {targetEquity.symbol} ≈ ${targetEquity.price.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="text-2xl font-bold text-foreground">
                {estimatedShares}
              </div>

              {/* Token / Equity Selector */}
              <div className="relative shrink-0">
                <select
                  value={targetEquity.symbol}
                  onChange={(e) => {
                    const found = EQUITIES.find((item) => item.symbol === e.target.value);
                    if (found) setTargetEquity(found);
                  }}
                  className="appearance-none flex items-center gap-2 rounded-full bg-card pl-3 pr-8 py-1.5 border border-border shadow-sm text-xs font-semibold text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {EQUITIES.map((eq) => (
                    <option key={eq.symbol} value={eq.symbol}>
                      {eq.symbol} · {eq.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>

          {/* Route & Fee Breakdown */}
          <div className="rounded-xl bg-muted/30 p-3 space-y-1.5 text-xs text-muted-foreground border border-border/40">
            <div className="flex justify-between">
              <span>Execution Route</span>
              <span className="text-foreground font-medium">Robinhood Chain DEX</span>
            </div>
            <div className="flex justify-between">
              <span>Slippage Tolerance</span>
              <span className="text-foreground font-medium">0.5% auto</span>
            </div>
            <div className="flex justify-between">
              <span>Network Gas</span>
              <span className="text-emerald-500 font-medium">Sponsored by Veilora</span>
            </div>
          </div>

          {/* Submit Action */}
          <Button
            type="submit"
            disabled={loading || parsedUsdg <= 0}
            className="w-full h-11 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Simulating & Swapping...</span>
              </>
            ) : (
              <span>Authorize Swap</span>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
