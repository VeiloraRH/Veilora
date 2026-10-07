import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Copy, EyeOff, KeyRound, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui";

interface VaultCardsProps {
  walletAddress: string;
  publicUsdg: number;
  shieldedUsdg: number;
  onOpenShield: () => void;
}

export function VaultCards({
  walletAddress,
  publicUsdg,
  shieldedUsdg,
  onOpenShield,
}: VaultCardsProps) {
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formattedAddr = walletAddress
    ? `${walletAddress.slice(0, 6)} •••• •••• ${walletAddress.slice(-4)}`
    : "0x0000 •••• •••• 0000";

  return (
    <div className="panel p-6 bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-cream">My Vaults</h3>
        <Link to="/app/security" className="text-xs text-[#eaba65] hover:underline font-medium">
          Manage Keys
        </Link>
      </div>

      {/* Card 1: Public Robinhood Chain Smart Account */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 p-5 text-white shadow-md">
        <div className="absolute right-0 top-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-white/10 blur-xl pointer-events-none" />

        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-blue-200">Robinhood Chain Account</span>
          <span className="text-xs font-bold tracking-widest text-amber-300">VEILORA</span>
        </div>

        <div className="mt-4">
          <p className="text-xs text-blue-200">Public Balance</p>
          <p className="text-2xl font-semibold tracking-tight text-white">
            {publicUsdg.toLocaleString("en-US", { style: "currency", currency: "USD" })}
          </p>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <span className="font-mono text-xs text-blue-100">{formattedAddr}</span>
          <button
            type="button"
            onClick={copyAddress}
            className="rounded-lg bg-white/15 px-2 py-1 text-[11px] font-medium text-white hover:bg-white/25 transition-colors flex items-center gap-1"
          >
            {copied ? <Check className="h-3 w-3 text-teal-300" /> : <Copy className="h-3 w-3" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>

      {/* Card 2: Shielded Zero-Knowledge Vault Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-ink-950 p-5 text-white border border-slate-800 shadow-md">
        <div className="absolute right-0 top-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-teal-500/10 blur-xl pointer-events-none" />

        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-teal-300 flex items-center gap-1.5">
            <EyeOff className="h-3.5 w-3.5" />
            Shielded Privacy Pool
          </span>
          <span className="rounded-full bg-teal-500/20 px-2 py-0.5 text-[10px] font-semibold text-teal-300 border border-teal-500/30">
            ZK-Notes
          </span>
        </div>

        <div className="mt-4">
          <p className="text-xs text-slate-400">Shielded Holdings</p>
          <p className="text-2xl font-semibold tracking-tight text-teal-300">
            {shieldedUsdg.toLocaleString("en-US", { style: "currency", currency: "USD" })}
          </p>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <span className="text-xs text-slate-400">Cryptographically Blinded</span>
          <button
            type="button"
            onClick={onOpenShield}
            className="rounded-lg bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 px-2.5 py-1 text-xs font-medium text-teal-300 transition-colors flex items-center gap-1"
          >
            <span>Shield USDG</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      <Link to="/app/security" className="block pt-1">
        <Button
          type="button"
          variant="outline"
          className="w-full text-xs py-2 rounded-xl border-slate-200 dark:border-ink-700 text-slate-700 dark:text-cream flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-ink-850"
        >
          <KeyRound className="h-3.5 w-3.5 text-[#eaba65]" />
          <span>Manage 2-of-3 Custody Keys</span>
        </Button>
      </Link>
    </div>
  );
}
