import { Plus } from "lucide-react";
import { Button } from "@/components/ui";

interface HoldingsListProps {
  publicUsdg: number;
  shieldedUsdg: number;
  ethBalance: number;
  onOpenShield: () => void;
  onOpenSwap: () => void;
  onOpenDeposit: () => void;
}

export function HoldingsList({
  publicUsdg,
  shieldedUsdg,
  ethBalance,
  onOpenShield,
  onOpenSwap,
  onOpenDeposit,
}: HoldingsListProps) {
  const ethValueUsd = ethBalance * 3000;
  const totalUsdg = publicUsdg + shieldedUsdg;

  const assets = [
    {
      symbol: "USDG",
      name: "Global Dollar",
      network: "Robinhood Chain",
      public: publicUsdg,
      shielded: shieldedUsdg,
      totalUsd: totalUsdg,
      iconText: "$",
      iconBg: "bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-300 border-teal-200 dark:border-teal-800",
      primaryAction: {
        label: "Shield",
        onClick: onOpenShield,
      },
    },
    {
      symbol: "ETH",
      name: "Native Gas",
      network: "Robinhood Chain",
      public: ethBalance,
      shielded: 0,
      totalUsd: ethValueUsd,
      iconText: "Ξ",
      iconBg: "bg-amber-50 dark:bg-amber-950/40 text-[#eaba65] border-amber-200 dark:border-amber-800",
      primaryAction: {
        label: "Top up",
        onClick: onOpenDeposit,
      },
    },
    {
      symbol: "NVDA",
      name: "NVIDIA Tokenized Equity",
      network: "Robinhood Chain",
      public: 0,
      shielded: 0,
      totalUsd: 0,
      iconText: "NV",
      iconBg: "bg-slate-100 dark:bg-ink-800 text-slate-700 dark:text-cream border-slate-200 dark:border-ink-700",
      primaryAction: {
        label: "Trade",
        onClick: onOpenSwap,
      },
    },
    {
      symbol: "AAPL",
      name: "Apple Tokenized Equity",
      network: "Robinhood Chain",
      public: 0,
      shielded: 0,
      totalUsd: 0,
      iconText: "AP",
      iconBg: "bg-slate-100 dark:bg-ink-800 text-slate-700 dark:text-cream border-slate-200 dark:border-ink-700",
      primaryAction: {
        label: "Trade",
        onClick: onOpenSwap,
      },
    },
  ];

  return (
    <div className="panel p-6 bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-cream">Holdings & Assets</h3>
          <p className="text-xs text-slate-500 dark:text-mist">Robinhood Chain verified balances</p>
        </div>
        <button
          type="button"
          onClick={onOpenDeposit}
          className="rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-850 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-cream hover:border-[#eaba65] transition-colors flex items-center gap-1"
        >
          <Plus className="h-3.5 w-3.5 text-[#eaba65]" />
          <span>Add Asset</span>
        </button>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-ink-800">
        {assets.map((asset) => (
          <div key={asset.symbol} className="py-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border font-semibold text-xs ${asset.iconBg}`}
              >
                {asset.iconText}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-cream truncate">
                  {asset.symbol}
                </p>
                <p className="text-xs text-slate-400 dark:text-mist truncate">
                  {asset.name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-900 dark:text-cream tabular-nums">
                  {asset.totalUsd.toLocaleString("en-US", { style: "currency", currency: "USD" })}
                </p>
                <div className="flex items-center justify-end gap-1.5 text-[11px] text-slate-500 dark:text-mist">
                  <span>Pub: {asset.public.toFixed(2)}</span>
                  {asset.shielded > 0 && (
                    <span className="text-teal-600 dark:text-teal-300">· Priv: {asset.shielded.toFixed(2)}</span>
                  )}
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={asset.primaryAction.onClick}
                className="text-xs px-3 py-1 rounded-xl border-slate-200 dark:border-ink-700 text-slate-700 dark:text-cream hover:border-[#eaba65]"
              >
                {asset.primaryAction.label}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
