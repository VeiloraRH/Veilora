import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Check, X } from "lucide-react";
import { Button } from "@/components/ui";

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

  if (!open) return null;

  const copyAddress = () => {
    navigator.clipboard.writeText(accountAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 dark:bg-ink-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog matching deposit-inspo.png */}
      <div className="panel relative z-10 w-full max-w-sm overflow-hidden border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 shadow-2xl p-6 rounded-3xl text-center space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="w-7" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-cream">
            Deposit USDG
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 dark:bg-ink-800 text-slate-400 hover:text-slate-700 dark:text-mist dark:hover:text-cream transition-colors"
            aria-label="Close deposit"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Network Pill */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-850 px-3 py-1 text-xs font-medium text-slate-700 dark:text-cream shadow-xs">
            <span className="h-2 w-2 rounded-full bg-[#eaba65]" />
            <span>Robinhood Chain</span>
          </div>
        </div>

        {/* Centered QR Container */}
        <div className="flex justify-center py-1">
          <div className="rounded-3xl border border-slate-100 dark:border-ink-700/60 bg-white p-4 shadow-sm">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR code for ${accountAddress}`}
                className="h-48 w-48 rounded-xl block"
              />
            ) : (
              <div className="h-48 w-48 flex items-center justify-center text-xs text-slate-500 font-mono">
                Generating QR…
              </div>
            )}
          </div>
        </div>

        {/* Single Instruction line */}
        <div className="space-y-1">
          <p className="text-xs text-slate-500 dark:text-mist">
            Only deposit USDG or ETH via the Robinhood Chain network
          </p>
          <p className="font-mono text-[11px] text-slate-400 dark:text-mist truncate px-2">
            {accountAddress}
          </p>
        </div>

        {/* Action Button */}
        <div>
          <Button
            type="button"
            onClick={copyAddress}
            className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-cream dark:text-slate-950 dark:hover:bg-cream/90 text-white font-medium text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald-400" />
                <span>Address Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>Copy address</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
