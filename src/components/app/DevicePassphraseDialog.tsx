import { useEffect, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { validateDevicePassphrase } from "@/lib/deviceKeyVault";

interface DevicePassphraseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (passphrase: string) => Promise<void>;
  busy?: boolean;
  title?: string;
  description?: string;
}

export function DevicePassphraseDialog({
  open,
  onOpenChange,
  onSubmit,
  busy = false,
  title = "Protect this device key",
  description = "Choose a passphrase to encrypt Shard A in this browser.",
}: DevicePassphraseDialogProps) {
  const [step, setStep] = useState<0 | 1>(0);
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStep(0);
      setPassphrase("");
      setConfirmation("");
      setShowPassphrase(false);
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (step === 0) {
      const validationError = validateDevicePassphrase(passphrase);
      if (validationError) {
        setError(validationError);
        return;
      }
      setStep(1);
      return;
    }
    if (confirmation !== passphrase) {
      setError("Those passphrases don’t match. Check them and try again.");
      return;
    }
    try {
      await onSubmit(passphrase);
      onOpenChange(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save the device key. Please try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl border-border bg-card p-6 text-foreground shadow-2xl">
        <DialogHeader className="text-left">
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            {step === 0 ? <KeyRound className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className={step === 0 ? "text-primary" : ""}>Create passphrase</span>
            <span>·</span>
            <span className={step === 1 ? "text-primary" : ""}>Confirm</span>
          </div>
          <DialogTitle className="pt-1 text-xl font-semibold">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="h-[166px] overflow-hidden rounded-2xl border border-border bg-muted/30 p-4">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step}
                initial={{ opacity: 0, x: step === 0 ? 18 : -18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: step === 0 ? -18 : 18 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="space-y-3"
              >
                {step === 0 ? (
                  <>
                    <label htmlFor="device-passphrase" className="text-sm font-medium">Create a passphrase</label>
                    <div className="relative">
                      <Input
                        id="device-passphrase"
                        type={showPassphrase ? "text" : "password"}
                        autoComplete="new-password"
                        autoFocus
                        value={passphrase}
                        onChange={(event) => setPassphrase(event.target.value)}
                        placeholder="At least 12 characters"
                        disabled={busy}
                        className="h-11 rounded-xl border-border bg-background pr-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassphrase((shown) => !shown)}
                        className="absolute inset-y-0 right-3 flex items-center text-muted-foreground transition-colors hover:text-foreground"
                        aria-label={showPassphrase ? "Hide passphrase" : "Show passphrase"}
                      >
                        {showPassphrase ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">It encrypts Shard A on this device. Veilora never receives or saves the passphrase.</p>
                  </>
                ) : (
                  <>
                    <label htmlFor="device-passphrase-confirm" className="text-sm font-medium">Confirm your passphrase</label>
                    <Input
                      id="device-passphrase-confirm"
                      type={showPassphrase ? "text" : "password"}
                      autoComplete="new-password"
                      autoFocus
                      value={confirmation}
                      onChange={(event) => setConfirmation(event.target.value)}
                      placeholder="Enter it again"
                      disabled={busy}
                      className="h-11 rounded-xl border-border bg-background"
                    />
                    <p className="text-xs leading-relaxed text-muted-foreground">Keep it somewhere you can access. You’ll need it to unlock Shard A in this browser.</p>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="min-h-5 text-sm text-destructive" aria-live="polite">{error}</div>

          <DialogFooter className="flex-row justify-between gap-2 sm:justify-between sm:space-x-0">
            {step === 1 ? (
              <motion.div whileTap={{ scale: 0.96 }} transition={{ type: "spring", stiffness: 450, damping: 18 }}>
                <Button type="button" variant="outline" disabled={busy} onClick={() => { setError(null); setStep(0); }} className="h-10 rounded-xl px-4">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
              </motion.div>
            ) : <span />}
            <motion.div whileTap={{ scale: 0.96 }} transition={{ type: "spring", stiffness: 450, damping: 18 }}>
              <Button type="submit" disabled={busy} className="h-10 rounded-xl px-5 shadow-sm">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : step === 0 ? <ArrowRight className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                {busy ? "Encrypting…" : step === 0 ? "Continue" : "Save device key"}
              </Button>
            </motion.div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
