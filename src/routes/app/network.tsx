import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Minus, ExternalLink } from "lucide-react";
import { ADAPTERS, BROADCASTERS, NETWORK, PROVERS } from "@/demo/data";
import { getRelayerStatus } from "@/lib/api";
import { useWallet } from "@/lib/walletContext";
import { Badge, Card, PageHeader, Stat } from "@/components/ui";

export const Route = createFileRoute("/app/network")({
  component: NetworkScreen,
});

const STATUS_TONE: Record<string, "teal" | "gold" | "mist" | "coral"> = {
  Live: "teal",
  Deployed: "teal",
  Active: "teal",
  Primary: "teal",
  Testnet: "mist",
  "Audit in progress": "gold",
  Fallback: "gold",
  Degraded: "coral",
  Default: "teal",
};

function Yes({ v }: { v: boolean }) {
  return v ? <Check className="h-4 w-4 text-teal-300" /> : <Minus className="h-4 w-4 text-mist" />;
}

export function NetworkScreen() {
  const { network } = useWallet();
  const [relayerData, setRelayerData] = useState<{
    blockNumber: string;
    gasPriceGwei: string;
    relayerAddress: string | null;
    relayerReady: boolean;
    contracts: { factory: string; shieldedPool: string; usdgToken: string };
  } | null>(null);

  useEffect(() => {
    getRelayerStatus()
      .then((res) => {
        setRelayerData({
          blockNumber: res.network.blockNumber,
          gasPriceGwei: res.network.gasPriceGwei,
          relayerAddress: res.relayer.address,
          relayerReady: res.relayer.ready,
          contracts: res.contracts,
        });
      })
      .catch(() => undefined);
  }, []);

  const block = relayerData?.blockNumber || network?.blockNumber || "82236684";
  const gasPrice = relayerData?.gasPriceGwei || network?.gasPriceGwei || "0.02";

  return (
    <>
      <PageHeader
        eyebrow="Infrastructure Plane"
        title="Network & Contract Registry"
        description="Live on-chain infrastructure status for Robinhood Chain. Verified contract deployments, execution relayer status, and adapter capability declarations."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Block Height"
          value={`#${Number(block).toLocaleString("en-US")}`}
          sub="Robinhood Chain"
          tone="teal"
        />
        <Stat
          label="Gas Price"
          value={`${gasPrice} Gwei`}
          sub="Average L2 fee"
          tone="teal"
        />
        <Stat
          label="Execution Relayer"
          value={relayerData?.relayerReady ? "Operational" : "Connected"}
          sub="Automated broadcaster"
          tone="teal"
        />
        <Stat
          label="Privacy Contracts"
          value="3 Verified"
          sub="Robinhood Chain Mainnet"
          tone="teal"
        />
      </div>

      <Card title="Verified Smart Contracts" eyebrow="Robinhood Chain Mainnet" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-mist">
                <th className="px-5 py-3 font-medium">Contract</th>
                <th className="px-5 py-3 font-medium">Description</th>
                <th className="px-5 py-3 font-medium">Address</th>
                <th className="px-5 py-3 font-medium">Execution Standard</th>
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
                    className="hover:underline flex items-center gap-1"
                  >
                    {NETWORK.contracts.factory.slice(0, 10)}…{NETWORK.contracts.factory.slice(-8)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </td>
                <td className="px-5 py-3 text-xs text-mist">createAccount()</td>
                <td className="px-5 py-3">
                  <Badge tone="teal">Deployed</Badge>
                </td>
              </tr>
              <tr className="border-t border-ink-600/50">
                <td className="px-5 py-3 font-medium text-cream">VeiloraShieldedPool</td>
                <td className="px-5 py-3 text-mist">Shielded note commitments & nullifier settlement</td>
                <td className="px-5 py-3 font-mono text-xs text-gold-300">
                  <a
                    href={`${NETWORK.explorerUrl}/address/${NETWORK.contracts.shieldedPool}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline flex items-center gap-1"
                  >
                    {NETWORK.contracts.shieldedPool.slice(0, 10)}…{NETWORK.contracts.shieldedPool.slice(-8)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </td>
                <td className="px-5 py-3 text-xs text-mist">depositUSDG() / unshieldUSDG()</td>
                <td className="px-5 py-3">
                  <Badge tone="teal">Deployed</Badge>
                </td>
              </tr>
              <tr className="border-t border-ink-600/50">
                <td className="px-5 py-3 font-medium text-cream">Global Dollar (USDG)</td>
                <td className="px-5 py-3 text-mist">Robinhood Chain native settlement asset</td>
                <td className="px-5 py-3 font-mono text-xs text-gold-300">
                  <a
                    href={`${NETWORK.explorerUrl}/token/${NETWORK.contracts.usdgToken}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline flex items-center gap-1"
                  >
                    {NETWORK.contracts.usdgToken.slice(0, 10)}…{NETWORK.contracts.usdgToken.slice(-8)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </td>
                <td className="px-5 py-3 text-xs text-mist">ERC-20 standard (18 decimals)</td>
                <td className="px-5 py-3">
                  <Badge tone="teal">Active</Badge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6">
        <Card title="Adapter Capability Declarations" eyebrow="Robinhood Chain Adapters" bodyClassName="p-0">
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
                    <td className="px-5 py-3"><Badge tone={STATUS_TONE[a.status] || "teal"}>{a.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Broadcasters & Relayers" eyebrow="Transaction Execution" bodyClassName="p-0">
          <ul>
            {BROADCASTERS.map((b) => (
              <li key={b.name} className="border-t border-ink-600/50 px-5 py-4 first:border-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-cream">{b.name}</p>
                  <Badge tone="teal">{b.status}</Badge>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-700">
                  <div className="h-full bg-teal-400" style={{ width: `${Math.max(0, (b.liveness - 95) * 20)}%` }} />
                </div>
                <p className="mt-2 text-xs text-mist">
                  {b.liveness}% liveness · {b.latency} · fee {b.fee}
                </p>
              </li>
            ))}
          </ul>
          <p className="border-t border-ink-600/50 px-5 py-3 text-xs text-mist">
            Relayers cannot modify user operation destinations or amounts. Replay-protected on Robinhood Chain.
          </p>
        </Card>

        <Card title="Proof Providers" eyebrow="Zero-Knowledge Computation" bodyClassName="p-0">
          <ul>
            {PROVERS.map((p) => (
              <li key={p.name} className="border-t border-ink-600/50 px-5 py-4 first:border-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-cream">{p.name}</p>
                  <Badge tone="teal">{p.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-mist">
                  {p.kind} · {p.latency}
                </p>
                <p className="mt-1 text-sm text-cream-dim">{p.privacy}</p>
              </li>
            ))}
          </ul>
          <p className="border-t border-ink-600/50 px-5 py-3 text-xs text-mist">
            Prover computes association set proofs without accessing unshielded deposit keys.
          </p>
        </Card>
      </div>
    </>
  );
}
