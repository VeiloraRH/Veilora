import { useState } from "react";
import { ArrowDownLeft, Eye, EyeOff, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui";
import { QuorumIndicator } from "@/components/app/QuorumIndicator";

interface BalanceHeroProps {
  totalValue: number;
  loading: boolean;
  onOpenDeposit: () => void;
}

export function BalanceHero({
  totalValue,
  loading,
  onOpenDeposit,
}: BalanceHeroProps) {
  const [hideBalance, setHideBalance] = useState(false);

  return (
    <div className="panel p-6 sm:p-7 bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 shadow-sm flex flex-col justify-between h-full rounded-2xl">
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-mist">
            <span>Portfolio Balance</span>
            <button
              type="button"
              onClick={() => setHideBalance((h) => !h)}
              className="text-slate-400 hover:text-slate-700 dark:text-mist dark:hover:text-cream transition-colors p-0.5"
              title={hideBalance ? "Show balance" : "Hide balance"}
              aria-label={hideBalance ? "Show balance" : "Hide balance"}
            >
              {hideBalance ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>

          {/* 3-Dot Triangular Quorum Indicator replacing badge */}
          <QuorumIndicator />
        </div>

        <div className="mt-3">
          <div className="flex items-baseline gap-2">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-cream font-sans">
              {loading ? (
                <span className="opacity-40">Loading…</span>
              ) : hideBalance ? (
                <span>••••••</span>
              ) : (
                totalValue.toLocaleString("en-US", { style: "currency", currency: "USD" })
              )}
            </h1>
            {!hideBalance && (
              <span className="text-xs text-slate-400 dark:text-mist font-medium">USD</span>
            )}
          </div>

          <p className="mt-1 text-xs text-slate-400 dark:text-mist">
            Robinhood Chain · Public & Shielded
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2.5">
        <Button
          type="button"
          onClick={onOpenDeposit}
          className="bg-[#eaba65] hover:bg-[#d8a855] text-slate-950 font-semibold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm"
        >
          <ArrowDownLeft className="h-4 w-4" />
          <span>Deposit</span>
        </Button>

        <Link to="/app/intent">
          <Button
            type="button"
            variant="outline"
            className="text-xs px-4 py-2.5 rounded-xl border-slate-200 dark:border-ink-700 text-slate-700 dark:text-cream hover:bg-slate-50 dark:hover:bg-ink-800 flex items-center gap-1.5"
          >
            <Sparkles className="h-4 w-4 text-[#eaba65]" />
            <span>AI Intent</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}
