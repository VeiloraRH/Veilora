import { useState } from "react";
import { Download, Copy, Check, ShieldAlert, KeyRound, Smartphone, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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

  if (!accountDetails) return null;

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
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent className="sm:max-w-xl bg-card border-border text-foreground p-6 rounded-3xl">
        <DialogHeader className="flex flex-row items-center gap-3 pb-3 border-b border-border text-left">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle className="text-xl font-semibold text-foreground">
              Back up your threshold keys
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Your 2-of-3 smart account requires any two shards to authorize transactions.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Shard A */}
          <div className="rounded-2xl border border-border bg-muted/40 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Smartphone className="h-4 w-4 text-emerald-500" />
                <span>Shard A — Primary Device Key</span>
              </div>
              <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium">
                Saved in browser
              </span>
            </div>
            <p className="text-muted-foreground">
              Saved automatically in your browser's local storage for 1-click signing.
            </p>
            {accountDetails.shardAPrivateKey && (
              <div className="flex items-center justify-between rounded-lg bg-card border border-border p-2">
                <span className="font-mono text-[11px] text-muted-foreground truncate max-w-[320px]">
                  {accountDetails.shardAPrivateKey.slice(0, 14)}…{accountDetails.shardAPrivateKey.slice(-10)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyKeyA}
                  className="h-7 text-xs text-primary"
                >
                  {copiedA ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                  {copiedA ? "Copied" : "Copy"}
                </Button>
              </div>
            )}
          </div>

          {/* Shard B */}
          <div className="rounded-2xl border border-border bg-muted/40 p-4 space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>Shard B — Veilora HSM Guardrail</span>
              </div>
              <span className="rounded-full bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-[10px] font-medium">
                Active Co-Signer
              </span>
            </div>
            <p className="text-muted-foreground">
              Secured on Robinhood Chain with autonomous policy safety checks.
            </p>
          </div>

          {/* Shard C */}
          <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <ShieldAlert className="h-4 w-4 text-primary" />
                <span>Shard C — Offline Recovery Key</span>
              </div>
              <span className="rounded-full bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 text-[10px] font-medium">
                Not stored online
              </span>
            </div>
            <p className="text-muted-foreground">
              This shard is never stored in browser storage. Download your recovery JSON file now.
            </p>

            <div className="flex items-center gap-2">
              <Button
                onClick={handleDownload}
                className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                {downloaded ? "Download Again" : "Download Recovery JSON"}
              </Button>
              {accountDetails.shardCPrivateKey && (
                <Button
                  variant="outline"
                  onClick={copyKeyC}
                  className="h-9 rounded-xl border-border text-foreground hover:bg-muted"
                >
                  {copiedC ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                  {copiedC ? "Copied" : "Copy Key"}
                </Button>
              )}
            </div>
          </div>

          {/* Checkbox */}
          <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-muted-foreground text-xs leading-normal">
              I have saved my Shard C recovery file. I understand Veilora cannot recover my account without 2-of-3 shards.
            </span>
          </label>
        </div>

        <DialogFooter className="pt-2 border-t border-border">
          <Button
            onClick={onConfirm}
            disabled={!confirmed || !downloaded}
            className="w-full h-11 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
          >
            Access Smart Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
