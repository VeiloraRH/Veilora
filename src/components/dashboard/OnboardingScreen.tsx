import { useState } from "react";
import {
  Clock,
  Globe,
  Loader2,
  Shield,
  PiggyBank,
  Star,
  CheckCircle2,
  KeyRound,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useWallet, downloadRecoveryBackup, type CreatedAccountDetails } from "@/lib/walletContext";

function LaurelWreath({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 32 64"
      className={`h-11 w-6 text-slate-500/60 ${flip ? "-scale-x-100" : ""}`}
      fill="currentColor"
    >
      <path d="M16 2 C15 7, 10 12, 5 15 C1 18, 0 23, 0 30 C0 38, 2 44, 7 48 C12 52, 15 58, 16 62 C16 62, 13 55, 9 51 C5 47, 3 41, 3 33 C3 25, 5 19, 9 14 C13 10, 16 2, 16 2 Z" />
      <path
        d="M23 8 C21 13, 17 17, 13 19 C10 21, 9 24, 9 29 C9 34, 11 38, 14 41 C18 44, 21 49, 23 54 C23 54, 20 48, 16 44 C13 41, 12 36, 12 30 C12 24, 14 20, 17 16 C20 12, 23 8, 23 8 Z"
        opacity="0.8"
      />
      <path
        d="M29 16 C27 20, 24 23, 21 25 C19 27, 18 30, 18 33 C18 37, 19 40, 22 43 C25 46, 27 50, 29 53 C29 53, 26 49, 23 45 C21 42, 20 38, 20 34 C20 30, 21 27, 23 24 C26 20, 29 16, 29 16 Z"
        opacity="0.6"
      />
    </svg>
  );
}

function CoinUSDG({ className }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center rounded-full ${className}`}>
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-2xl">
        <defs>
          <radialGradient id="coinGrad1" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="45%" stopColor="#d5dbe6" />
            <stop offset="85%" stopColor="#8d99ae" />
            <stop offset="100%" stopColor="#556075" />
          </radialGradient>
          <linearGradient id="innerBevel1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#64748b" stopOpacity="0.8" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#coinGrad1)" stroke="#ffffff" strokeWidth="1.5" />
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="url(#innerBevel1)"
          strokeWidth="2.5"
          strokeDasharray="4 2"
        />
        <circle cx="50" cy="50" r="34" fill="#a0abbd" fillOpacity="0.25" />
        <text
          x="50"
          y="62"
          textAnchor="middle"
          fontSize="36"
          fontWeight="bold"
          fill="#334155"
          fontFamily="system-ui"
        >
          $
        </text>
      </svg>
    </div>
  );
}

function CoinWaves({ className }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center rounded-full ${className}`}>
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-2xl">
        <defs>
          <radialGradient id="coinGrad2" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="50%" stopColor="#c8d1e0" />
            <stop offset="90%" stopColor="#7e8b9e" />
            <stop offset="100%" stopColor="#4a5568" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#coinGrad2)" stroke="#ffffff" strokeWidth="1.5" />
        <circle cx="50" cy="50" r="40" fill="none" stroke="#64748b" strokeWidth="2" />
        <rect x="25" y="34" width="50" height="7" rx="3.5" fill="#334155" />
        <rect x="25" y="47" width="50" height="7" rx="3.5" fill="#334155" />
        <rect x="25" y="60" width="50" height="7" rx="3.5" fill="#334155" />
      </svg>
    </div>
  );
}

export function OnboardingScreen() {
  const { createAccount, setWalletAddress } = useWallet();
  const [loading, setLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importAddr, setImportAddr] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  // Success backup modal state
  const [backupOpen, setBackupOpen] = useState(false);
  const [createdDetails, setCreatedDetails] = useState<CreatedAccountDetails | null>(null);
  const [hasDownloaded, setHasDownloaded] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const res = await createAccount();
      setCreatedDetails(res);
      // Auto-trigger the recovery backup download
      downloadRecoveryBackup({
        smartAccount: res.address,
        shardA: res.shardA,
        shardB: res.shardB,
        shardC: res.shardC,
        shardCPrivateKey: res.shardCPrivateKey || "",
      });
      setHasDownloaded(true);
      setBackupOpen(true);
    } catch (err: any) {
      alert(err?.message || "Failed to create smart account");
    } finally {
      setLoading(false);
    }
  };

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = importAddr.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(clean)) {
      setImportError("Please enter a valid Robinhood Chain address (0x...)");
      return;
    }
    setImportError(null);
    setWalletAddress(clean);
    setImportOpen(false);
  };

  return (
    <div className="min-h-screen w-full bg-[#070c18] flex items-center justify-center p-3 sm:p-6 lg:p-8">
      {/* 2-Column Split Container */}
      <div className="w-full max-w-7xl min-h-[640px] lg:min-h-[720px] grid grid-cols-1 lg:grid-cols-2 rounded-[32px] overflow-hidden bg-[#091021] border border-white/5 shadow-2xl">
        {/* ================= LEFT COLUMN: HERO & ACTIONS ================= */}
        <div className="flex flex-col justify-between p-8 sm:p-12 lg:p-16 text-white bg-[#091021]">
          {/* Top Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/brand/veilora-mark.png"
                alt="Veilora"
                className="h-9 w-9 object-contain"
              />
              <span className="font-brand text-3xl font-semibold tracking-wide text-white">
                Veilora
              </span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-slate-300">
              <Globe className="h-3.5 w-3.5 text-[#eaba65]" />
              <span>Robinhood Chain</span>
            </div>
          </div>

          {/* Central Content */}
          <div className="my-auto py-12 max-w-md mx-auto w-full text-center flex flex-col items-center">
            <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-extrabold tracking-tight text-white leading-[1.12]">
              All-in-one Robinhood smart wallet
            </h1>

            <p className="mt-4 text-base sm:text-lg text-slate-400 font-normal">
              Safe. Simple. Yours.
            </p>

            {/* Action Buttons */}
            <div className="w-full space-y-3.5 mt-10 max-w-[380px]">
              <Button
                onClick={handleCreate}
                disabled={loading}
                className="w-full h-14 rounded-full bg-[#eaba65] hover:bg-[#dfaf58] text-[#070d1e] font-semibold text-lg shadow-xl shadow-[#eaba65]/20 transition-all hover:scale-[1.01] active:scale-[0.99] border-0"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Generating threshold keys...
                  </>
                ) : (
                  "Get started"
                )}
              </Button>

              <Button
                variant="outline"
                onClick={() => setImportOpen(true)}
                disabled={loading}
                className="w-full h-14 rounded-full bg-[#142039]/90 hover:bg-[#1a2b4d] text-white border-white/10 font-medium text-lg transition-colors"
              >
                Import existing wallet
              </Button>
            </div>

            {/* Subtext with Clock */}
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mt-4">
              <Clock className="h-3.5 w-3.5" />
              <span>It takes less than a minute</span>
            </div>
          </div>

          {/* Bottom Social Proof / Trust Bar */}
          <div className="pt-8 border-t border-white/5 flex items-center justify-around text-center">
            <div className="flex items-center gap-3">
              <LaurelWreath />
              <div className="text-left">
                <div className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  $20B+
                </div>
                <div className="text-xs text-slate-400">Held in assets by 4M users</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-left">
                <div className="flex items-center gap-1.5 text-xl sm:text-2xl font-bold text-white tracking-tight">
                  <Star className="h-4 w-4 fill-[#eaba65] text-[#eaba65]" />
                  <span>4.84</span>
                </div>
                <div className="text-xs text-slate-400">Best rated wallet in stores</div>
              </div>
              <LaurelWreath flip />
            </div>
          </div>
        </div>

        {/* ================= RIGHT COLUMN: VIBRANT SHOWCASE ================= */}
        <div className="relative bg-[#eaba65] rounded-3xl m-3 p-8 lg:p-12 overflow-hidden flex flex-col justify-between items-center select-none min-h-[520px]">
          {/* Top Row: Gothic Mark & Story Progress Bars */}
          <div className="w-full flex items-center justify-between z-20">
            <div className="font-serif font-black text-3xl sm:text-4xl text-black/90 tracking-tighter">
              𝔙
            </div>

            <div className="flex items-center gap-2">
              <div className="h-1 w-14 sm:w-16 rounded-full bg-black/90" />
              <div className="h-1 w-14 sm:w-16 rounded-full bg-black/25" />
              <div className="h-1 w-14 sm:w-16 rounded-full bg-black/25" />
              <div className="h-1 w-14 sm:w-16 rounded-full bg-black/25" />
            </div>
          </div>

          {/* Center Showcase: Floating Wallet Card & 3D Coins */}
          <div className="relative my-auto flex items-center justify-center w-full">
            {/* Background Floating Coins */}
            <CoinUSDG className="w-16 h-16 sm:w-20 sm:h-20 absolute -top-12 right-6 z-10 rotate-12" />
            <CoinWaves className="w-14 h-14 sm:w-16 sm:h-16 absolute top-1/2 -left-6 -translate-y-16 z-10 -rotate-6" />
            <CoinWaves className="w-12 h-12 absolute -bottom-10 left-12 z-10 rotate-45" />

            {/* Depth blurred coin bottom-right */}
            <div className="w-24 h-24 sm:w-28 sm:h-28 absolute -bottom-16 -right-10 z-10 opacity-70 blur-[1.5px] rotate-12 pointer-events-none">
              <CoinUSDG className="w-full h-full" />
            </div>

            {/* Distant blurred coin top-center */}
            <div className="w-12 h-12 absolute -top-14 left-1/3 z-0 opacity-40 blur-[2px] pointer-events-none">
              <CoinUSDG className="w-full h-full" />
            </div>

            {/* MAIN FLOATING SMART WALLET CARD */}
            <div className="w-[300px] sm:w-[330px] rounded-2xl bg-[#0c142b] p-5 text-white shadow-2xl border border-white/10 relative z-20">
              {/* Floating Shield Badge Top-Right */}
              <div className="absolute -top-3 -right-3 z-30 flex h-9 w-9 items-center justify-center rounded-xl bg-[#4c6ef5] text-white shadow-lg">
                <Shield className="h-5 w-5 fill-white text-[#4c6ef5]" />
              </div>

              {/* Floating Piggy Badge Bottom-Left */}
              <div className="absolute -bottom-3 -left-3 z-30 flex h-9 w-9 items-center justify-center rounded-xl bg-[#f783ac] text-white shadow-lg">
                <PiggyBank className="h-5 w-5 text-white" />
              </div>

              {/* Card Header */}
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-6 rounded-full bg-slate-700/80" />
                <span className="text-xs text-slate-400 font-medium">Your Wallet</span>
              </div>

              {/* Main Balance Display */}
              <div className="space-y-0.5 mb-4">
                <div className="text-3xl font-extrabold tracking-tight text-white">
                  $24,058.32
                </div>
                <div className="text-xs font-semibold text-emerald-400">
                  +$4,600.74
                </div>
              </div>

              {/* Asset List Rows */}
              <div className="space-y-2">
                {/* Asset 1: Solana / USDG */}
                <div className="flex items-center justify-between rounded-xl bg-[#142039]/80 p-2.5 border border-white/5">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-300">
                      $
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">USDG</div>
                      <div className="text-[10px] text-emerald-400 font-medium">+12.24%</div>
                    </div>
                  </div>
                  <div className="h-2 w-12 rounded-full bg-slate-700/60" />
                </div>

                {/* Asset 2: USD Coin */}
                <div className="flex items-center justify-between rounded-xl bg-[#142039]/80 p-2.5 border border-white/5">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-300">
                      RH
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">USD Coin</div>
                      <div className="text-[10px] text-slate-400 font-medium">0.00%</div>
                    </div>
                  </div>
                  <div className="h-2 w-12 rounded-full bg-slate-700/60" />
                </div>

                {/* Asset 3: AAPLx / NVDA */}
                <div className="flex items-center justify-between rounded-xl bg-[#142039]/80 p-2.5 border border-white/5">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xs font-bold text-amber-300">
                      NV
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">AAPLx / NVDA</div>
                      <div className="text-[10px] text-emerald-400 font-medium">+1.25%</div>
                    </div>
                  </div>
                  <div className="h-2 w-12 rounded-full bg-slate-700/60" />
                </div>
              </div>
            </div>

            {/* Edge-on Small Coin Tilted In Front */}
            <div className="absolute top-[58%] right-[14%] z-30 w-7 h-14 bg-gradient-to-r from-slate-200 via-slate-400 to-slate-600 rounded-full shadow-2xl rotate-12 border border-white/40" />
          </div>

          {/* Bottom Space Balancer */}
          <div className="h-6" />
        </div>
      </div>

      {/* ================= IMPORT WALLET DIALOG (shadcn) ================= */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-md bg-[#0c142b] border-[#263a5e] text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">
              Import Existing Smart Account
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-sm">
              Enter your counterfactual smart account address on Robinhood Chain.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleImportSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300">
                Account Address (0x...)
              </label>
              <Input
                type="text"
                placeholder="0x9412...5a45"
                value={importAddr}
                onChange={(e) => setImportAddr(e.target.value)}
                className="bg-[#101a33] border-[#263a5e] text-white placeholder:text-slate-500 font-mono text-sm"
              />
              {importError && (
                <p className="text-xs text-rose-400 font-medium">{importError}</p>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setImportOpen(false)}
                className="border-[#263a5e] bg-transparent text-white hover:bg-white/5"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-[#eaba65] text-[#070d1e] hover:bg-[#dfaf58] font-semibold"
              >
                Connect Account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= RECOVERY BACKUP DIALOG (shadcn) ================= */}
      <Dialog open={backupOpen} onOpenChange={setBackupOpen}>
        <DialogContent className="sm:max-w-lg bg-[#0c142b] border-[#263a5e] text-white">
          <DialogHeader>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eaba65]/10 text-[#eaba65] border border-[#eaba65]/20 mb-2">
              <KeyRound className="h-6 w-6" />
            </div>
            <DialogTitle className="text-xl font-bold text-white">
              Smart Account Created Successfully
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-sm">
              Your 2-of-3 threshold smart account is ready on Robinhood Chain.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div className="rounded-xl bg-[#101a33] border border-[#263a5e] p-4 space-y-2">
              <div className="text-xs text-slate-400 font-medium">Smart Account Address</div>
              <div className="font-mono text-xs text-[#eaba65] break-all select-all">
                {createdDetails?.address}
              </div>
            </div>

            <div className="rounded-xl bg-[#142039]/60 border border-white/5 p-4 space-y-2 text-xs text-slate-300 leading-relaxed">
              <div className="flex items-center gap-2 font-semibold text-white">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Shard A (Device Key)
              </div>
              <p className="text-slate-400">
                Encrypted and saved directly in this browser's local storage.
              </p>

              <div className="flex items-center gap-2 font-semibold text-white pt-2">
                <Download className="h-4 w-4 text-[#eaba65]" />
                Shard C (Recovery Key JSON)
              </div>
              <p className="text-slate-400">
                {hasDownloaded
                  ? "Your recovery JSON backup file was automatically saved to your Downloads folder."
                  : "Keep your recovery file safe in an offline vault."}
              </p>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              onClick={() => setBackupOpen(false)}
              className="w-full bg-[#eaba65] text-[#070d1e] hover:bg-[#dfaf58] font-semibold h-11"
            >
              Continue to Dashboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
