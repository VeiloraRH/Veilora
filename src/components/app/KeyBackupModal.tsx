import { useState } from "react";
import { ShieldAlert, KeyRound, Smartphone, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { CreatedAccountDetails } from "@/lib/walletContext";

interface KeyBackupModalProps {
  open: boolean;
  accountDetails: CreatedAccountDetails | null;
  onConfirm: () => void;
}

export function KeyBackupModal({ open, accountDetails, onConfirm }: KeyBackupModalProps) {
  const [confirmed, setConfirmed] = useState(false);

  if (!accountDetails) return null;

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
                Encrypted on device
              </span>
            </div>
            <p className="text-muted-foreground">
              Encrypted with your device-key passphrase before being saved in this browser.
            </p>
            {accountDetails.shardAPrivateKey && (
              <div className="flex items-center justify-between rounded-lg bg-card border border-border p-2">
                <span className="font-mono text-[11px] text-muted-foreground truncate max-w-[320px]">
                  {accountDetails.shardAPrivateKey.slice(0, 14)}…{accountDetails.shardAPrivateKey.slice(-10)}
                </span>
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
              This shard is shown only during setup. Write it on paper and keep it offline; Veilora will not save or download it.
            </p>
            <div className="rounded-lg border border-primary/25 bg-card p-3 font-mono text-xs leading-6 break-all select-all text-foreground">
              {accountDetails.shardCPrivateKey}
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
              I wrote down Shard C and stored it offline. I understand Veilora cannot recover my account without 2-of-3 shards.
            </span>
          </label>
        </div>

        <DialogFooter className="pt-2 border-t border-border">
          <Button
            onClick={onConfirm}
            disabled={!confirmed}
            className="w-full h-11 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
          >
            I wrote it down · Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
