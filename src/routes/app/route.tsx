import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { WalletProvider } from "@/lib/walletContext";

export const Route = createFileRoute("/app")({
  component: () => (
    <WalletProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </WalletProvider>
  ),
});
