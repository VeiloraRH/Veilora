import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Check, X, ShieldCheck, ArrowDownLeft } from "lucide-react";
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
        width: 240,
        color: {
          dark: "#0c142b",
          light: "#f4ead8",
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
      <div className="fixed inset-0 bg-ink-950/85 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="panel relative z-10 w-full max-w-md overflow-hidden border border-ink-600 bg-ink-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-700/80 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-400/10 text-gold-300 border border-gold-400/20">
              <ArrowDownLeft className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-cream">Deposit to Smart Account</h2>
              <p className="text-xs text-mist">Robinhood Chain</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-mist hover:bg-ink-800 hover:text-cream transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-6 flex flex-col items-center text-center">
          {/* QR Code Container */}
          <div className="rounded-2xl bg-cream p-3 shadow-lg border-2 border-gold-400/30">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR code for ${accountAddress}`}
                className="h-44 w-44 rounded-lg block"
              />
            ) : (
              <div className="h-44 w-44 flex items-center justify-center text-xs text-ink-900 font-medium">
                Loading QR Code…
              </div>
            )}
          </div>

          <p className="mt-4 text-xs text-mist">
            Scan with your wallet or copy the smart account address below:
          </p>

          {/* Address Box */}
          <div className="mt-3 w-full flex items-center justify-between rounded-xl border border-ink-600 bg-ink-950/80 p-3">
            <span className="font-mono text-xs text-gold-200 truncate pr-2">
              {accountAddress}
            </span>
            <button
              type="button"
              onClick={copyAddress}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-ink-800 px-3 py-1.5 text-xs font-medium text-cream hover:bg-ink-700 hover:text-gold-200 transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-teal-300" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>

          {/* Asset & Security Note */}
          <div className="mt-5 w-full rounded-xl border border-ink-700/60 bg-ink-850/50 p-3.5 text-left text-xs space-y-2">
            <div className="flex items-center gap-2 text-cream font-medium">
              <ShieldCheck className="h-4 w-4 text-teal-300" />
              <span>Protected by 2-of-3 threshold keys</span>
            </div>
            <p className="text-mist leading-relaxed">
              Deposits are credited directly to your counterfactual smart account. You can send <strong>USDG</strong> (Global Dollar) or <strong>ETH</strong> (for gas fees). Once deposited, USDG can be shielded into the privacy pool at any time.
            </p>
          </div>
        </div>

        <div className="border-t border-ink-700/80 px-6 py-4 flex justify-end bg-ink-950/40">
          <Button type="button" onClick={onClose} variant="outline" className="text-xs">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
