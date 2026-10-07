import { useState, type ReactNode } from "react";
import { Link, useRouterState, type LinkProps } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  EyeOff,
  Inbox,
  KeyRound,
  Layers,
  LayoutDashboard,
  Menu,
  Network,
  ReceiptText,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMode } from "@/lib/mode";
import { useWallet } from "@/lib/walletContext";
import { NETWORK } from "@/demo/data";
import { Dot, Logo } from "@/components/ui";

type NavItem = { to: NonNullable<LinkProps["to"]>; label: string; icon: typeof Inbox; control?: boolean; count?: number };

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Plan",
    items: [
      { to: "/app", label: "Command Center", icon: LayoutDashboard },
      { to: "/app/intent", label: "Intent Console", icon: Sparkles },
      { to: "/app/outbox", label: "Outbox", icon: Inbox },
    ],
  },
  {
    group: "Move",
    items: [
      { to: "/app/privacy", label: "Shield & Unshield", icon: EyeOff },
      { to: "/app/move", label: "Send, Swap, Bridge", icon: ArrowLeftRight },
      { to: "/app/recipes", label: "Recipes", icon: Layers },
    ],
  },
  {
    group: "Control",
    items: [
      { to: "/app/policies", label: "Policies", icon: SlidersHorizontal },
      { to: "/app/disclosure", label: "Disclosure & Proofs", icon: KeyRound },
      { to: "/app/security", label: "Custody & Recovery", icon: ShieldCheck },
      { to: "/app/activity", label: "Receipts", icon: ReceiptText },
      { to: "/app/network", label: "Network", icon: Network, control: true },
    ],
  },
];

function ModeToggle() {
  const { mode, setMode } = useMode();
  return (
    <div className="inline-flex rounded-lg border border-ink-600 bg-ink-850 p-0.5 text-xs" role="group" aria-label="Visibility mode">
      {(["standard", "control"] as const).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          aria-pressed={mode === m}
          className={cn(
            "rounded-md px-3 py-1.5 capitalize transition-colors",
            mode === m ? "bg-gold-400 font-medium text-ink-900" : "text-mist hover:text-cream",
          )}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const { mode } = useMode();
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-6">
      {NAV.map((g) => (
        <div key={g.group}>
          <p className="mb-2 px-3 text-[10px] uppercase tracking-[0.28em] text-mist/70">{g.group}</p>
          <ul className="space-y-0.5">
            {g.items
              .filter((i) => !i.control || mode === "control")
              .map((i) => {
                const active = i.to === "/app" ? path === "/app" || path === "/app/" : path.startsWith(i.to);
                return (
                  <li key={i.to}>
                    <Link
                      to={i.to}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        active ? "bg-gold-400/10 text-gold-300" : "text-cream-dim hover:bg-ink-700/60 hover:text-cream",
                      )}
                    >
                      <i.icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{i.label}</span>
                      {i.count ? (
                        <span className="rounded-full bg-gold-400 px-1.5 text-[10px] font-semibold text-ink-900">{i.count}</span>
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

function VaultCard() {
  const { wallet, loading } = useWallet();
  const short = wallet?.address
    ? `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}`
    : loading
    ? "Connecting…"
    : "0x5e4a…b163";

  return (
    <div className="panel p-3.5 text-xs">
      <p className="font-medium text-cream">Veilora Smart Account</p>
      <p className="mt-0.5 font-mono text-mist">{short}</p>
      <div className="mt-3 flex items-center gap-2 text-mist">
        <Dot tone={wallet?.isFrozen ? "coral" : "teal"} />
        <span>{wallet?.isFrozen ? "Account frozen" : "2-of-3 quorum active"}</span>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { network } = useWallet();
  const blockDisplay = network?.blockNumber
    ? `#${Number(network.blockNumber).toLocaleString("en-US")}`
    : "#82,236,684";

  return (
    <div className="min-h-screen bg-ink-900 text-cream">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-ink-600/60 bg-ink-950/70 px-4 py-5 lg:flex">
        <Link to="/" className="mb-8 px-2">
          <Logo size={30} />
        </Link>
        <div className="flex-1 overflow-y-auto">
          <SideNav />
        </div>
        <VaultCard />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-ink-950/80" aria-label="Close menu" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-ink-600 bg-ink-900 px-4 py-5">
            <div className="mb-8 flex items-center justify-between px-2">
              <Logo size={28} />
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="text-mist hover:text-cream">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1">
              <SideNav onNavigate={() => setOpen(false)} />
            </div>
            <VaultCard />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-ink-600/60 bg-ink-900/85 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-8">
            <button className="text-mist hover:text-cream lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            <Link to="/" className="lg:hidden">
              <Logo size={26} wordmark={false} />
            </Link>
            <div className="hidden items-center gap-2 text-xs text-mist sm:flex">
              <Dot tone="teal" />
              <span>{NETWORK.name}</span>
              <span className="text-ink-500">|</span>
              <span className="font-mono">{blockDisplay}</span>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <ModeToggle />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1240px] px-4 py-8 sm:px-8 sm:py-10">{children}</main>
      </div>
    </div>
  );
}
