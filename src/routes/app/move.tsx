import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDownUp, Check, CircleAlert, Copy, Sparkles, Send } from "lucide-react";
import { ROBINHOOD_TOKEN_REGISTRY } from "@/lib/tokens";
import { useWallet } from "@/lib/walletContext";
import {
  Badge,
  Button,
  Card,
  Field,
  KV,
  PageHeader,
  StatusModal,
  Tabs,
  inputClass,
} from "@/components/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/move")({
  component: MoveScreen,
});

type Tab = "send" | "receive" | "swap" | "bridge";

const ALLOWLIST = [
  { label: "Payroll Distribution", address: "0x51c072bE892a0Fe861A721Ea648D4a18928A8A2d" },
  { label: "Operational Reserve", address: "0x7A3f9c2E41b8D05a6F1e3C27b94d0aE58c1FC91e" },
  { label: "Verified Vendor", address: "0x9fE129B7Fca8406798031d6833c8b417eC0104b3" },
];

const ROUTES = [
  { name: "Across Protocol", fee: 0.09, time: "~2 min", ok: true },
  { name: "Stargate Finance", fee: 0.31, time: "~6 min", ok: true },
  { name: "Robinhood Native Bridge", fee: 0.15, time: "~3 min", ok: true },
];

export function MoveScreen() {
  const [tab, setTab] = useState<Tab>("send");

  // Status Modal for outbox queueing and notifications
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

  const handleQueueSuccess = (actionName: string, details?: string) => {
    setStatusModal({
      open: true,
      type: "success",
      title: "Action Added to Outbox",
      message: `"${actionName}" has been simulated and placed in your outbox awaiting 2-of-3 threshold approval.`,
      details,
    });
  };

  return (
    <>
      <PageHeader
        eyebrow="Transactions"
        title="Send, Receive, Swap & Bridge"
        description="Everyday asset movements on Robinhood Chain. Every transaction is simulated, checked against your policy rules, and authorized with 2-of-3 keys."
        actions={
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { id: "send", label: "Send" },
              { id: "receive", label: "Receive" },
              { id: "swap", label: "Swap" },
              { id: "bridge", label: "Bridge" },
            ]}
          />
        }
      />

      {tab === "send" && <SendForm onQueue={handleQueueSuccess} />}
      {tab === "receive" && <ReceivePanel />}
      {tab === "swap" && <SwapForm onQueue={handleQueueSuccess} />}
      {tab === "bridge" && <BridgeForm onQueue={handleQueueSuccess} />}

      <StatusModal
        open={statusModal.open}
        onClose={() => setStatusModal((s) => ({ ...s, open: false }))}
        type={statusModal.type}
        title={statusModal.title}
        message={statusModal.message}
        details={
          statusModal.details ? (
            <p className="rounded-lg border border-ink-600 bg-ink-950/60 p-3 font-mono text-xs text-gold-200 whitespace-pre-wrap">
              {statusModal.details}
            </p>
          ) : undefined
        }
      />
    </>
  );
}

function Checks({ items }: { items: { ok: boolean; text: string }[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.text} className="flex gap-2.5 text-sm">
          {i.ok ? (
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />
          ) : (
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" />
          )}
          <span className={i.ok ? "text-cream-dim" : "text-cream"}>{i.text}</span>
        </li>
      ))}
    </ul>
  );
}

function SendForm({ onQueue }: { onQueue: (title: string, details?: string) => void }) {
  const [to, setTo] = useState(ALLOWLIST[0].address);
  const [amt, setAmt] = useState("1250");
  const [shielded, setShielded] = useState(false);
  const n = Number(amt) || 0;
  const allowlisted = ALLOWLIST.some((a) => a.address.toLowerCase() === to.toLowerCase());

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <Card title="Send USDG" eyebrow="Transfer Funds">
        <div className="space-y-4">
          <Field label="Recipient Address">
            <input
              className={inputClass}
              value={to}
              onChange={(e) => setTo(e.target.value.trim())}
              placeholder="0x…"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            {ALLOWLIST.map((a) => (
              <button
                key={a.address}
                onClick={() => setTo(a.address)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  to.toLowerCase() === a.address.toLowerCase()
                    ? "border-gold-400 text-gold-300"
                    : "border-ink-600 text-mist hover:text-cream"
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
          <Field label="Amount (USDG)">
            <input
              className={inputClass}
              inputMode="decimal"
              value={amt}
              onChange={(e) => setAmt(e.target.value.replace(/[^\d.]/g, ""))}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-cream-dim cursor-pointer">
            <input
              type="checkbox"
              className="accent-[#eaba65]"
              checked={shielded}
              onChange={(e) => setShielded(e.target.checked)}
            />
            Pay from private shielded balance
          </label>
        </div>
      </Card>

      <Card title="Review & Simulation" eyebrow="Pre-Flight Checks">
        <div className="space-y-2 text-sm">
          <KV
            k={shielded ? "Shielded Balance Delta" : "Public Balance Delta"}
            v={<span className="text-coral-400 font-semibold">−{n.toLocaleString("en-US")} USDG</span>}
          />
          <KV k="Estimated Gas Fee" v="≈ 0.0001 ETH" />
          <KV
            k="Privacy Plane"
            v={shielded ? "Shielded Transfer (Nullifier Settled)" : "Public Transfer"}
          />
        </div>
        <div className="my-5 h-px bg-ink-600/60" />
        <Checks
          items={[
            {
              ok: allowlisted,
              text: allowlisted
                ? "Recipient is on your approved allowlist"
                : "New destination address requires verification",
            },
            {
              ok: n <= 10000,
              text: `${n.toLocaleString("en-US")} USDG within daily limit (10,000 USDG)`,
            },
            {
              ok: true,
              text: "Gas reserve remains protected above 0.05 ETH floor",
            },
          ]}
        />
        <Button
          className="mt-6 w-full"
          disabled={n <= 0 || !to}
          onClick={() =>
            onQueue(
              `Send ${n.toLocaleString("en-US")} USDG`,
              `Recipient: ${to}\nSource: ${shielded ? "Shielded Pool" : "Public Account"}`
            )
          }
        >
          <Send className="h-4 w-4" /> Add to Outbox for Signing
        </Button>
      </Card>
    </div>
  );
}

function ReceivePanel() {
  const { wallet } = useWallet();
  const [copied, setCopied] = useState("");
  const copy = (v: string) => {
    navigator.clipboard?.writeText(v).catch(() => undefined);
    setCopied(v);
    setTimeout(() => setCopied(""), 1500);
  };

  const currentAddress = wallet?.address || "0x5e4ae3b279fcC9c470dF26875906D808BdE5B163";

  const rows = [
    {
      title: "Public Smart Account Address",
      badge: "Public",
      tone: "coral" as const,
      value: currentAddress,
      note: "Standard transfers to this address are visible on Robinhood Chain.",
    },
    {
      title: "Shielded Privacy Address",
      badge: "Shielded",
      tone: "teal" as const,
      value: currentAddress,
      note: "Deposits can be shielded into private zero-knowledge notes.",
    },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {rows.map((r) => (
        <Card key={r.title} title={r.title} action={<Badge tone={r.tone}>{r.badge}</Badge>}>
          <div className="space-y-4">
            <p className="break-all font-mono text-sm text-cream bg-ink-950/60 p-3 rounded-lg border border-ink-600">
              {r.value}
            </p>
            <Button variant="outline" className="w-full" onClick={() => copy(r.value)}>
              {copied === r.value ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied === r.value ? "Copied" : "Copy Address"}
            </Button>
            <p className="text-xs leading-relaxed text-mist">{r.note}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}

function SwapForm({ onQueue }: { onQueue: (title: string, details?: string) => void }) {
  const tokens = Object.values(ROBINHOOD_TOKEN_REGISTRY);
  const [from, setFrom] = useState("USDG");
  const [to, setTo] = useState("NVDA");
  const [amt, setAmt] = useState("500");
  const [keepShielded, setKeepShielded] = useState(true);

  const n = Number(amt) || 0;
  const toToken = ROBINHOOD_TOKEN_REGISTRY[to];

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <Card title="Token Swap" eyebrow="Uniswap V3 on Robinhood Chain">
        <div className="space-y-4">
          <Field label="From Asset">
            <div className="flex gap-2">
              <select
                className={cn(inputClass, "w-44")}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              >
                {tokens.map((t) => (
                  <option key={t.symbol} value={t.symbol}>
                    {t.symbol}
                  </option>
                ))}
              </select>
              <input
                className={inputClass}
                inputMode="decimal"
                value={amt}
                onChange={(e) => setAmt(e.target.value.replace(/[^\d.]/g, ""))}
              />
            </div>
          </Field>

          <button
            onClick={() => {
              setFrom(to);
              setTo(from);
            }}
            className="mx-auto grid h-9 w-9 place-items-center rounded-full border border-ink-600 text-mist hover:border-gold-400 hover:text-gold-300 transition-colors"
            aria-label="Invert direction"
          >
            <ArrowDownUp className="h-4 w-4" />
          </button>

          <Field label="To Asset">
            <select
              className={inputClass}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            >
              {tokens.map((t) => (
                <option key={t.symbol} value={t.symbol}>
                  {t.symbol} · {t.name}
                </option>
              ))}
            </select>
          </Field>

          <label className="flex items-center gap-2 text-sm text-cream-dim cursor-pointer">
            <input
              type="checkbox"
              className="accent-[#eaba65]"
              checked={keepShielded}
              onChange={(e) => setKeepShielded(e.target.checked)}
            />
            Keep output shielded (commits to private note)
          </label>
        </div>
      </Card>

      <Card title="Quote & Routing" eyebrow="Simulation">
        <div className="space-y-2 text-sm">
          <KV k="Execution Pair" v={`${from} / ${to}`} />
          <KV k="Target Contract" v={<span className="font-mono text-xs">{toToken?.address ? `${toToken.address.slice(0, 10)}…` : "—"}</span>} />
          <KV k="Fee Ceiling" v="0.30% (30 bps)" />
          <KV
            k="Privacy Mode"
            v={keepShielded ? "Shielded Stock Purchase Recipe" : "Public DEX Execution"}
          />
        </div>

        <Button
          className="mt-6 w-full"
          disabled={from === to || n <= 0}
          onClick={() =>
            onQueue(
              `Swap ${n.toLocaleString("en-US")} ${from} → ${to}`,
              `Pair: ${from} → ${to}\nAmount: ${n} ${from}\nShielded Output: ${keepShielded ? "Yes" : "No"}`
            )
          }
        >
          Add Swap to Outbox
        </Button>
        <Link
          to="/app/intent"
          search={{
            goal: `Swap ${amt} ${from} to ${to}${keepShielded ? " and keep it shielded" : ""}`,
          }}
          className="mt-3 flex items-center justify-center gap-1.5 text-xs text-gold-300 hover:text-gold-200"
        >
          <Sparkles className="h-3.5 w-3.5" /> Plan in Intent Console instead
        </Link>
      </Card>
    </div>
  );
}

function BridgeForm({ onQueue }: { onQueue: (title: string, details?: string) => void }) {
  const [amt, setAmt] = useState("1000");
  const [dest, setDest] = useState("Ethereum Mainnet");
  const [ceiling, setCeiling] = useState(0.5);
  const [pick, setPick] = useState("Across Protocol");
  const n = Number(amt) || 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <Card title="Bridge USDG" eyebrow="Robinhood Chain →">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount (USDG)">
              <input
                className={inputClass}
                inputMode="decimal"
                value={amt}
                onChange={(e) => setAmt(e.target.value.replace(/[^\d.]/g, ""))}
              />
            </Field>
            <Field label="Destination Network">
              <select
                className={inputClass}
                value={dest}
                onChange={(e) => setDest(e.target.value)}
              >
                <option>Ethereum Mainnet</option>
                <option>Base</option>
                <option>Optimism</option>
                <option>Arbitrum</option>
              </select>
            </Field>
          </div>

          <Field label={`Fee Ceiling: ${ceiling.toFixed(2)}%`}>
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={ceiling}
              onChange={(e) => setCeiling(Number(e.target.value))}
              className="w-full accent-[#eaba65]"
            />
          </Field>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-mist">
              Bridge Routes
            </p>
            {ROUTES.map((r) => (
              <button
                key={r.name}
                onClick={() => setPick(r.name)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm transition-colors",
                  pick === r.name
                    ? "border-gold-400 bg-gold-400/5 text-cream"
                    : "border-ink-600 text-cream-dim hover:border-ink-500"
                )}
              >
                <div>
                  <p className="font-medium text-cream">{r.name}</p>
                  <p className="text-xs text-mist">{r.time}</p>
                </div>
                <Badge tone="teal">{r.fee}% fee</Badge>
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card title="Review & Simulation" eyebrow="Simulation">
        <div className="space-y-2 text-sm">
          <KV k="You Send" v={`${n.toLocaleString("en-US")} USDG`} />
          <KV k="Destination Network" v={dest} />
          <KV k="Selected Bridge" v={pick} />
          <KV k="Gas Reserve Status" v={<span className="text-teal-300">Protected (&gt; 0.05 ETH)</span>} />
        </div>
        <Button
          className="mt-6 w-full"
          disabled={n <= 0}
          onClick={() =>
            onQueue(
              `Bridge ${n.toLocaleString("en-US")} USDG to ${dest}`,
              `Bridge Provider: ${pick}\nTarget: ${dest}\nAmount: ${n} USDG`
            )
          }
        >
          Add Bridge Transfer to Outbox
        </Button>
      </Card>
    </div>
  );
}
