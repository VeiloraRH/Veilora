import { useState } from "react";
import { AlertTriangle, LogOut, X } from "lucide-react";
import { Button } from "@/components/ui";

interface RemoveWalletModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  walletAddress: string;
}

export function RemoveWalletModal({
  open,
  onClose,
  onConfirm,
  walletAddress,
}: RemoveWalletModalProps) {
  const [confirmed, setConfirmed] = useState(false);

  if (!open) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 dark:bg-ink-950/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="panel relative z-10 w-full max-w-md overflow-hidden bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 shadow-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-ink-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-coral-500/10 text-coral-500 border border-coral-500/20">
              <LogOut className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-cream">Disconnect Wallet</h2>
              <p className="text-xs text-slate-500 dark:text-mist">Remove account from this device</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:text-mist dark:hover:text-cream transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="py-5 space-y-4 text-xs text-slate-600 dark:text-cream-dim leading-relaxed">
          <p>
            You are disconnecting the following Veilora smart account from this browser:
          </p>

          <div className="rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950/70 p-3 font-mono text-slate-900 dark:text-gold-200 break-all">
            {walletAddress || "No active account"}
          </div>

          <div className="rounded-xl border border-coral-500/20 bg-coral-500/5 p-3.5 space-y-1.5 text-coral-600 dark:text-coral-400">
            <div className="flex items-center gap-1.5 font-medium">
              <AlertTriangle className="h-4 w-4" />
              <span>Important Security Notice</span>
            </div>
            <p className="text-[11px] leading-normal">
              This will remove your local <strong>Device Key (Shard A)</strong> and active session from this browser. Your on-chain funds remain intact. Ensure you have your <strong>Recovery Key (Shard C)</strong> or Shard A key backed up before proceeding.
            </p>
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-coral-500 focus:ring-0"
            />
            <span className="text-slate-600 dark:text-mist text-xs">
              I have saved my keys and wish to remove this wallet from this browser.
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-ink-800">
          <Button type="button" variant="outline" onClick={onClose} className="text-xs">
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!confirmed}
            onClick={handleConfirm}
            className="bg-coral-500 hover:bg-coral-600 text-white border-transparent text-xs"
          >
            Disconnect Wallet
          </Button>
        </div>
      </div>
    </div>
  );
}
