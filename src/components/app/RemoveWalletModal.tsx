import { useState } from "react";
import { AlertTriangle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

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

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-md bg-card border-border text-foreground p-6 rounded-3xl">
        <DialogHeader className="flex flex-row items-center gap-3 pb-3 border-b border-border text-left">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive border border-destructive/20 shrink-0">
            <LogOut className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle className="text-base font-semibold text-foreground">
              Disconnect Wallet
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Remove account from this device
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="py-3 space-y-3 text-xs text-muted-foreground leading-relaxed">
          <p>
            You are disconnecting the following Veilora smart account from this browser:
          </p>

          <div className="rounded-xl border border-border bg-muted/50 p-3 font-mono text-foreground break-all">
            {walletAddress || "No active account"}
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-800 dark:text-amber-200 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>Ensure you have your recovery key</span>
            </div>
            <p className="text-[11px]">
              Disconnecting clears your local device key (Shard A). To regain access later, you will need your Shard C recovery file.
            </p>
          </div>

          <label className="flex items-start gap-2 pt-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-xs text-foreground">
              I have saved my offline recovery file and wish to disconnect.
            </span>
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-border bg-transparent text-foreground hover:bg-muted"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!confirmed}
            onClick={handleConfirm}
            className="font-semibold"
          >
            Disconnect Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
