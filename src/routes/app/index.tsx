import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  EyeOff,
  Layers,
  QrCode,
  RefreshCw,
  Shield,
  ShieldCheck,
  Sparkles,
  Smartphone,
  Server,
  Fingerprint,
} from "lucide-react";
import { getOnChainBalances, getProvenanceSets, getRelayerStatus } from "@/lib/api";
import { Button, Card, Badge, StatusModal, inputClass } from "@/components/ui";
import { useWallet } from "@/lib/walletContext";
import { DepositModal } from "@/components/app/DepositModal";

export const Route = createFileRoute("/app/")({
  component: CommandCenter,
});

const QUICK_INTENTS = [
  "Shield 2,000 USDG into the privacy pool",
  "Buy 500 USDG of NVDA exposure and keep it shielded",
  "Send 1,250 USDG to verified supplier on Robinhood Chain",
  "Swap 1,000 USDC to USDG with clean provenance check",
];

export function CommandCenter() {
  const { wallet, auditTrail, deviceKeyPresent } = useWallet();
  const navigate = useNavigate();

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<"holdings" | "activity" | "security">("holdings");

  // Balances
  const [balances, setBalances] = useState<{ eth: number; usdg: number }>({ eth: 0, usdg: 0 });
  const [loadingBalances, setLoadingBalances] = useState(true);
  const [shieldedUsdg, setShieldedUsdg] = useState<number>(0);

  // Modals
  const [depositOpen, setDepositOpen] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState(false);
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

  // Intent goal input
  const [goal, setGoal] = useState("");

  // Network & provenance telemetry
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

  // Read locally saved shielded notes
  useEffect(() => {
    try {
      const rawNotes = localStorage.getItem("veilora:notes");
      if (rawNotes) {
        const parsed = JSON.parse(rawNotes);
        const sum = parsed
          .filter((n: any) => n.status === "spendable" && n.asset === "USDG")
          .reduce((acc: number, n: any) => acc + (Number(n.amount) || 0), 0);
        setShieldedUsdg(sum);
      }
    } catch {
      // Storage fallback
    }
  }, []);

  // Fetch real on-chain balances and network stats
  const fetchBalances = () => {
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
    fetchBalances();
  }, [wallet?.address]);

  // Derived balance calculations
  const publicUsdg = balances.usdg;
  const ethValueUsd = balances.eth * 3000;
  const totalValue = publicUsdg + shieldedUsdg + ethValueUsd;
  const totalUsdg = publicUsdg + shieldedUsdg;
  const shieldedPct = totalUsdg > 0 ? Math.round((shieldedUsdg / totalUsdg) * 100) : 0;
  const publicPct = 100 - shieldedPct;

  const copySmartAccount = () => {
    if (wallet?.address) {
      navigator.clipboard.writeText(wallet.address);
      setCopiedAddr(true);
      setTimeout(() => setCopiedAddr(false), 2000);
    }
  };

  const handlePlan = (targetGoal: string) => {
    const clean = targetGoal.trim();
    if (!clean) return;
    navigate({ to: "/app/intent", search: { goal: clean } });
  };

  return (
    <div className="space-y-6">
      {/* 1. Account Identity & Security Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-ink-700/60 bg-ink-850/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-mist">Smart Account</span>
            <span className="font-mono text-sm font-semibold text-cream">
              {wallet?.address
                ? `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}`
                : "Loading…"}
            </span>
          </div>

          <button
            type="button"
            onClick={copySmartAccount}
            className="flex items-center gap-1 rounded-lg border border-ink-600 bg-ink-900 px-2.5 py-1 text-xs text-cream hover:border-gold-400/60 hover:text-gold-200 transition-colors"
          >
            {copiedAddr ? <Check className="h-3 w-3 text-teal-300" /> : <Copy className="h-3 w-3" />}
            <span>{copiedAddr ? "Copied" : "Copy"}</span>
          </button>

          <button
            type="button"
            onClick={() => setDepositOpen(true)}
            className="flex items-center gap-1 rounded-lg border border-ink-600 bg-ink-900 px-2.5 py-1 text-xs text-cream hover:border-gold-400/60 hover:text-gold-200 transition-colors"
          >
            <QrCode className="h-3 w-3 text-gold-300" />
            <span>Show QR</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-400/30 bg-teal-400/10 px-3 py-1 font-medium text-teal-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            2-of-3 Threshold Active
          </span>
          <span className="rounded-full border border-ink-700 bg-ink-900 px-3 py-1 text-mist">
            Robinhood Chain {relayerInfo.blockNumber}
          </span>
        </div>
      </div>

      {/* 2. Portfolio Hero Section */}
      <div className="panel relative overflow-hidden p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-mist font-medium">Portfolio Balance</p>
            <div className="flex items-baseline gap-3">
              <h1 className="text-4xl font-semibold tracking-tight text-cream sm:text-5xl">
                {loadingBalances ? (
                  <span className="animate-pulse">Loading…</span>
                ) : (
                  totalValue.toLocaleString("en-US", { style: "currency", currency: "USD" })
                )}
              </h1>
              <button
                type="button"
                onClick={fetchBalances}
                className="text-mist hover:text-cream transition-colors p-1"
                title="Refresh balances"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-mist">
              Secured on Robinhood Chain across public & shielded pools
            </p>
          </div>

          {/* Quick Actions Row */}
          <div className="flex flex-wrap gap-2.5">
            <Button
              type="button"
              onClick={() => setDepositOpen(true)}
              className="flex items-center gap-2 shadow-lg"
            >
              <ArrowDownLeft className="h-4 w-4" />
              Deposit Funds
            </Button>

            <Link to="/app/privacy">
              <Button
                type="button"
                variant="outline"
                className="flex items-center gap-2 border-teal-400/40 text-teal-300 hover:bg-teal-400/10"
              >
                <EyeOff className="h-4 w-4" />
                Shield USDG
              </Button>
            </Link>

            <Link to="/app/move">
              <Button type="button" variant="outline" className="flex items-center gap-2">
                Send & Swap
              </Button>
            </Link>

            <Link to="/app/intent">
              <Button type="button" variant="outline" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-gold-300" />
                Plan Intent
              </Button>
            </Link>
          </div>
        </div>

        {/* Visual Allocation Split */}
        <div className="mt-8 space-y-3">
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-ink-950">
            <div
              style={{ width: `${totalUsdg > 0 ? publicPct : 50}%` }}
              className="bg-coral-500 transition-all duration-500"
              title={`Public: ${publicPct}%`}
            />
            <div
              style={{ width: `${totalUsdg > 0 ? shieldedPct : 50}%` }}
              className="bg-teal-400 transition-all duration-500"
              title={`Shielded: ${shieldedPct}%`}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-coral-500/20 bg-coral-500/5 p-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-coral-400 font-medium">Public Pool</span>
                <span className="text-mist">{publicPct}%</span>
              </div>
              <p className="mt-1 text-xl font-semibold text-cream">
                {publicUsdg.toLocaleString("en-US", { style: "currency", currency: "USD" })}
              </p>
              <p className="mt-0.5 text-xs text-mist">Visible on Robinhood Chain</p>
            </div>

            <div className="rounded-xl border border-teal-400/20 bg-teal-400/5 p-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-teal-300 font-medium">Shielded Pool</span>
                <span className="text-mist">{shieldedPct}%</span>
              </div>
              <p className="mt-1 text-xl font-semibold text-teal-300">
                {shieldedUsdg.toLocaleString("en-US", { style: "currency", currency: "USD" })}
              </p>
              <p className="mt-0.5 text-xs text-mist">Zero-knowledge private balance</p>
            </div>

            <div className="rounded-xl border border-gold-400/20 bg-gold-400/5 p-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gold-300 font-medium">Gas Reserve</span>
                <span className="text-mist">ETH</span>
              </div>
              <p className="mt-1 text-xl font-semibold text-cream">
                {balances.eth.toFixed(4)} ETH
              </p>
              <p className="mt-0.5 text-xs text-mist">Available for relayer fees</p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Streamlined Natural Language Intent Console Bar */}
      <div className="panel p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-gold-300" />
          <h3 className="text-sm font-semibold text-cream">What do you want to do?</h3>
          <span className="text-xs text-mist">· Evaluated with threshold safety guardrails</span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handlePlan(goal);
          }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <input
            className={inputClass}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g., Shield 2,000 USDG and buy 500 USDG of NVDA exposure"
          />
          <Button type="submit" className="shrink-0 flex items-center gap-2">
            Plan with AI <ArrowRight className="h-4 w-4" />
          </Button>
        </form>

        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_INTENTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => handlePlan(prompt)}
              className="rounded-full border border-ink-700 bg-ink-950/60 px-3 py-1 text-xs text-mist transition-colors hover:border-gold-400/60 hover:text-cream"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Tabbed Content Workspace */}
      <div className="space-y-4">
        {/* Tab Controls */}
        <div className="flex items-center gap-2 border-b border-ink-700/80 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("holdings")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "holdings"
                ? "bg-ink-800 text-cream border border-ink-600 shadow-sm"
                : "text-mist hover:text-cream"
            }`}
          >
            <Layers className="h-4 w-4" />
            Assets & Pools
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("activity")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "activity"
                ? "bg-ink-800 text-cream border border-ink-600 shadow-sm"
                : "text-mist hover:text-cream"
            }`}
          >
            <CheckCircle2 className="h-4 w-4" />
            Signing Queue & Activity
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("security")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "security"
                ? "bg-ink-800 text-cream border border-ink-600 shadow-sm"
                : "text-mist hover:text-cream"
            }`}
          >
            <Shield className="h-4 w-4" />
            Threshold Custody & Relayer
          </button>
        </div>

        {/* Tab 1: Assets & Pools */}
        {activeTab === "holdings" && (
          <div className="space-y-4">
            {/* If zero balance, show helpful action invitation */}
            {totalValue === 0 && !loadingBalances && (
              <div className="rounded-2xl border border-gold-400/30 bg-gold-400/5 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-base font-semibold text-cream">Your smart account is ready for funds</h4>
                  <p className="text-xs text-mist leading-relaxed max-w-xl">
                    Deposit USDG or ETH on Robinhood Chain to start trading or shielding balances. Your funds are protected by 2-of-3 threshold keys with automated policy guardrails.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => setDepositOpen(true)}
                  className="shrink-0 flex items-center gap-2"
                >
                  <ArrowDownLeft className="h-4 w-4" />
                  Deposit Funds
                </Button>
              </div>
            )}

            <div className="panel overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-ink-700/80 bg-ink-950/40 text-xs text-mist">
                      <th className="px-5 py-3 font-medium">Asset</th>
                      <th className="px-5 py-3 text-right font-medium">Public Balance</th>
                      <th className="px-5 py-3 text-right font-medium">Shielded Balance</th>
                      <th className="px-5 py-3 text-right font-medium">Total Value</th>
                      <th className="px-5 py-3 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-700/50">
                    {/* USDG */}
                    <tr className="hover:bg-ink-850/40 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-400/10 text-teal-300 font-semibold border border-teal-400/20">
                            $
                          </div>
                          <div>
                            <p className="font-medium text-cream">USDG</p>
                            <p className="text-xs text-mist">Global Dollar (Robinhood Chain)</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums text-cream-dim">
                        {publicUsdg.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums text-teal-300 font-medium">
                        {shieldedUsdg.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums font-medium text-cream">
                        {(publicUsdg + shieldedUsdg).toLocaleString("en-US", {
                          style: "currency",
                          currency: "USD",
                        })}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link to="/app/privacy">
                          <Button variant="outline" className="text-xs py-1 px-3 border-teal-400/40 text-teal-300">
                            Shield
                          </Button>
                        </Link>
                      </td>
                    </tr>

                    {/* ETH */}
                    <tr className="hover:bg-ink-850/40 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-400/10 text-gold-300 font-semibold border border-gold-400/20">
                            Ξ
                          </div>
                          <div>
                            <p className="font-medium text-cream">ETH</p>
                            <p className="text-xs text-mist">Native Gas Reserve</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums text-cream-dim">
                        {balances.eth.toFixed(4)} ETH
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums text-mist">
                        0.00
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums font-medium text-cream">
                        {ethValueUsd.toLocaleString("en-US", { style: "currency", currency: "USD" })}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Button
                          variant="outline"
                          onClick={() => setDepositOpen(true)}
                          className="text-xs py-1 px-3"
                        >
                          Top up
                        </Button>
                      </td>
                    </tr>

                    {/* NVDA / Equity Tokens */}
                    <tr className="hover:bg-ink-850/40 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-800 text-mist font-semibold border border-ink-600">
                            NV
                          </div>
                          <div>
                            <p className="font-medium text-cream">NVDA</p>
                            <p className="text-xs text-mist">Robinhood Tokenized Equity</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums text-cream-dim">0.00</td>
                      <td className="px-5 py-4 text-right tabular-nums text-mist">0.00</td>
                      <td className="px-5 py-4 text-right tabular-nums text-mist">$0.00</td>
                      <td className="px-5 py-4 text-right">
                        <Link to="/app/move">
                          <Button variant="outline" className="text-xs py-1 px-3">
                            Trade
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Signing Queue & Activity */}
        {activeTab === "activity" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card
              title="Outbox Signing Queue"
              eyebrow="2-of-3 Pending Approvals"
              action={
                <Link to="/app/outbox" className="text-xs text-gold-300 hover:text-gold-200">
                  Open Outbox
                </Link>
              }
            >
              <div className="p-8 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-teal-300 mb-2" />
                <p className="text-base font-semibold text-cream">Signing queue is clear</p>
                <p className="text-xs text-mist mt-1 max-w-sm mx-auto">
                  No actions are currently awaiting threshold co-signatures. New intents created from the console will queue here for approval.
                </p>
              </div>
            </Card>

            <Card
              title="Recent Activity Log"
              eyebrow="On-Chain & Shard Audit Trail"
              action={
                <Link to="/app/security" className="text-xs text-gold-300 hover:text-gold-200">
                  Full Audit Log
                </Link>
              }
            >
              {auditTrail.length === 0 ? (
                <div className="p-8 text-center text-xs text-mist">
                  No transaction activity logged yet for this account.
                </div>
              ) : (
                <ul className="divide-y divide-ink-700/60">
                  {auditTrail.slice(0, 4).map((rec) => (
                    <li key={rec.id} className="py-3 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-mono text-cream">{rec.user_op_hash.slice(0, 16)}…</p>
                        <p className="text-mist">{new Date(rec.created_at).toLocaleString()}</p>
                      </div>
                      <Badge tone={rec.status === "executed" ? "teal" : "gold"}>
                        {rec.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}

        {/* Tab 3: Threshold Custody & Relayer */}
        {activeTab === "security" && (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Shard A */}
            <div className="panel p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-teal-300" />
                  <h4 className="text-sm font-semibold text-cream">Device Key (Shard A)</h4>
                </div>
                <Badge tone={deviceKeyPresent ? "teal" : "coral"}>
                  {deviceKeyPresent ? "Active" : "Key Missing"}
                </Badge>
              </div>
              <p className="text-xs text-mist leading-relaxed">
                {deviceKeyPresent
                  ? "Stored securely in this browser to sign daily intents without seed phrases."
                  : "Private key not found in this browser storage. You can import your key in Custody settings."}
              </p>
              <div className="pt-2">
                <Link to="/app/security">
                  <Button variant="outline" className="w-full text-xs py-1.5">
                    Manage Shard Keys
                  </Button>
                </Link>
              </div>
            </div>

            {/* Shard B */}
            <div className="panel p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-gold-300" />
                  <h4 className="text-sm font-semibold text-cream">Veilora HSM (Shard B)</h4>
                </div>
                <Badge tone="teal">Active</Badge>
              </div>
              <p className="text-xs text-mist leading-relaxed">
                Co-signs transactions that satisfy your configured spending policies and zero-knowledge clean proofs.
              </p>
              <div className="pt-2">
                <Link to="/app/policies">
                  <Button variant="outline" className="w-full text-xs py-1.5">
                    Configure Policies
                  </Button>
                </Link>
              </div>
            </div>

            {/* Shard C */}
            <div className="panel p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Fingerprint className="h-4 w-4 text-mist" />
                  <h4 className="text-sm font-semibold text-cream">Recovery Key (Shard C)</h4>
                </div>
                <Badge tone="mist">Offline Standby</Badge>
              </div>
              <p className="text-xs text-mist leading-relaxed">
                Kept strictly offline in your downloaded backup file. Needed only if you lose this device.
              </p>
              <div className="pt-2">
                <Link to="/app/security">
                  <Button variant="outline" className="w-full text-xs py-1.5">
                    Recovery Instructions
                  </Button>
                </Link>
              </div>
            </div>

            {/* Relayer & Provenance Status Row */}
            <div className="panel p-5 space-y-2 lg:col-span-2">
              <h4 className="text-sm font-semibold text-cream">Robinhood Chain Relayer Plane</h4>
              <p className="text-xs text-mist">
                Relayer executes replay-protected user operations. Destination contracts cannot be modified by the relayer.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-ink-950/60 p-2.5 border border-ink-700/60">
                  <span className="text-mist">Gas Price: </span>
                  <span className="text-gold-200 font-mono font-medium">{relayerInfo.gasPrice}</span>
                </div>
                <div className="rounded-lg bg-ink-950/60 p-2.5 border border-ink-700/60">
                  <span className="text-mist">Relayer Status: </span>
                  <span className="text-teal-300 font-medium">Operational</span>
                </div>
              </div>
            </div>

            <div className="panel p-5 space-y-2">
              <h4 className="text-sm font-semibold text-cream">Provenance Oracle</h4>
              <p className="text-xs text-mist">
                Clean provenance set with {provenanceSet.memberCount} verified members.
              </p>
              <div className="pt-3">
                <Link to="/app/disclosure">
                  <Button variant="outline" className="w-full text-xs py-1.5">
                    Inspect View Keys
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Modals */}
      <DepositModal
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        accountAddress={wallet?.address || ""}
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
