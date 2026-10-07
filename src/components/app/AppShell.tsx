import { useState, type ReactNode } from "react";
import { Link, useRouterState, type LinkProps } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  EyeOff,
  Inbox,
  KeyRound,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Network,
  ReceiptText,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { useWallet } from "@/lib/walletContext";
import { NETWORK } from "@/demo/data";
import { Dot, Logo } from "@/components/ui";
import { OnboardingModal } from "./OnboardingModal";
import { RemoveWalletModal } from "./RemoveWalletModal";

type NavItem = { to: NonNullable<LinkProps["to"]>; label: string; icon: typeof Inbox; control?: boolean; count?: number };

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Main Menu",
    items: [
      { to: "/app", label: "Dashboard", icon: LayoutDashboard },
      { to: "/app/intent", label: "Intent Console", icon: Sparkles },
      { to: "/app/outbox", label: "Outbox Queue", icon: Inbox },
    ],
  },
  {
    group: "Move & Privacy",
    items: [
      { to: "/app/privacy", label: "Shielded Pool", icon: EyeOff },
      { to: "/app/move", label: "Send & Swap", icon: ArrowLeftRight },
      { to: "/app/recipes", label: "Recipes", icon: Layers },
    ],
  },
  {
    group: "Control & Security",
    items: [
      { to: "/app/policies", label: "Policies", icon: SlidersHorizontal },
      { to: "/app/disclosure", label: "Proofs & View Keys", icon: KeyRound },
      { to: "/app/security", label: "Custody & Recovery", icon: ShieldCheck },
      { to: "/app/activity", label: "Receipts", icon: ReceiptText },
      { to: "/app/network", label: "Network Health", icon: Network, control: true },
    ],
  },
];

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex w-full items-center justify-between rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-cream transition-colors hover:border-[#eaba65]"
      aria-label="Toggle dark mode"
    >
      <div className="flex items-center gap-2">
        {theme === "dark" ? <Moon className="h-4 w-4 text-[#eaba65]" /> : <Sun className="h-4 w-4 text-[#eaba65]" />}
        <span>Dark Mode</span>
      </div>
      <div className={`h-4 w-8 rounded-full p-0.5 transition-colors ${theme === "dark" ? "bg-[#eaba65]" : "bg-slate-300 dark:bg-ink-700"}`}>
        <div className={`h-3 w-3 rounded-full bg-white transition-transform ${theme === "dark" ? "translate-x-4" : ""}`} />
      </div>
    </button>
  );
}

import { QuorumIndicator } from "./QuorumIndicator";

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-6">
      {NAV.map((g) => (
        <div key={g.group}>
          <p className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-slate-400 dark:text-mist/70 uppercase">{g.group}</p>
          <ul className="space-y-0.5">
            {g.items.map((i) => {
              const active = i.to === "/app" ? path === "/app" || path === "/app/" : path.startsWith(i.to);
                return (
                  <li key={i.to}>
                    <Link
                      to={i.to}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium transition-colors",
                        active
                          ? "bg-[#eaba65]/15 text-slate-900 dark:text-cream font-semibold border-l-2 border-[#eaba65]"
                          : "text-slate-600 dark:text-cream-dim hover:bg-slate-100 dark:hover:bg-ink-800 hover:text-slate-900 dark:hover:text-cream",
                      )}
                    >
                      <i.icon className="h-4 w-4 shrink-0 text-[#eaba65]" />
                      <span className="flex-1">{i.label}</span>
                      {i.count ? (
                        <span className="rounded-full bg-[#eaba65] px-1.5 text-[10px] font-semibold text-slate-950">{i.count}</span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function VaultCard({
  onOpenOnboarding,
  onOpenDisconnect,
}: {
  onOpenOnboarding?: () => void;
  onOpenDisconnect?: () => void;
}) {
  const { wallet, loading } = useWallet();
  const short = wallet?.address
    ? `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}`
    : loading
    ? "Connecting…"
    : "No account connected";

  return (
    <div className="panel p-3.5 text-xs bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-slate-900 dark:text-cream">Veilora Account</p>
        <div className="flex items-center gap-2">
          {onOpenOnboarding && (
            <button
              onClick={onOpenOnboarding}
              className="text-[11px] font-medium text-[#eaba65] hover:underline"
            >
              Setup
            </button>
          )}
          {wallet?.address && onOpenDisconnect && (
            <button
              onClick={onOpenDisconnect}
              className="text-slate-400 hover:text-coral-500 transition-colors"
              title="Disconnect account"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <p className="mt-0.5 font-mono text-slate-500 dark:text-mist">{short}</p>
      <div className="mt-2.5 flex items-center justify-between text-slate-500 dark:text-mist text-[11px]">
        <div className="flex items-center gap-1.5">
          <Dot tone={wallet?.isFrozen ? "coral" : "teal"} />
          <span>{wallet?.isFrozen ? "Frozen" : "Robinhood Chain"}</span>
        </div>
        <QuorumIndicator deviceKeyPresent={Boolean(wallet?.address)} />
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(() => {
    return typeof window !== "undefined" && localStorage.getItem("veilora:onboarded") !== "true";
  });
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { network, wallet, removeWallet } = useWallet();

  const blockDisplay = network?.blockNumber
    ? `#${Number(network.blockNumber).toLocaleString("en-US")}`
    : "#82,236,684";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-ink-900 text-slate-900 dark:text-cream transition-colors duration-150">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-950/80 px-4 py-5 lg:flex shadow-sm">
        <Link to="/" className="mb-6 px-2">
          <Logo size={30} />
        </Link>
        <div className="flex-1 overflow-y-auto">
          <SideNav />
        </div>
        <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-ink-800">
          <VaultCard
            onOpenOnboarding={() => setOnboardingOpen(true)}
            onOpenDisconnect={() => setDisconnectOpen(true)}
          />
          <ThemeToggle />
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-slate-900/60 dark:bg-ink-950/80" aria-label="Close menu" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-4 py-5 shadow-2xl">
            <div className="mb-6 flex items-center justify-between px-2">
              <Logo size={28} />
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="text-slate-400 hover:text-slate-700 dark:text-mist dark:hover:text-cream">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1">
              <SideNav onNavigate={() => setOpen(false)} />
            </div>
            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-ink-800">
              <VaultCard
                onOpenOnboarding={() => setOnboardingOpen(true)}
                onOpenDisconnect={() => setDisconnectOpen(true)}
              />
              <ThemeToggle />
            </div>
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200 dark:border-ink-700 bg-white/90 dark:bg-ink-900/90 backdrop-blur shadow-xs">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-8">
            <button className="text-slate-500 hover:text-slate-800 dark:text-mist dark:hover:text-cream lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            <Link to="/" className="lg:hidden">
              <Logo size={26} wordmark={false} />
            </Link>
            <div className="hidden items-center gap-2 text-xs text-slate-500 dark:text-mist sm:flex">
              <Dot tone="teal" />
              <span>{NETWORK.name}</span>
              <span className="text-slate-300 dark:text-ink-600">|</span>
              <span className="font-mono">{blockDisplay}</span>
            </div>
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <QuorumIndicator deviceKeyPresent={Boolean(wallet?.address)} />
              <button
                type="button"
                onClick={toggleTheme}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-850 text-slate-600 dark:text-cream hover:border-[#eaba65] transition-colors"
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                aria-label="Toggle theme"
              >
                {theme === "dark" ? <Sun className="h-4 w-4 text-[#eaba65]" /> : <Moon className="h-4 w-4 text-slate-600" />}
              </button>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1240px] px-4 py-8 sm:px-8 sm:py-10">{children}</main>
      </div>

      <OnboardingModal
        open={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
      />

      <RemoveWalletModal
        open={disconnectOpen}
        onClose={() => setDisconnectOpen(false)}
        onConfirm={removeWallet}
        walletAddress={wallet?.address || ""}
      />
    </div>
  );
}
