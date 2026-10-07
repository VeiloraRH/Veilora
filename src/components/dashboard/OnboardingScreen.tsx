import { useState } from "react";
import { EyeOff, Sparkles, Loader2, ArrowRight, KeyRound } from "lucide-react";
import { Button, Field, inputClass } from "@/components/ui";
import { useWallet, type CreatedAccountDetails } from "@/lib/walletContext";
import { KeyBackupModal } from "@/components/app/KeyBackupModal";

export function OnboardingScreen() {
  const { createAccount, setWalletAddress } = useWallet();
  const [loading, setLoading] = useState(false);
  const [createdDetails, setCreatedDetails] = useState<CreatedAccountDetails | null>(null);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [importMode, setImportMode] = useState(false);
  const [importAddr, setImportAddr] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await createAccount();
      setCreatedDetails(res);
      setShowBackupModal(true);
    } catch (err: any) {
      setError(err?.message || "Failed to generate smart account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = importAddr.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(clean)) {
      setError("Please enter a valid EVM address (0x...).");
      return;
    }
    setWalletAddress(clean);
  };

  const handleBackupConfirm = () => {
    setShowBackupModal(false);
  };

  return (
    <div className="mx-auto max-w-4xl py-6 sm:py-12 px-4">
      {/* Hero Welcome */}
      <div className="text-center space-y-4 mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-3 py-1 shadow-sm text-xs font-medium text-slate-700 dark:text-cream">
          <span className="h-2 w-2 rounded-full bg-[#eaba65]" />
          <span>Robinhood Chain Native</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-cream font-sans">
          Welcome to Veilora
        </h1>

        <p className="mx-auto max-w-xl text-sm sm:text-base text-slate-500 dark:text-mist leading-relaxed">
          Non-custodial smart accounts with zero-knowledge privacy. No seed phrase risks, no public transaction tracking.
        </p>

        {error && (
          <div className="mx-auto max-w-md rounded-xl border border-coral-500/30 bg-coral-500/10 p-3 text-xs text-coral-600 dark:text-coral-400">
            {error}
          </div>
        )}

        {/* CTA Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {!importMode ? (
            <>
              <Button
                type="button"
                disabled={loading}
                onClick={handleCreate}
                className="w-full sm:w-auto px-6 py-3 bg-[#eaba65] text-slate-950 hover:bg-[#d8a855] font-semibold text-sm rounded-xl shadow-sm flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Generating Keys…</span>
                  </>
                ) : (
                  <>
                    <span>Create Smart Account</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => setImportMode(true)}
                className="w-full sm:w-auto px-5 py-3 text-sm rounded-xl border-slate-200 dark:border-ink-700 text-slate-700 dark:text-cream hover:border-[#eaba65]"
              >
                Connect Existing Account
              </Button>
            </>
          ) : (
            <form onSubmit={handleImport} className="w-full max-w-md space-y-3">
              <Field label="Enter Existing Smart Account (0x…)">
                <input
                  type="text"
                  className={inputClass}
                  placeholder="0x…"
                  value={importAddr}
                  onChange={(e) => setImportAddr(e.target.value)}
                  autoFocus
                />
              </Field>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setImportMode(false)}
                  className="flex-1 text-xs py-2.5"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!/^0x[0-9a-fA-F]{40}$/.test(importAddr.trim())}
                  className="flex-1 bg-[#eaba65] text-slate-950 hover:bg-[#d8a855] text-xs py-2.5 font-semibold"
                >
                  Connect
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Feature Value Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-6">
        <div className="panel p-6 bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 shadow-sm rounded-2xl space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-gold-300 border border-amber-500/20">
            <KeyRound className="h-5 w-5 text-[#eaba65]" />
          </div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-cream">
            2-of-3 Threshold Custody
          </h2>
          <p className="text-xs text-slate-500 dark:text-mist leading-relaxed">
            Eliminates single point of failure seed phrases. Your device, policy co-signer, and recovery shard work together.
          </p>
        </div>

        <div className="panel p-6 bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 shadow-sm rounded-2xl space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-300 border border-teal-500/20">
            <EyeOff className="h-5 w-5" />
          </div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-cream">
            Shielded Privacy Pool
          </h2>
          <p className="text-xs text-slate-500 dark:text-mist leading-relaxed">
            Break public address links. Keep balances and transactions cryptographically concealed on Robinhood Chain.
          </p>
        </div>

        <div className="panel p-6 bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 shadow-sm rounded-2xl space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-500/20">
            <Sparkles className="h-5 w-5 text-blue-500" />
          </div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-cream">
            Intent Planning
          </h2>
          <p className="text-xs text-slate-500 dark:text-mist leading-relaxed">
            State your goals in natural language. Veilora simulates execution routes and enforces safety guardrails automatically.
          </p>
        </div>
      </div>

      <KeyBackupModal
        open={showBackupModal}
        accountDetails={createdDetails}
        onConfirm={handleBackupConfirm}
      />
    </div>
  );
}
