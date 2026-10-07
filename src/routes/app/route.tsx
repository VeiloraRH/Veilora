import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { WalletProvider, useWallet } from "@/lib/walletContext";
import { OnboardingScreen } from "@/components/dashboard/OnboardingScreen";

function AppRouteGate() {
  const { walletAddress } = useWallet();

  // If no wallet is configured, render the full-screen onboarding view (NO sidebar, NO header)
  if (!walletAddress) {
    return <OnboardingScreen />;
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
