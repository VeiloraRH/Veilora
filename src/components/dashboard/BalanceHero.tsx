import { ArrowDownLeft, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui";

interface BalanceHeroProps {
  totalValue: number;
  loading: boolean;
  onOpenDeposit: () => void;
  onOpenIntent: () => void;
}

export function BalanceHero({
  totalValue,
  loading,
  onOpenDeposit,
  onOpenIntent,
}: BalanceHeroProps) {
  return (
    <div className="panel p-6 sm:p-7 bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 shadow-sm flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-mist">Total Balance</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-teal-400/10 px-2 py-0.5 text-[11px] font-medium text-teal-600 dark:text-teal-300 border border-teal-400/20">
            <ShieldCheck className="h-3 w-3" />
            2-of-3 Active
          </span>
        </div>

        <div className="mt-3">
          <div className="flex items-baseline gap-2">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 dark:text-cream">
              {loading ? (
                <span className="opacity-40">Loading…</span>
              ) : (
                totalValue.toLocaleString("en-US", { style: "currency", currency: "USD" })
              )}
            </h1>
            <span className="text-xs text-slate-400 dark:text-mist font-medium">USD</span>
          </div>

          <p className="mt-1 text-xs text-slate-500 dark:text-mist">
            Robinhood Chain · Public + Shielded holdings
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
          Deposit Funds
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={onOpenIntent}
          className="text-xs px-4 py-2.5 rounded-xl border-slate-200 dark:border-ink-700 text-slate-700 dark:text-cream hover:bg-slate-50 dark:hover:bg-ink-800 flex items-center gap-1.5"
        >
          <Sparkles className="h-4 w-4 text-[#eaba65]" />
          Plan with AI
        </Button>
      </div>
    </div>
  );
}
