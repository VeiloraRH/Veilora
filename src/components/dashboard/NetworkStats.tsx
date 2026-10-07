import { Link } from "@tanstack/react-router";
import { Activity, ShieldCheck, ArrowRight } from "lucide-react";

interface NetworkStatsProps {
  relayerInfo: {
    address: string;
    ready: boolean;
    gasPrice: string;
    blockNumber: string;
  };
  provenanceSet: {
    name: string;
    memberCount: string;
    freshness: string;
  };
}

export function NetworkStats({ relayerInfo, provenanceSet }: NetworkStatsProps) {
  return (
    <div className="panel p-6 bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-cream">Network & Oracles</h3>
          <p className="text-xs text-slate-500 dark:text-mist">Robinhood Chain telemetry</p>
        </div>
        <Link to="/app/network" className="text-xs text-[#eaba65] hover:underline font-medium flex items-center gap-1">
          <span>Relayer Status</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-ink-800 bg-slate-50 dark:bg-ink-950/60 p-3 text-xs">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-teal-500" />
            <span className="font-medium text-slate-700 dark:text-cream">Gas Price</span>
          </div>
          <span className="font-mono font-semibold text-slate-900 dark:text-gold-200">
            {relayerInfo.gasPrice}
          </span>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-ink-800 bg-slate-50 dark:bg-ink-950/60 p-3 text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#eaba65]" />
            <span className="font-medium text-slate-700 dark:text-cream">Block Height</span>
          </div>
          <span className="font-mono font-semibold text-slate-900 dark:text-cream">
            {relayerInfo.blockNumber}
          </span>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-ink-800 bg-slate-50 dark:bg-ink-950/60 p-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs text-blue-500">ZK</span>
            <span className="font-medium text-slate-700 dark:text-cream">Clean Oracle</span>
          </div>
          <span className="text-slate-500 dark:text-mist text-[11px]">
            {provenanceSet.memberCount} members
          </span>
        </div>
      </div>
    </div>
  );
}
