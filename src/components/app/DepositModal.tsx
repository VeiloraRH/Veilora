import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DepositModalProps {
  open: boolean;
  onClose: () => void;
  accountAddress: string;
}

export function DepositModal({ open, onClose, accountAddress }: DepositModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (accountAddress) {
      QRCode.toDataURL(accountAddress, {
        margin: 2,
        width: 260,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch(() => undefined);
    }
  }, [accountAddress]);

  const copyAddress = () => {
    navigator.clipboard.writeText(accountAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-sm bg-card border-border text-foreground p-6 rounded-3xl text-center space-y-4">
        <DialogHeader className="text-center">
          <DialogTitle className="text-base font-semibold text-center text-foreground">
            Deposit USDG
          </DialogTitle>
        </DialogHeader>

        {/* Network Pill */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-amber-700 dark:text-gold-300 mx-auto">
          <span className="h-2 w-2 rounded-full bg-[#eaba65]" />
          <span>Robinhood Chain</span>
        </div>

        {/* QR Code */}
        <div className="mx-auto flex h-52 w-52 items-center justify-center rounded-2xl bg-white p-3 border border-slate-200 shadow-sm">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Deposit QR Code" className="h-full w-full object-contain" />
          ) : (
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#eaba65] border-t-transparent" />
          )}
        </div>

        {/* Short Instruction */}
        <p className="text-xs text-muted-foreground">
          Send USDG or ETH to your Robinhood Chain smart account address
        </p>

        {/* Address Pill */}
        <div className="rounded-xl bg-muted/60 px-3 py-2 text-xs font-mono text-muted-foreground break-all select-all border border-border">
          {accountAddress}
        </div>

        {/* Action Button */}
        <Button
          onClick={copyAddress}
          className="w-full h-11 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center justify-center gap-2 shadow-sm"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>Copied address</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              <span>Copy address</span>
            </>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
