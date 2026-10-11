import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { WalletProvider, useWallet } from "@/lib/walletContext";
import { OnboardingScreen } from "@/components/dashboard/OnboardingScreen";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function AppRouteGate() {
  const { walletAddress, deviceKeyPresent, deviceKeyUnlocked, unlockDeviceKey } = useWallet();
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  // If no wallet is configured, render the full-screen onboarding view (NO sidebar, NO header)
  if (!walletAddress) {
    return <OnboardingScreen />;
  }

  if (deviceKeyPresent && !deviceKeyUnlocked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8f9fc] p-6 dark:bg-[#070c18]">
        <form className="w-full max-w-md space-y-5 rounded-3xl border border-slate-200 bg-white p-7 shadow-xl dark:border-ink-700 dark:bg-ink-900" onSubmit={async (event) => {
          event.preventDefault();
          setUnlocking(true);
          setError(null);
          try {
            await unlockDeviceKey(passphrase);
            setPassphrase("");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not unlock the device key.");
          } finally {
            setUnlocking(false);
          }
        }}>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-cream">Unlock your device key</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-mist">Shard A is encrypted on this device. Enter its passphrase to unlock it in memory.</p>
          </div>
          <Input type="password" autoComplete="current-password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} placeholder="Device-key passphrase" aria-label="Device-key passphrase" required />
          {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
          <Button className="w-full" disabled={unlocking || !passphrase}>{unlocking ? "Unlocking…" : "Unlock"}</Button>
          <p className="text-xs text-slate-500 dark:text-mist">If this browser had an older unencrypted key, successful unlock encrypts it and removes the plaintext copy.</p>
        </form>
      </main>
    );
  }

  // Once a wallet is active, render the full AppShell with sidebar and subroutes
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export const Route = createFileRoute("/app")({
  component: () => (
    <WalletProvider>
      <AppRouteGate />
    </WalletProvider>
  ),
});
