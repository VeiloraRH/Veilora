import { Eye, EyeOff, Fuel } from "lucide-react";

interface MetricsRowProps {
  publicUsdg: number;
  shieldedUsdg: number;
  ethBalance: number;
}

export function MetricsRow({ publicUsdg, shieldedUsdg, ethBalance }: MetricsRowProps) {
  const totalUsdg = publicUsdg + shieldedUsdg;
  const shieldedPct = totalUsdg > 0 ? Math.round((shieldedUsdg / totalUsdg) * 100) : 0;
  const publicPct = 100 - shieldedPct;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {/* Public Pool */}
      <div className="panel p-5 bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 shadow-sm">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-mist font-medium">
            <Eye className="h-3.5 w-3.5 text-coral-500" />
            <span>Public Pool</span>
          </div>
          <span className="rounded-full bg-coral-500/10 px-2 py-0.5 text-[11px] font-semibold text-coral-600 dark:text-coral-400">
            {publicPct}%
          </span>
        </div>
        <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-cream">
          {publicUsdg.toLocaleString("en-US", { style: "currency", currency: "USD" })}
        </p>
        <p className="mt-1 text-xs text-slate-400 dark:text-mist">
          Visible on Robinhood Chain explorer
        </p>
      </div>

      {/* Shielded Pool */}
      <div className="panel p-5 bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 shadow-sm">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-mist font-medium">
            <EyeOff className="h-3.5 w-3.5 text-teal-500" />
            <span>Shielded Pool</span>
          </div>
          <span className="rounded-full bg-teal-500/10 px-2 py-0.5 text-[11px] font-semibold text-teal-600 dark:text-teal-300">
            {shieldedPct}%
          </span>
        </div>
        <p className="mt-2 text-2xl font-semibold text-teal-600 dark:text-teal-300">
          {shieldedUsdg.toLocaleString("en-US", { style: "currency", currency: "USD" })}
        </p>
        <p className="mt-1 text-xs text-slate-400 dark:text-mist">
          Zero-knowledge Merkle notes
        </p>
      </div>

      {/* Gas Reserve */}
      <div className="panel p-5 bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 shadow-sm">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-mist font-medium">
            <Fuel className="h-3.5 w-3.5 text-[#eaba65]" />
            <span>Gas Reserve</span>
          </div>
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-gold-300">
            ETH
          </span>
        </div>
        <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-cream">
          {ethBalance.toFixed(4)} ETH
        </p>
        <p className="mt-1 text-xs text-slate-400 dark:text-mist">
          Robinhood Chain relayer gas balance
        </p>
      </div>
    </div>
  );
}
