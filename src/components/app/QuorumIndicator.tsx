import { useState } from "react";

interface QuorumIndicatorProps {
  deviceKeyPresent?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function QuorumIndicator({ deviceKeyPresent = true, size = "md", className = "" }: QuorumIndicatorProps) {
  const isSm = size === "sm";
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
      tabIndex={0}
      role="status"
      aria-label="2-of-3 threshold quorum status"
    >
      {/* 3 Triangular / Cluster Dots */}
      <div className={`flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-850 ${isSm ? "px-1.5 py-0.5" : "px-2 py-1"} cursor-pointer transition-colors hover:border-[#eaba65]`}>
        {/* Triangular dot cluster */}
        <div className="relative h-3.5 w-3.5 flex items-center justify-center">
          {/* Top dot: Shard A (Device Key) */}
          <span
            className={`absolute top-0 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full ${
              deviceKeyPresent ? "bg-emerald-500" : "bg-coral-500"
            }`}
          />
          {/* Bottom Left dot: Shard B (Co-Signer) */}
          <span className="absolute bottom-0 left-0 h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {/* Bottom Right dot: Shard C (Recovery Shard) */}
          <span className="absolute bottom-0 right-0 h-1.5 w-1.5 rounded-full bg-amber-400" />
        </div>
        <span className="text-[11px] font-mono text-slate-600 dark:text-cream/90 font-medium">
          2/3
        </span>
      </div>

      {/* Floating Explanatory Tooltip on Hover */}
      {showTooltip && (
        <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-xl border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-3 shadow-xl text-left pointer-events-none transition-all">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-ink-800">
            <span className="text-xs font-semibold text-slate-900 dark:text-cream">
              Threshold Quorum
            </span>
            <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
              Ready
            </span>
          </div>

          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-mist">
                <span className={`h-1.5 w-1.5 rounded-full ${deviceKeyPresent ? "bg-emerald-500" : "bg-coral-500"}`} />
                Shard A (Device)
              </span>
              <span className="font-mono text-slate-900 dark:text-cream font-medium">
                {deviceKeyPresent ? "Active" : "Missing"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-mist">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Shard B (Co-Signer)
              </span>
              <span className="font-mono text-slate-900 dark:text-cream font-medium">
                Active
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-mist">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                Shard C (Recovery)
              </span>
              <span className="font-mono text-slate-500 dark:text-mist">
                Standby
              </span>
            </div>
          </div>

          <p className="mt-2.5 pt-2 border-t border-slate-100 dark:border-ink-800 text-[10px] text-slate-400 dark:text-mist">
            Any 2 of 3 shards authorize transfers. Single keys cannot move funds.
          </p>
        </div>
      )}
    </div>
  );
}
