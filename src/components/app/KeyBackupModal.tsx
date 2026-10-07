import { useState } from "react";
import { Download, Copy, Check, ShieldAlert, KeyRound, Smartphone, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui";
import { downloadRecoveryBackup, type CreatedAccountDetails } from "@/lib/walletContext";

interface KeyBackupModalProps {
  open: boolean;
  accountDetails: CreatedAccountDetails | null;
  onConfirm: () => void;
}

export function KeyBackupModal({ open, accountDetails, onConfirm }: KeyBackupModalProps) {
  const [downloaded, setDownloaded] = useState(false);
  const [copiedC, setCopiedC] = useState(false);
  const [copiedA, setCopiedA] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  if (!open || !accountDetails) return null;

  const handleDownload = () => {
    downloadRecoveryBackup({
      smartAccount: accountDetails.address,
      shardA: accountDetails.shardA,
      shardB: accountDetails.shardB,
      shardC: accountDetails.shardC,
      shardCPrivateKey: accountDetails.shardCPrivateKey || "",
    });
    setDownloaded(true);
  };

  const copyKeyC = () => {
    if (accountDetails.shardCPrivateKey) {
      navigator.clipboard.writeText(accountDetails.shardCPrivateKey);
      setCopiedC(true);
      setTimeout(() => setCopiedC(false), 2000);
    }
  };

  const copyKeyA = () => {
    if (accountDetails.shardAPrivateKey) {
      navigator.clipboard.writeText(accountDetails.shardAPrivateKey);
      setCopiedA(true);
      setTimeout(() => setCopiedA(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 dark:bg-ink-950/90 backdrop-blur-md" />

      {/* Modal Dialog */}
      <div className="panel relative z-10 w-full max-w-xl overflow-hidden border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 shadow-2xl">
        <div className="border-b border-slate-100 dark:border-ink-800 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-400/10 text-amber-600 dark:text-gold-300 border border-gold-400/20">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-cream">Back up your threshold keys</h2>
              <p className="text-xs text-slate-500 dark:text-mist mt-0.5">
                Veilora accounts use 2-of-3 threshold keys. You hold 2 keys; Veilora holds 1.
              </p>
            </div>
          </div>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-6 py-6 space-y-6">
          {/* Shard A — Device Key */}
          <div className="rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-850/60 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-teal-600 dark:text-teal-300" />
                <span className="text-sm font-semibold text-slate-900 dark:text-cream">Device Key (Shard A)</span>
              </div>
              <span className="text-[11px] font-medium text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-400/10 px-2 py-0.5 rounded-full border border-teal-200 dark:border-teal-400/20">
                Stored in this browser
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-mist">
              Used automatically by this device to sign your daily intents.
            </p>
            {accountDetails.shardAPrivateKey && (
              <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-950/70 px-3 py-2">
                <span className="font-mono text-xs text-slate-800 dark:text-cream-dim truncate max-w-[320px]">
                  {accountDetails.shardAPrivateKey.slice(0, 14)}••••••••••••••••••••••••••••••••{accountDetails.shardAPrivateKey.slice(-6)}
                </span>
                <button
                  type="button"
                  onClick={copyKeyA}
                  className="flex items-center gap-1 text-xs text-[#eaba65] hover:underline"
                >
                  {copiedA ? <Check className="h-3.5 w-3.5 text-teal-500 dark:text-teal-300" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedA ? "Copied" : "Copy"}</span>
                </button>
              </div>
            )}
          </div>

          {/* Shard C — Recovery Shard */}
          <div className="rounded-xl border border-amber-300 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="text-sm font-semibold text-slate-900 dark:text-cream">Recovery Key (Shard C)</span>
              </div>
              <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-400/20">
                Offline Backup Only
              </span>
            </div>

            <p className="mt-2 text-xs leading-relaxed text-slate-700 dark:text-cream-dim">
              <strong>Crucial:</strong> To keep your funds strictly non-custodial, this key is <strong>not stored</strong> in your browser or on our servers. You must save it now. If you lose this device, you will need Shard C and the Veilora co-signer to recover your funds.
            </p>

            {accountDetails.shardCPrivateKey ? (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between rounded-lg border border-amber-200 dark:border-ink-700 bg-white dark:bg-ink-950/90 px-3 py-2">
                  <span className="font-mono text-xs text-amber-900 dark:text-gold-200 truncate max-w-[320px]">
                    {accountDetails.shardCPrivateKey}
                  </span>
                  <button
                    type="button"
                    onClick={copyKeyC}
                    className="flex items-center gap-1 text-xs text-[#eaba65] hover:underline shrink-0"
                  >
                    {copiedC ? <Check className="h-3.5 w-3.5 text-teal-500 dark:text-teal-300" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedC ? "Copied" : "Copy"}</span>
                  </button>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDownload}
                  className="w-full flex items-center justify-center gap-2 text-xs py-2 border-amber-400/50 text-amber-800 dark:text-gold-300 hover:bg-amber-100 dark:hover:bg-gold-400/10"
                >
                  <Download className="h-4 w-4" />
                  {downloaded ? "Download Again (.json)" : "Download Recovery File (.json)"}
                </Button>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500 dark:text-mist">
                Key address: <span className="font-mono text-slate-900 dark:text-cream">{accountDetails.shardC}</span>
              </p>
            )}
          </div>

          {/* Shard B — Explainer */}
          <div className="rounded-xl border border-slate-200 dark:border-ink-700/40 bg-slate-50 dark:bg-ink-900/60 p-3 text-xs text-slate-600 dark:text-mist">
            <span className="text-slate-900 dark:text-cream font-semibold">Veilora Co-Signer (Shard B): </span>
            Maintained in the Veilora safety hardware. It only signs transactions that comply with your spending guardrails and zero-knowledge privacy rules.
          </div>

          {/* Confirmation Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-ink-600 bg-white dark:bg-ink-950 text-[#eaba65] focus:ring-0 focus:ring-offset-0"
            />
            <span className="text-xs text-slate-700 dark:text-cream-dim leading-snug">
              I have saved my Recovery Key (Shard C) and understand that Veilora cannot restore my funds if both this device and Shard C are lost.
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 dark:border-ink-800 px-6 py-4 flex items-center justify-between bg-slate-50/60 dark:bg-ink-950/40">
          <p className="text-xs text-slate-500 dark:text-mist">
            {confirmed ? "Ready to enter your dashboard" : "Confirm backup to continue"}
          </p>
          <Button
            type="button"
            disabled={!confirmed}
            onClick={onConfirm}
            className="flex items-center gap-2 bg-[#eaba65] text-slate-950 hover:bg-[#d8a855] font-semibold"
          >
            <CheckCircle2 className="h-4 w-4" />
            Enter Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
