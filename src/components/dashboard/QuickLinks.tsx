import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, EyeOff, Sparkles } from "lucide-react";

interface QuickLinksProps {
  onOpenDeposit: () => void;
  onOpenShield: () => void;
  onOpenSend: () => void;
  onOpenSwap: () => void;
  onOpenIntent: () => void;
}

export function QuickLinks({
  onOpenDeposit,
  onOpenShield,
  onOpenSend,
  onOpenSwap,
  onOpenIntent,
}: QuickLinksProps) {
  const links = [
    {
      label: "Deposit",
      icon: ArrowDownLeft,
      onClick: onOpenDeposit,
      iconColor: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900/40",
    },
    {
      label: "Shield",
      icon: EyeOff,
      onClick: onOpenShield,
      iconColor: "text-teal-500",
      bgColor: "bg-teal-50 dark:bg-teal-950/30 border-teal-100 dark:border-teal-900/40",
    },
    {
      label: "Send",
      icon: ArrowUpRight,
      onClick: onOpenSend,
      iconColor: "text-amber-500",
      bgColor: "bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/40",
    },
    {
      label: "Swap",
      icon: ArrowLeftRight,
      onClick: onOpenSwap,
      iconColor: "text-indigo-500",
      bgColor: "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-100 dark:border-indigo-900/40",
    },
    {
      label: "Intent",
      icon: Sparkles,
      onClick: onOpenIntent,
      iconColor: "text-[#eaba65]",
      bgColor: "bg-amber-50/60 dark:bg-amber-950/20 border-[#eaba65]/20",
    },
  ];

  return (
    <div className="panel p-6 sm:p-7 bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 shadow-sm flex flex-col justify-between h-full">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-cream">Quick Actions</h3>
        <span className="text-xs text-slate-400 dark:text-mist">Threshold-guarded</span>
      </div>

      <div className="mt-4 grid grid-cols-5 gap-2 sm:gap-3">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <button
              key={link.label}
              type="button"
              onClick={link.onClick}
              className="flex flex-col items-center gap-2 rounded-2xl p-2.5 sm:p-3 hover:bg-slate-50 dark:hover:bg-ink-850 transition-all group"
            >
              <div
                className={`flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl border ${link.bgColor} transition-transform group-hover:scale-105 shadow-sm`}
              >
                <Icon className={`h-5 w-5 ${link.iconColor}`} />
              </div>
              <span className="text-xs font-medium text-slate-600 dark:text-cream-dim group-hover:text-slate-900 dark:group-hover:text-cream">
                {link.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
