import { createFileRoute } from "@tanstack/react-router";
import { Check, Minus } from "lucide-react";
import { ADAPTERS, BROADCASTERS, NETWORK, PROVERS, SAFETY_METRICS } from "@/demo/data";
import { Badge, Card, PageHeader, Stat } from "@/components/ui";

export const Route = createFileRoute("/app/network")({
  component: NetworkScreen,
});

const STATUS_TONE: Record<string, "teal" | "gold" | "mist" | "coral"> = {
  Live: "teal",
  Testnet: "mist",
  "Audit in progress": "gold",
  Primary: "teal",
  Fallback: "gold",
  Degraded: "coral",
  Default: "teal",
  "Fallback for mobile": "gold",
};

function Yes({ v }: { v: boolean }) {
  return v ? <Check className="h-4 w-4 text-teal-300" /> : <Minus className="h-4 w-4 text-mist" />;
}

function NetworkScreen() {
  return (
    <>
      <PageHeader
        eyebrow="Control mode · Execution plane"
        title="Adapters, broadcasters and provers."
        description="Every adapter declares what it supports, how it settles and how it fails. Chain-specific assumptions stay visible here, not hidden in the wallet."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {SAFETY_METRICS.map((m) => (
          <Stat key={m.label} label={m.label} value={m.value} tone="teal" />
        ))}
      </div>

      <Card title="Verified Smart Contracts" eyebrow="Robinhood Chain Mainnet (Chain ID 4663)" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-mist">
                <th className="px-5 py-3 font-medium">Contract</th>
                <th className="px-5 py-3 font-medium">Description</th>
                <th className="px-5 py-3 font-medium">Address</th>
                <th className="px-5 py-3 font-medium">Execution Hook</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-ink-600/50">
                <td className="px-5 py-3 font-medium text-cream">VeiloraFactory</td>
                <td className="px-5 py-3 text-mist">CREATE2 deterministic threshold vault deployer</td>
                <td className="px-5 py-3 font-mono text-xs text-gold-300">
                  <a
                    href={`${NETWORK.explorerUrl}/address/${NETWORK.contracts.factory}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                  >
                    {NETWORK.contracts.factory}
                  </a>
                </td>
                <td className="px-5 py-3 text-xs text-mist">createAccount()</td>
                <td className="px-5 py-3"><Badge tone="teal">Deployed</Badge></td>
              </tr>
              <tr className="border-t border-ink-600/50">
                <td className="px-5 py-3 font-medium text-cream">VeiloraShieldedPool</td>
                <td className="px-5 py-3 text-mist">Shielded note commitments & nullifier settlement</td>
                <td className="px-5 py-3 font-mono text-xs text-gold-300">
                  <a
                    href={`${NETWORK.explorerUrl}/address/${NETWORK.contracts.shieldedPool}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                  >
                    {NETWORK.contracts.shieldedPool}
                  </a>
                </td>
                <td className="px-5 py-3 text-xs text-mist">depositUSDG() / unshieldUSDG()</td>
                <td className="px-5 py-3"><Badge tone="teal">Deployed</Badge></td>
              </tr>
              <tr className="border-t border-ink-600/50">
                <td className="px-5 py-3 font-medium text-cream">Global Dollar (USDG)</td>
                <td className="px-5 py-3 text-mist">Robinhood Chain native settlement asset</td>
                <td className="px-5 py-3 font-mono text-xs text-mist">
                  <a
                    href={`${NETWORK.explorerUrl}/token/${NETWORK.contracts.usdgToken}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                  >
                    {NETWORK.contracts.usdgToken}
                  </a>
                </td>
                <td className="px-5 py-3 text-xs text-mist">ERC-20 standard</td>
                <td className="px-5 py-3"><Badge tone="teal">Active</Badge></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6">
        <Card title="Adapter capability declarations" eyebrow="Robinhood Chain first" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-mist">
                <th className="px-5 py-3 font-medium">Adapter</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Transparent</th>
                <th className="px-5 py-3 font-medium">Shielded</th>
                <th className="px-5 py-3 font-medium">Finality</th>
                <th className="px-5 py-3 font-medium">Version</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {ADAPTERS.map((a) => (
                <tr key={a.name} className="border-t border-ink-600/50">
                  <td className="px-5 py-3 text-cream">{a.name}</td>
                  <td className="px-5 py-3 text-mist">{a.type}</td>
                  <td className="px-5 py-3"><Yes v={a.transparent} /></td>
                  <td className="px-5 py-3"><Yes v={a.shielded} /></td>
                  <td className="px-5 py-3 text-mist">{a.finality}</td>
                  <td className="px-5 py-3 font-mono text-xs text-mist">{a.version}</td>
                  <td className="px-5 py-3"><Badge tone={STATUS_TONE[a.status]}>{a.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Broadcasters" eyebrow="Bonded, with fallback" bodyClassName="p-0">
          <ul>
            {BROADCASTERS.map((b) => (
              <li key={b.name} className="border-t border-ink-600/50 px-5 py-4 first:border-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-cream">{b.name}</p>
                  <Badge tone={STATUS_TONE[b.status]}>{b.status}</Badge>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-700">
                  <div className="h-full bg-teal-400" style={{ width: `${Math.max(0, (b.liveness - 95) * 20)}%` }} />
                </div>
                <p className="mt-2 text-xs text-mist">
                  {b.liveness}% liveness · {b.latency} · fee {b.fee} · bond {b.bond}
                </p>
              </li>
            ))}
          </ul>
          <p className="border-t border-ink-600/50 px-5 py-3 text-xs text-mist">Broadcasters cannot redirect funds. Replay-protected, with deterministic timeouts and refunds.</p>
        </Card>

        <Card title="Provers" eyebrow="Where proofs are generated" bodyClassName="p-0">
          <ul>
            {PROVERS.map((p) => (
              <li key={p.name} className="border-t border-ink-600/50 px-5 py-4 first:border-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-cream">{p.name}</p>
                  <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-mist">
                  {p.kind} · {p.latency}
                </p>
                <p className="mt-1 text-sm text-cream-dim">{p.privacy}</p>
              </li>
            ))}
          </ul>
          <p className="border-t border-ink-600/50 px-5 py-3 text-xs text-mist">Proving times are measured targets, not promises. Every receipt records where its proof ran.</p>
        </Card>
      </div>
    </>
  );
}
