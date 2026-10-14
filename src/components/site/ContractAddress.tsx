import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";

export const CONTRACT_ADDRESS = "0xbfe3e08e96ffa81563bd26be1d5ad31dd1dad1fe";
const DEXSCREENER_URL = `https://dexscreener.com/robinhood/${CONTRACT_ADDRESS}`;

export function ContractAddress({ className = "" }: { className?: string }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(CONTRACT_ADDRESS);
      setCopied(true);
      setCopyFailed(false);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopyFailed(true);
      setCopied(false);
    }
  }

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${className}`}>
      <code className="break-all font-mono text-xs">{CONTRACT_ADDRESS}</code>
      <button
        type="button"
        onClick={() => void copyAddress()}
        aria-label="Copy contract address"
        className="inline-flex shrink-0 items-center gap-1.5 text-xs transition-colors hover:text-gold-300"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
      <a
        href={DEXSCREENER_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex shrink-0 items-center gap-1.5 text-xs transition-colors hover:text-gold-300"
      >
        Dexscreener <ExternalLink className="h-3.5 w-3.5" />
      </a>
      {copyFailed && <span role="status" className="basis-full text-xs text-coral-400">Copy failed. Select the address to copy it manually.</span>}
    </div>
  );
}
