import { useState } from "react";
import { ArrowLeft, ArrowUpRight, ChevronRight, UserCheck, Building2, Wallet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { QuorumIndicator } from "@/components/app/QuorumIndicator";

interface SendModalProps {
  open: boolean;
  onClose: () => void;
  publicUsdg: number;
  ethBalance: number;
  onSuccess: (details: string) => void;
}

const RECENT_CONTACTS = [
  {
    name: "Verified Vendor",
    tag: "Supplier",
    address: "0x9fE129B7Fca8406798031d6833c8b417eC0104b3",
    icon: Building2,
  },
  {
    name: "Payroll Distribution",
    tag: "Operations",
    address: "0x51c072bE892a0Fe861A721Ea648D4a18928A8A2d",
    icon: UserCheck,
  },
  {
    name: "Operational Reserve",
    tag: "Treasury",
    address: "0x7A3f9c2E41b8D05a6F1e3C27b94d0aE58c1FC91e",
    icon: Wallet,
  },
];

export function SendModal({
  open,
  onClose,
  publicUsdg,
  ethBalance,
  onSuccess,
}: SendModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [asset, setAsset] = useState<"USDG" | "ETH">("USDG");
  const [recipient, setRecipient] = useState("");
  const [recipientLabel, setRecipientLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const maxBalance = asset === "USDG" ? publicUsdg : ethBalance;
  const parsedAmount = parseFloat(amount) || 0;

  const handlePickContact = (contact: (typeof RECENT_CONTACTS)[0]) => {
    setRecipient(contact.address);
    setRecipientLabel(contact.name);
    setStep(2);
  };

  const handleContinueFromStep1 = () => {
    if (recipient.trim().length >= 10) {
      setStep(2);
    }
  };

  const handleContinueFromStep2 = () => {
    if (parsedAmount > 0 && parsedAmount <= maxBalance) {
      setStep(3);
    }
  };

  const handleSendTransaction = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onClose();
      setStep(1);
      setAmount("");
      setRecipient("");
      setRecipientLabel("");
      onSuccess(`Sent ${parsedAmount} ${asset} to ${recipient.slice(0, 8)}…${recipient.slice(-6)}`);
    }, 600);
  };

  const handleClose = () => {
    setStep(1);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
      <DialogContent className="sm:max-w-md bg-card border-border text-foreground p-6 rounded-3xl">
        {/* Header with Carousel Navigation */}
        <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-border text-left">
          <div className="flex items-center gap-2.5">
            {step > 1 ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
                className="h-8 w-8 rounded-full bg-muted text-foreground hover:bg-muted/80"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            )}
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                {step === 1 ? "Select Recipient" : step === 2 ? "Enter Amount" : "Review Transfer"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Step {step} of 3
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* STEP 1: Recipient Selection */}
        {step === 1 && (
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">
                Recipient Address or ENS
              </label>
              <Input
                type="text"
                placeholder="0x… or name.eth"
                value={recipient}
                onChange={(e) => {
                  setRecipient(e.target.value);
                  setRecipientLabel("");
                }}
                className="font-mono text-sm bg-muted/50 border-border h-11"
              />
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Recent Verified Contacts
              </p>
              <div className="space-y-1.5">
                {RECENT_CONTACTS.map((contact) => (
                  <button
                    key={contact.address}
                    type="button"
                    onClick={() => handlePickContact(contact)}
                    className="w-full flex items-center justify-between p-3 rounded-2xl bg-muted/40 hover:bg-muted border border-border/50 text-left transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <contact.icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                          {contact.name}
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/40">
                            {contact.tag}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-muted-foreground">
                          {contact.address.slice(0, 10)}…{contact.address.slice(-6)}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleContinueFromStep1}
              disabled={recipient.trim().length < 10}
              className="w-full h-11 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              Continue
            </Button>
          </div>
        )}

        {/* STEP 2: Amount & Asset Selection */}
        {step === 2 && (
          <div className="space-y-5 pt-2">
            <div className="flex rounded-full bg-muted/60 p-1 border border-border">
              <button
                type="button"
                onClick={() => setAsset("USDG")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-full transition-all ${
                  asset === "USDG"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                USDG (Public)
              </button>
              <button
                type="button"
                onClick={() => setAsset("ETH")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-full transition-all ${
                  asset === "ETH"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                ETH (Gas Reserve)
              </button>
            </div>

            <div className="text-center py-4 bg-muted/30 rounded-2xl border border-border/50">
              <span className="text-xs text-muted-foreground block mb-2">Amount to Send</span>
              <div className="flex items-center justify-center gap-2 px-4">
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="text-4xl font-bold text-foreground bg-transparent text-center focus:outline-none w-48 tracking-tight"
                  autoFocus
                />
                <span className="text-lg font-semibold text-muted-foreground">{asset}</span>
              </div>
              <div className="flex items-center justify-center gap-2 mt-3">
                <span className="text-xs text-muted-foreground">
                  Available: {maxBalance.toLocaleString()} {asset}
                </span>
                <button
                  type="button"
                  onClick={() => setAmount(String(maxBalance))}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  MAX
                </button>
              </div>
            </div>

            <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground flex items-center justify-between border border-border/40">
              <span>Sending to</span>
              <span className="font-mono text-foreground font-medium">
                {recipientLabel || `${recipient.slice(0, 8)}…${recipient.slice(-6)}`}
              </span>
            </div>

            <Button
              onClick={handleContinueFromStep2}
              disabled={parsedAmount <= 0 || parsedAmount > maxBalance}
              className="w-full h-11 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              {parsedAmount > maxBalance ? "Insufficient Balance" : "Review Transfer"}
            </Button>
          </div>
        )}

        {/* STEP 3: Review & Threshold Quorum Sign */}
        {step === 3 && (
          <div className="space-y-4 pt-2">
            <div className="p-4 rounded-2xl bg-muted/40 border border-border/50 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Amount</span>
                <span className="text-base font-bold text-foreground">
                  {parsedAmount} {asset}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">To</span>
                <span className="font-mono text-foreground font-medium">
                  {recipient.slice(0, 10)}…{recipient.slice(-6)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Network</span>
                <span className="text-foreground font-medium">Robinhood Chain</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Network Fee</span>
                <span className="text-emerald-500 font-medium">&lt; $0.001</span>
              </div>
            </div>

            {/* Threshold Quorum Signing Info */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/40 text-xs">
              <div className="flex items-center gap-2">
                <QuorumIndicator size="sm" />
                <span className="text-muted-foreground font-medium">2-of-3 Threshold Signing</span>
              </div>
              <span className="text-[11px] text-muted-foreground">Ready</span>
            </div>

            <Button
              onClick={handleSendTransaction}
              disabled={loading}
              className="w-full h-11 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Signing & Relaying...</span>
                </>
              ) : (
                <span>Authorize & Send</span>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
