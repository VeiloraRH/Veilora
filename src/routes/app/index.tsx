import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, EyeOff, Sparkles } from "lucide-react";
import {
  ASSETS,
  GAS_RESERVE,
  INTENT_SUGGESTIONS,
  NOTES,
  OUTBOX,
  OUTBOX_STATUS,
  PROOFS,
  RECEIPTS,
  BROADCASTERS,
  TOTALS,
  amount,
  usd,
} from "@/demo/data";
import { Badge, Button, Card, Dot, PageHeader, Stat, inputClass } from "@/components/ui";
import { useMode } from "@/lib/mode";
import { useWallet } from "@/lib/walletContext";

export const Route = createFileRoute("/app/")({
  component: CommandCenter,
});

const SHIELD_LABEL = { live: { label: "Shieldable", tone: "teal" }, pilot: { label: "Pilot", tone: "gold" }, unsupported: { label: "Public only", tone: "mist" } } as const;

function CommandCenter() {
  const { mode } = useMode();
  const { wallet } = useWallet();
  const navigate = useNavigate();
  const [goal, setGoal] = useState("");
  const shieldedPct = Math.round((TOTALS.shielded / TOTALS.total) * 100);
  const proof = PROOFS[0];

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
          <>
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
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total value" value={usd(TOTALS.total)} sub="Public + shielded" />
        <Stat label="Public" value={usd(TOTALS.public)} sub="Visible on Robinhood Chain" tone="coral" />
        <Stat label="Shielded" value={usd(TOTALS.shielded)} sub={`${shieldedPct}% of holdings`} tone="teal" />
        <Stat label="Gas reserve" value={`${GAS_RESERVE.reserved} ETH`} sub={`${GAS_RESERVE.available} ETH available`} tone="gold" />
      </div>

      {/* Intent bar */}
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
        <p className="mt-3 text-xs text-mist">Planned on this device. Your intent text is never sent to a server.</p>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card title="Holdings" eyebrow="Public and shielded" bodyClassName="p-0">
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
                {ASSETS.map((a) => (
                  <tr key={a.symbol} className="border-t border-ink-600/50">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-cream">{a.symbol}</p>
                      <p className="text-xs text-mist">{a.name}</p>
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-cream-dim">{amount(a.publicBalance)}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-teal-300">{amount(a.shieldedBalance)}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums">{usd((a.publicBalance + a.shieldedBalance) * a.priceUsd)}</td>
                    <td className="px-5 py-3.5">
                      <Badge tone={SHIELD_LABEL[a.shield].tone}>{SHIELD_LABEL[a.shield].label}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          title="Outbox"
          eyebrow="Waiting on you"
          action={
            <Link to="/app/outbox" className="text-xs text-gold-300 hover:text-gold-200">
              Open
            </Link>
          }
          bodyClassName="p-0"
        >
          <ul>
            {OUTBOX.map((o) => (
              <li key={o.id} className="flex items-center gap-3 border-t border-ink-600/50 px-5 py-3.5 first:border-0">
                <Dot tone={OUTBOX_STATUS[o.status].tone} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-cream">{o.title}</p>
                  <p className="text-xs text-mist">
                    {OUTBOX_STATUS[o.status].label} · {o.expires}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Signing quorum" eyebrow="2-of-3">
          <ul className="space-y-3">
            {liveShards.map((s) => (
              <li key={s.id} className="flex items-center gap-3 text-sm">
                <span className="grid h-8 w-8 place-items-center rounded-full border border-gold-400/40 font-display text-base text-gold-300">{s.id}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-cream">{s.name}</p>
                  <p className="truncate font-mono text-xs text-mist">{s.where}</p>
                </div>
                <Badge tone={s.status === "Active" ? "teal" : "mist"}>{s.status}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Clean-provenance proof" eyebrow="Proof provider">
          <div className="flex items-center gap-2 text-sm">
            <Dot tone="teal" />
            <span className="text-cream">{proof.set}</span>
          </div>
          <p className="mt-2 text-xs text-mist">{proof.freshness}</p>
          <p className="mt-1 text-xs text-mist">Valid until {proof.validUntil}</p>
          <Link to="/app/disclosure" className="mt-4 inline-flex items-center gap-1 text-xs text-gold-300 hover:text-gold-200">
            What this proof reveals <ArrowRight className="h-3 w-3" />
          </Link>
        </Card>

        <Card title="Broadcasters" eyebrow="Who submits for you">
          <ul className="space-y-2.5 text-sm">
            {BROADCASTERS.map((b) => (
              <li key={b.name} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Dot tone={b.liveness > 99.5 ? "teal" : "coral"} />
                  {b.name}
                </span>
                <span className="text-xs tabular-nums text-mist">{b.liveness}% live</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-mist">No broadcaster can change where funds go.</p>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card
          title="Recent receipts"
          eyebrow="Saved on this device"
          action={
            <Link to="/app/activity" className="text-xs text-gold-300 hover:text-gold-200">
              All receipts
            </Link>
          }
          bodyClassName="p-0"
        >
          <ul>
            {RECEIPTS.slice(0, 5).map((r) => (
              <li key={r.id} className="flex items-center gap-3 border-t border-ink-600/50 px-5 py-3 first:border-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-cream">{r.title}</p>
                  <p className="text-xs text-mist">
                    {r.time} · {r.route}
                  </p>
                </div>
                <Badge tone={r.status === "settled" ? "teal" : r.status === "refunded" ? "gold" : "coral"}>{r.status}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        {mode === "control" ? (
          <Card title="Shielded notes" eyebrow="Control mode" bodyClassName="p-0">
            <ul>
              {NOTES.filter((n) => n.status !== "spent").map((n) => (
                <li key={n.id} className="border-t border-ink-600/50 px-5 py-3 text-sm first:border-0">
                  <div className="flex justify-between">
                    <span className="text-cream">
                      {amount(n.amount)} {n.asset}
                    </span>
                    <Badge tone={n.status === "spendable" ? "teal" : "gold"}>{n.status}</Badge>
                  </div>
                  <p className="mt-1 font-mono text-xs text-mist">{n.commitment}</p>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <Card title="Privacy at a glance" eyebrow="Who can see what">
            <div className="mb-3 h-2 overflow-hidden rounded-full bg-coral-500/40">
              <div className="h-full bg-teal-400" style={{ width: `${shieldedPct}%` }} />
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-teal-300">{shieldedPct}% shielded</span>
              <span className="text-coral-400">{100 - shieldedPct}% public</span>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-mist">
              Shielded balances hide amounts and relationships inside the pool. Deposits and exits are still visible on-chain.
              Switch to Control mode to see notes and commitments.
            </p>
          </Card>
        )}
      </div>
    </>
  );
}
