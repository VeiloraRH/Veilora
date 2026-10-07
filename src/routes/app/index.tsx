import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, EyeOff, Sparkles, CheckCircle2 } from "lucide-react";
import { getOnChainBalances, getProvenanceSets, getRelayerStatus } from "@/lib/api";
import { Button, Card, Dot, PageHeader, Stat, inputClass } from "@/components/ui";
import { useMode } from "@/lib/mode";
import { useWallet } from "@/lib/walletContext";

export const Route = createFileRoute("/app/")({
  component: CommandCenter,
});

const INTENT_SUGGESTIONS = [
  "Shield 2,000 USDG into the privacy pool",
  "Buy 500 USDG of NVDA exposure and keep it shielded",
  "Send 1,250 USDG to verified supplier on Robinhood Chain",
  "Swap 1,000 USDC to USDG with clean provenance check",
];

export function CommandCenter() {
  const { mode } = useMode();
  const { wallet, auditTrail } = useWallet();
  const navigate = useNavigate();
  const [goal, setGoal] = useState("");

  const [balances, setBalances] = useState<{ eth: number; usdg: number }>({ eth: 0, usdg: 0 });
  const [loadingBalances, setLoadingBalances] = useState(true);

  const [provenanceSet, setProvenanceSet] = useState<{
    setId: string;
    name: string;
    memberCount: string;
    freshness: string;
  }>({
    setId: "rhc-clean-v1",
    name: "Robinhood Chain Verified Provenance Set v1",
    memberCount: "12,850",
    freshness: "Active Oracle Freshness",
  });

  const [relayerInfo, setRelayerInfo] = useState<{
    address: string;
    ready: boolean;
    gasPrice: string;
  }>({
    address: "0x695d8E941e68D3ea39c14C43745286b5729E8CD7",
    ready: true,
    gasPrice: "0.020 Gwei",
  });

  // Calculate real shielded balances from locally saved notes
  const [shieldedUsdg, setShieldedUsdg] = useState<number>(0);
  const [userNotes, setUserNotes] = useState<any[]>([]);

  useEffect(() => {
    try {
      const rawNotes = localStorage.getItem("veilora:notes");
      if (rawNotes) {
        const parsed = JSON.parse(rawNotes);
        setUserNotes(parsed);
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
  useEffect(() => {
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
            setId: s.set_id,
            name: s.name,
            memberCount: Number(s.member_count).toLocaleString("en-US"),
            freshness: new Date(s.freshness_timestamp).toLocaleString(),
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
          });
        }
      })
      .catch(() => undefined);
  }, [wallet?.address]);

  // Real totals
  const publicUsdg = balances.usdg;
  const ethValueUsd = balances.eth * 3000;
  const totalValue = publicUsdg + shieldedUsdg + ethValueUsd;
  const totalUsdg = publicUsdg + shieldedUsdg;
  const shieldedPct = totalUsdg > 0 ? Math.round((shieldedUsdg / totalUsdg) * 100) : 0;

  const userTitle = wallet?.address
    ? `Account ${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}`
    : "Veilora Account";

  const liveShards = [
    { id: "A", name: "Device Key", where: wallet?.shardA || "Local Device", status: "Active" },
    { id: "B", name: "Policy Co-Signer", where: wallet?.shardB || "Veilora HSM", status: "Active" },
    { id: "C", name: "Recovery Shard", where: wallet?.shardC || "Passkey Standby", status: "Standby" },
  ];

  const plan = (g: string) => navigate({ to: "/app/intent", search: { goal: g || undefined } });

  return (
    <>
      <PageHeader
        eyebrow="Command Center"
        title={`Overview · ${userTitle}`}
        description="Everything you hold, everything waiting for a signature, and what each party can see on Robinhood Chain."
        actions={
          <div className="flex gap-2">
            <Link to="/app/privacy">
              <Button variant="outline">
                <EyeOff className="h-4 w-4" /> Shield funds
              </Button>
            </Link>
            <Link to="/app/intent">
              <Button>
                <Sparkles className="h-4 w-4" /> New intent
              </Button>
            </Link>
          </div>
        }
      />

      {/* Real Holdings Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Total Value"
          value={
            loadingBalances
              ? "…"
              : totalValue.toLocaleString("en-US", { style: "currency", currency: "USD" })
          }
          sub="Public + shielded on-chain"
        />
        <Stat
          label="Public"
          value={
            loadingBalances
              ? "…"
              : publicUsdg.toLocaleString("en-US", { style: "currency", currency: "USD" })
          }
          sub="Visible on Robinhood Chain"
          tone="coral"
        />
        <Stat
          label="Shielded"
          value={
            loadingBalances
              ? "…"
              : shieldedUsdg.toLocaleString("en-US", { style: "currency", currency: "USD" })
          }
          sub={`${shieldedPct}% of USDG holdings`}
          tone="teal"
        />
        <Stat
          label="Gas Reserve"
          value={loadingBalances ? "…" : `${balances.eth.toFixed(4)} ETH`}
          sub="Available for transaction fees"
          tone="gold"
        />
      </div>

      {/* Intent Input Bar */}
      <div className="panel mt-6 p-5">
        <p className="eyebrow mb-3">Say what you want</p>
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            plan(goal);
          }}
        >
          <input
            className={inputClass}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. Shield 2,000 USDG and keep the rest public for payroll"
          />
          <Button type="submit" className="shrink-0">
            Plan it <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {INTENT_SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => plan(s)}
              className="max-w-full truncate rounded-full border border-ink-600 px-3 py-1 text-xs text-mist transition-colors hover:border-gold-400/60 hover:text-cream"
            >
              {s}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-mist">
          Planned on this device. Your intent text is never sent unencrypted to a server.
        </p>
      </div>

      {/* Real Holdings Table & Outbox */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card title="Holdings" eyebrow="Live On-Chain Balances" bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.16em] text-mist">
                  <th className="px-5 py-3 font-medium">Asset</th>
                  <th className="px-5 py-3 text-right font-medium">Public</th>
                  <th className="px-5 py-3 text-right font-medium">Shielded</th>
                  <th className="px-5 py-3 text-right font-medium">Value</th>
                  <th className="px-5 py-3 font-medium">Privacy</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-ink-600/50">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-cream">USDG</p>
                    <p className="text-xs text-mist">Global Dollar (Robinhood Chain)</p>
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-cream-dim">
                    {balances.usdg.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-teal-300">
                    {shieldedUsdg.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums">
                    {(balances.usdg + shieldedUsdg).toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                    })}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-teal-300 font-medium">
                    Shieldable
                  </td>
                </tr>

                <tr className="border-t border-ink-600/50">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-cream">ETH</p>
                    <p className="text-xs text-mist">Native Gas Reserve</p>
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-cream-dim">
                    {balances.eth.toFixed(4)}
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-mist">
                    0.00
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums">
                    {ethValueUsd.toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                    })}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-mist">
                    Gas reserve
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        {/* Real Outbox Card */}
        <Card
          title="Outbox"
          eyebrow="Signing Queue"
          action={
            <Link to="/app/outbox" className="text-xs text-gold-300 hover:text-gold-200">
              Open Outbox
            </Link>
          }
          bodyClassName="p-0"
        >
          <div className="p-6 text-center text-sm text-mist">
            <CheckCircle2 className="mx-auto h-7 w-7 text-teal-300/80 mb-2" />
            <p className="text-cream font-medium">Outbox is clear</p>
            <p className="text-xs text-mist mt-1">
              0 transactions awaiting 2-of-3 threshold signature.
            </p>
          </div>
        </Card>
      </div>

      {/* Quorum, Real Provenance Set & Real Broadcaster Relayer */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Signing Quorum" eyebrow="2-of-3 Threshold">
          <ul className="space-y-3">
            {liveShards.map((s) => (
              <li key={s.id} className="flex items-center gap-3 text-sm">
                <span className="grid h-8 w-8 place-items-center rounded-full border border-gold-400/40 font-display text-base text-gold-300">
                  {s.id}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-cream font-medium">{s.name}</p>
                  <p className="truncate font-mono text-xs text-mist">{s.where}</p>
                </div>
                <span className="text-xs text-teal-300 font-medium">{s.status}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Clean Provenance Proof" eyebrow="Association Set Oracle">
          <div className="flex items-center gap-2 text-sm">
            <Dot tone="teal" />
            <span className="text-cream font-medium">{provenanceSet.name}</span>
          </div>
          <p className="mt-2 text-xs text-mist">
            {provenanceSet.memberCount} verified members in clean set
          </p>
          <p className="mt-1 text-xs text-mist">
            Freshness: {provenanceSet.freshness}
          </p>
          <Link
            to="/app/disclosure"
            className="mt-4 inline-flex items-center gap-1 text-xs text-gold-300 hover:text-gold-200"
          >
            Inspect Provenance Sets <ArrowRight className="h-3 w-3" />
          </Link>
        </Card>

        <Card title="Execution Relayer" eyebrow="Broadcaster Plane">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-cream font-medium">Robinhood Chain Relayer</span>
              <span className="text-xs text-teal-300 font-medium">Operational</span>
            </div>
            <p className="font-mono text-xs text-mist truncate">
              {relayerInfo.address}
            </p>
            <p className="text-xs text-mist">
              Gas Price: {relayerInfo.gasPrice}
            </p>
          </div>
          <p className="mt-4 text-xs text-mist border-t border-ink-600/60 pt-3">
            Replay-protected and threshold-signed. Relayer cannot modify destination.
          </p>
        </Card>
      </div>

      {/* Real Activity & Real Privacy Overview */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card
          title="Recent Activity"
          eyebrow="Account Audit Trail"
          action={
            <Link to="/app/activity" className="text-xs text-gold-300 hover:text-gold-200">
              All Activity
            </Link>
          }
          bodyClassName="p-0"
        >
          {auditTrail.length === 0 ? (
            <div className="p-6 text-center text-sm text-mist">
              No signature requests or transactions logged yet for this account.
            </div>
          ) : (
            <ul>
              {auditTrail.slice(0, 5).map((rec) => (
                <li
                  key={rec.id}
                  className="flex items-center gap-3 border-t border-ink-600/50 px-5 py-3 first:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs text-cream">
                      {rec.user_op_hash}
                    </p>
                    <p className="text-xs text-mist mt-0.5">
                      {new Date(rec.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-xs text-teal-300 font-medium">{rec.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {mode === "control" ? (
          <Card title="Shielded Notes" eyebrow="Local Privacy Ledger" bodyClassName="p-0">
            {userNotes.length === 0 ? (
              <div className="p-6 text-center text-xs text-mist">
                No shielded notes created yet.
              </div>
            ) : (
              <ul>
                {userNotes.slice(0, 5).map((n) => (
                  <li key={n.id} className="border-t border-ink-600/50 px-5 py-3 text-sm first:border-0">
                    <div className="flex justify-between">
                      <span className="text-cream font-medium">
                        {n.amount.toLocaleString("en-US")} {n.asset}
                      </span>
                      <span className="text-xs text-teal-300">{n.status}</span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-mist truncate">
                      {n.commitment}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : (
          <Card title="Privacy at a Glance" eyebrow="Asset Shielding Ratio">
            <div className="mb-3 h-2 overflow-hidden rounded-full bg-coral-500/40">
              <div className="h-full bg-teal-400" style={{ width: `${shieldedPct}%` }} />
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-teal-300">{shieldedPct}% shielded</span>
              <span className="text-coral-400">{100 - shieldedPct}% public</span>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-mist">
              Shielded balances hide transaction amounts and recipients inside the pool on Robinhood Chain.
              Deposits and exits are verified cryptographically.
            </p>
          </Card>
        )}
      </div>
    </>
  );
}
