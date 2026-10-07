import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, Check, QrCode, LogOut } from "lucide-react";
import { getOnChainBalances, getProvenanceSets, getRelayerStatus } from "@/lib/api";
import { StatusModal } from "@/components/ui";
import { useWallet } from "@/lib/walletContext";

// Modular Dashboard Components
import { BalanceHero } from "@/components/dashboard/BalanceHero";
import { QuickLinks } from "@/components/dashboard/QuickLinks";
import { MetricsRow } from "@/components/dashboard/MetricsRow";
import { VaultCards } from "@/components/dashboard/VaultCards";
import { HoldingsList } from "@/components/dashboard/HoldingsList";
import { ActivityQueue } from "@/components/dashboard/ActivityQueue";
import { NetworkStats } from "@/components/dashboard/NetworkStats";
import { OnboardingScreen } from "@/components/dashboard/OnboardingScreen";

// Interaction Modals (Zero inline forms)
import { DepositModal } from "@/components/app/DepositModal";
import { ShieldModal } from "@/components/dashboard/ShieldModal";
import { SendModal } from "@/components/dashboard/SendModal";
import { SwapModal } from "@/components/dashboard/SwapModal";
import { RemoveWalletModal } from "@/components/app/RemoveWalletModal";

export const Route = createFileRoute("/app/")({
  component: CommandCenter,
});

export function CommandCenter() {
  const { wallet, auditTrail, removeWallet } = useWallet();

  // Balance & On-chain states
  const [balances, setBalances] = useState<{ eth: number; usdg: number }>({ eth: 0, usdg: 0 });
  const [loadingBalances, setLoadingBalances] = useState(true);
  const [shieldedUsdg, setShieldedUsdg] = useState<number>(0);
  const [copiedAddr, setCopiedAddr] = useState(false);

  // Interaction Modal States
  const [depositOpen, setDepositOpen] = useState(false);
  const [shieldOpen, setShieldOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [removeWalletOpen, setRemoveWalletOpen] = useState(false);

  // Global Status Feedback Modal
  const [statusModal, setStatusModal] = useState<{
    open: boolean;
    type: "success" | "error" | "info";
    title: string;
    message: string;
    details?: string;
  }>({
    open: false,
    type: "info",
    title: "",
    message: "",
  });

  // Telemetry
  const [provenanceSet, setProvenanceSet] = useState({
    name: "Robinhood Chain Verified Provenance Set v1",
    memberCount: "12,850",
    freshness: "Active Oracle",
  });

  const [relayerInfo, setRelayerInfo] = useState({
    address: "0x695d8E941e68D3ea39c14C43745286b5729E8CD7",
    ready: true,
    gasPrice: "0.020 Gwei",
    blockNumber: "82,268,700+",
  });

  // Read locally stored notes
  const refreshShieldedNotes = () => {
    try {
      const rawNotes = localStorage.getItem("veilora:notes");
      if (rawNotes) {
        const parsed = JSON.parse(rawNotes);
        const sum = parsed
          .filter((n: any) => n.status === "spendable" && n.asset === "USDG")
          .reduce((acc: number, n: any) => acc + (Number(n.amount) || 0), 0);
        setShieldedUsdg(sum);
      } else {
        setShieldedUsdg(0);
      }
    } catch {
      // Storage fallback
    }
  };

  useEffect(() => {
    refreshShieldedNotes();
  }, []);

  // Fetch balances
  const loadData = () => {
    if (!wallet?.address) return;
    setLoadingBalances(true);

    getOnChainBalances(wallet.address)
      .then((b) => setBalances(b))
      .catch(() => undefined)
      .finally(() => setLoadingBalances(false));

    getProvenanceSets()
      .then((res) => {
        if (res.sets && res.sets.length > 0) {
          const s = res.sets[0];
          setProvenanceSet({
            name: s.name,
            memberCount: Number(s.member_count).toLocaleString("en-US"),
            freshness: new Date(s.freshness_timestamp).toLocaleDateString(),
          });
        }
      })
      .catch(() => undefined);

    getRelayerStatus()
      .then((res) => {
        if (res.relayer) {
          setRelayerInfo({
            address: res.relayer.address || "0x695d8E941e68D3ea39c14C43745286b5729E8CD7",
            ready: res.relayer.ready,
            gasPrice: `${res.network.gasPriceGwei} Gwei`,
            blockNumber: `#${Number(res.network.blockNumber).toLocaleString()}`,
          });
        }
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    loadData();
  }, [wallet?.address]);

  // Derived totals
  const publicUsdg = balances.usdg;
  const ethValueUsd = balances.eth * 3000;
  const totalValue = publicUsdg + shieldedUsdg + ethValueUsd;

  const copySmartAccount = () => {
    if (wallet?.address) {
      navigator.clipboard.writeText(wallet.address);
      setCopiedAddr(true);
      setTimeout(() => setCopiedAddr(false), 2000);
    }
  };

  if (!wallet?.address) {
    return <OnboardingScreen />;
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Bar matching FinUi / Solflare */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-cream">
            Portfolio
          </h1>
          <p className="text-xs text-slate-400 dark:text-mist mt-0.5">
            Robinhood Chain
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Account Address Pill */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-3 py-1.5 shadow-sm text-xs">
            <span className="font-mono text-slate-800 dark:text-cream font-medium">
              {wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}
            </span>
            <button
              type="button"
              onClick={copySmartAccount}
              className="text-slate-400 hover:text-slate-700 dark:text-mist dark:hover:text-cream transition-colors p-0.5"
              title="Copy address"
            >
              {copiedAddr ? <Check className="h-3.5 w-3.5 text-teal-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => setDepositOpen(true)}
              className="text-slate-400 hover:text-[#eaba65] dark:text-mist dark:hover:text-[#eaba65] transition-colors p-0.5"
              title="Show QR Code"
            >
              <QrCode className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Remove / Disconnect Wallet Button */}
          <button
            type="button"
            onClick={() => setRemoveWalletOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-3 py-1.5 text-xs font-medium text-coral-600 dark:text-coral-400 hover:bg-coral-50 dark:hover:bg-coral-500/10 transition-colors shadow-sm"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Disconnect</span>
          </button>
        </div>
      </div>

      {/* 2. Top Row: Total Balance + Quick Links */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <BalanceHero
            totalValue={totalValue}
            loading={loadingBalances}
            onOpenDeposit={() => setDepositOpen(true)}
          />
        </div>

        <div className="lg:col-span-7">
          <QuickLinks
            onOpenDeposit={() => setDepositOpen(true)}
            onOpenShield={() => setShieldOpen(true)}
            onOpenSend={() => setSendOpen(true)}
            onOpenSwap={() => setSwapOpen(true)}
          />
        </div>
      </div>

      {/* 3. Metric 3-Card Row */}
      <MetricsRow
        publicUsdg={publicUsdg}
        shieldedUsdg={shieldedUsdg}
        ethBalance={balances.eth}
      />

      {/* 4. Main 2-Column Content Layout matching FinUi */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: My Vaults Card Stack + Holdings List */}
        <div className="lg:col-span-7 space-y-6">
          <VaultCards
            walletAddress={wallet?.address || ""}
            publicUsdg={publicUsdg}
            shieldedUsdg={shieldedUsdg}
            onOpenShield={() => setShieldOpen(true)}
          />

          <HoldingsList
            publicUsdg={publicUsdg}
            shieldedUsdg={shieldedUsdg}
            ethBalance={balances.eth}
            onOpenShield={() => setShieldOpen(true)}
            onOpenSwap={() => setSwapOpen(true)}
            onOpenDeposit={() => setDepositOpen(true)}
          />
        </div>

        {/* Right Column: Signing Queue + Network & Oracles */}
        <div className="lg:col-span-5 space-y-6">
          <ActivityQueue auditTrail={auditTrail} />
          <NetworkStats relayerInfo={relayerInfo} provenanceSet={provenanceSet} />
        </div>
      </div>

      {/* 5. Interaction Modals (Zero inline text or inputs) */}
      <DepositModal
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        accountAddress={wallet?.address || ""}
      />

      <ShieldModal
        open={shieldOpen}
        onClose={() => setShieldOpen(false)}
        publicUsdg={publicUsdg}
        onSuccess={(amt) => {
          refreshShieldedNotes();
          setStatusModal({
            open: true,
            type: "success",
            title: "USDG Shielded Successfully",
            message: `Created a zero-knowledge note commitment for ${amt} USDG in the privacy pool.`,
          });
        }}
      />

      <SendModal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        publicUsdg={publicUsdg}
        ethBalance={balances.eth}
        onSuccess={(msg) => {
          setStatusModal({
            open: true,
            type: "success",
            title: "Transfer Authorized",
            message: msg,
          });
        }}
      />

      <SwapModal
        open={swapOpen}
        onClose={() => setSwapOpen(false)}
        publicUsdg={publicUsdg}
        onSuccess={(msg) => {
          setStatusModal({
            open: true,
            type: "success",
            title: "Swap Executed",
            message: msg,
          });
        }}
      />

      <RemoveWalletModal
        open={removeWalletOpen}
        onClose={() => setRemoveWalletOpen(false)}
        onConfirm={() => {
          removeWallet();
          setStatusModal({
            open: true,
            type: "info",
            title: "Wallet Removed",
            message: "Your smart account and device keys have been removed from this browser.",
          });
        }}
        walletAddress={wallet?.address || ""}
      />

      <StatusModal
        open={statusModal.open}
        onClose={() => setStatusModal((s) => ({ ...s, open: false }))}
        type={statusModal.type}
        title={statusModal.title}
        message={statusModal.message}
        details={statusModal.details}
      />
    </div>
  );
}
