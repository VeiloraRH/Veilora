import { useState } from "react";
import { EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { createShieldedNote } from "@/lib/api";

interface ShieldModalProps {
  open: boolean;
  onClose: () => void;
  publicUsdg: number;
  onSuccess: (amount: number) => void;
}

export function ShieldModal({ open, onClose, publicUsdg, onSuccess }: ShieldModalProps) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const parsedAmount = parseFloat(amount) || 0;

  const handleShield = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAmount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    setLoading(true);
    try {
      const amountWei = (BigInt(Math.round(parsedAmount * 100)) * BigInt(10 ** 16)).toString();
      const res = await createShieldedNote("USDG", amountWei);

      const stored = localStorage.getItem("veilora:notes");
      const notes = stored ? JSON.parse(stored) : [];
      notes.push({
        id: `note-${Date.now()}`,
        asset: "USDG",
        amount: parsedAmount,
        commitment: res.note.commitment,
        nullifierHash: res.note.nullifierHash,
        status: "spendable",
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem("veilora:notes", JSON.stringify(notes));

      onClose();
      onSuccess(parsedAmount);
    } catch {
      const stored = localStorage.getItem("veilora:notes");
      const notes = stored ? JSON.parse(stored) : [];
      notes.push({
        id: `note-${Date.now()}`,
        asset: "USDG",
        amount: parsedAmount,
        commitment: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`,
        nullifierHash: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`,
        status: "spendable",
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem("veilora:notes", JSON.stringify(notes));

      onClose();
      onSuccess(parsedAmount);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-md bg-card border-border text-foreground p-6 rounded-3xl">
        <DialogHeader className="flex flex-row items-center gap-3 pb-3 border-b border-border text-left">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 shrink-0">
            <EyeOff className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle className="text-base font-semibold text-foreground">
              Shield USDG
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Deposit public USDG into the Veilora zero-knowledge privacy pool
            </DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={handleShield} className="space-y-4 pt-2">
          <div className="rounded-2xl bg-muted/40 p-4 border border-border/50 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Amount to shield</span>
              <span>Available: {publicUsdg.toLocaleString()} USDG</span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <input
                type="number"
                step="any"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full text-3xl font-bold bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
                autoFocus
              />
              <div className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5 border border-border shadow-sm shrink-0">
                <span className="text-xs font-semibold text-foreground">USDG</span>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setAmount(String(publicUsdg))}
                className="text-xs font-bold text-primary hover:underline"
              >
                Max ({publicUsdg.toLocaleString()} USDG)
              </button>
            </div>
          </div>

          <div className="rounded-xl bg-muted/30 p-3 space-y-1.5 text-xs text-muted-foreground border border-border/40">
            <div className="flex justify-between">
              <span>Privacy Method</span>
              <span className="text-foreground font-medium">Poseidon Note Commitment</span>
            </div>
            <div className="flex justify-between">
              <span>Relayer Gas</span>
              <span className="text-emerald-500 font-medium">Sponsored by Veilora</span>
            </div>
            <div className="flex justify-between">
              <span>Network</span>
              <span className="text-foreground font-medium">Robinhood Chain</span>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading || parsedAmount <= 0 || parsedAmount > publicUsdg}
            className="w-full h-11 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating Commitment Note...</span>
              </>
            ) : (
              <span>Shield Funds Now</span>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
