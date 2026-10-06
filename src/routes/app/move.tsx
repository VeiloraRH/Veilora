import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowDownUp, Check, CircleAlert, Copy, Sparkles } from "lucide-react";
import { ASSETS, VAULT, amount } from "@/demo/data";
import { Badge, Button, Card, DemoNote, Field, KV, PageHeader, Tabs, inputClass } from "@/components/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/move")({
  component: MoveScreen,
});

type Tab = "send" | "receive" | "swap" | "bridge";

const ALLOWLIST = [
  { label: "Payroll (Gusto)", address: "0x51c0…8A2d" },
  { label: "Optimism vault", address: "0x7A3f…C91e" },
  { label: "Arcadia Labs", address: "0x9fE1…04b3" },
];

const ROUTES = [
  { name: "Across", fee: 0.09, time: "~2 min", ok: true },
  { name: "Stargate", fee: 0.31, time: "~6 min", ok: true },
  { name: "Hop", fee: 0.62, time: "~12 min", ok: false },
];

function MoveScreen() {
  const [tab, setTab] = useState<Tab>("send");
  const [queued, setQueued] = useState<string | null>(null);
  const queue = (what: string) => {
    setQueued(what);
    setTimeout(() => setQueued(null), 3500);
  };

  return (
    <>
      <PageHeader
        eyebrow="Move"
        title="Send, receive, swap and bridge."
        description="Everyday moves on Robinhood Chain. Each one is simulated and policy-checked, then waits in the outbox for your approval."
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
      {queued && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-teal-400/40 bg-teal-400/5 px-4 py-3 text-sm text-cream">
          <Check className="h-4 w-4 text-teal-300" /> {queued} added to the outbox.
          <Link to="/app/outbox" className="ml-auto text-xs text-gold-300 hover:text-gold-200">
            Review
          </Link>
        </div>
      )}
      {tab === "send" && <SendForm onQueue={queue} />}
      {tab === "receive" && <ReceivePanel />}
      {tab === "swap" && <SwapForm onQueue={queue} />}
      {tab === "bridge" && <BridgeForm onQueue={queue} />}
    </>
  );
}

function Checks({ items }: { items: { ok: boolean; text: string }[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.text} className="flex gap-2.5 text-sm">
          {i.ok ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" />}
          <span className={i.ok ? "text-cream-dim" : "text-cream"}>{i.text}</span>
        </li>
      ))}
    </ul>
  );
}

function SendForm({ onQueue }: { onQueue: (s: string) => void }) {
  const [to, setTo] = useState(ALLOWLIST[0].address);
  const [amt, setAmt] = useState("1250");
  const [shielded, setShielded] = useState(false);
  const n = Number(amt) || 0;
  const allowlisted = ALLOWLIST.some((a) => a.address === to);
  const big = n > 2500;
  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <Card title="Send USDG" eyebrow="Transfer">
        <div className="space-y-4">
          <Field label="To">
            <input className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            {ALLOWLIST.map((a) => (
              <button key={a.address} onClick={() => setTo(a.address)} className={cn("rounded-full border px-3 py-1 text-xs", to === a.address ? "border-gold-400 text-gold-300" : "border-ink-600 text-mist hover:text-cream")}>
                {a.label}
              </button>
            ))}
          </div>
          <Field label="Amount (USDG)">
            <input className={inputClass} inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^\d.]/g, ""))} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-cream-dim">
            <input type="checkbox" className="accent-[#eaba65]" checked={shielded} onChange={(e) => setShielded(e.target.checked)} />
            Pay from shielded balance (6,250 USDG)
          </label>
        </div>
      </Card>
      <Card title="Review" eyebrow="Simulation">
        <KV k={shielded ? "Shielded USDG" : "Public USDG"} v={<span className="text-coral-400">−{amount(n)}</span>} />
        <KV k="Network fee" v="≈ 0.0011 ETH" />
        <KV k="Visible on-chain" v={shielded ? "A shielded transfer. Not the amount" : "Amount, sender and recipient"} />
        <div className="my-5 h-px bg-ink-600/60" />
        <Checks
          items={[
            { ok: allowlisted, text: allowlisted ? "Destination is allowlisted" : "New destination: needs review and a 24-hour delay" },
            { ok: !big, text: big ? "Over 2,500 USDG: 10-minute cooling-off applies" : "Under the cooling-off threshold" },
            { ok: n <= 10_000, text: "Within the 10,000 USDG daily limit" },
          ]}
        />
        <Button className="mt-6 w-full" disabled={n <= 0 || n > 10_000} onClick={() => onQueue(`Send ${amount(n)} USDG`)}>
          Add to outbox
        </Button>
        <div className="mt-3">
          <DemoNote />
        </div>
      </Card>
    </div>
  );
}

// Deterministic QR-like pattern so the demo has something to scan-look at.
function PseudoQR({ seed }: { seed: string }) {
  const cells = useMemo(() => {
    let h = 2166136261;
    const out: boolean[] = [];
    for (let i = 0; i < 21 * 21; i++) {
      h ^= seed.charCodeAt(i % seed.length) + i;
      h = Math.imul(h, 16777619);
      out.push((h >>> 0) % 3 === 0);
    }
    return out;
  }, [seed]);
  const finder = (x: number, y: number) => {
    const inBox = (ox: number, oy: number) => x >= ox && x < ox + 7 && y >= oy && y < oy + 7;
    for (const [ox, oy] of [[0, 0], [14, 0], [0, 14]]) {
      if (inBox(ox, oy)) {
        const dx = x - ox;
        const dy = y - oy;
        return dx === 0 || dy === 0 || dx === 6 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4) ? 1 : 0;
      }
    }
    return -1;
  };
  return (
    <svg viewBox="-1 -1 23 23" className="h-44 w-44 rounded-lg bg-cream p-1" aria-label="Address QR code (demo)">
      {cells.map((on, i) => {
        const x = i % 21;
        const y = Math.floor(i / 21);
        const f = finder(x, y);
        const fill = f === -1 ? on : f === 1;
        return fill ? <rect key={i} x={x} y={y} width={1} height={1} fill="#0c142b" /> : null;
      })}
    </svg>
  );
}

function ReceivePanel() {
  const [copied, setCopied] = useState("");
  const copy = (v: string) => {
    navigator.clipboard?.writeText(v).catch(() => undefined);
    setCopied(v);
    setTimeout(() => setCopied(""), 1500);
  };
  const rows = [
    { title: "Public address", tone: "coral" as const, badge: "Public", value: VAULT.address, note: "Anyone can see payments to this address and your public balance." },
    { title: "Shielded receive address", tone: "teal" as const, badge: "Shielded", value: VAULT.shieldedAddress, note: "Payments land as shielded notes. The sender sees only that they paid a shielded address." },
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {rows.map((r) => (
        <Card key={r.title} title={r.title} action={<Badge tone={r.tone}>{r.badge}</Badge>}>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <PseudoQR seed={r.value} />
            <div className="min-w-0 flex-1">
              <p className="break-all font-mono text-sm text-cream">{r.value}</p>
              <Button variant="outline" className="mt-3" onClick={() => copy(r.value)}>
                {copied === r.value ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied === r.value ? "Copied" : "Copy"}
              </Button>
              <p className="mt-3 text-xs leading-relaxed text-mist">{r.note}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function SwapForm({ onQueue }: { onQueue: (s: string) => void }) {
  const tokens = ASSETS.filter((a) => a.kind !== "native");
  const [from, setFrom] = useState("USDC");
  const [to, setTo] = useState("USDG");
  const [amt, setAmt] = useState("1000");
  const [keepShielded, setKeepShielded] = useState(false);
  const pf = ASSETS.find((a) => a.symbol === from)!.priceUsd;
  const pt = ASSETS.find((a) => a.symbol === to)!.priceUsd;
  const n = Number(amt) || 0;
  const feeBps = keepShielded ? 31 : 8;
  const out = (n * pf * (1 - feeBps / 10_000)) / pt;
  const toAsset = ASSETS.find((a) => a.symbol === to)!;
  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <Card title="Swap" eyebrow="Uniswap V3 adapter">
        <div className="space-y-4">
          <Field label="From">
            <div className="flex gap-2">
              <select className={cn(inputClass, "w-36")} value={from} onChange={(e) => setFrom(e.target.value)}>
                {tokens.map((t) => (
                  <option key={t.symbol}>{t.symbol}</option>
                ))}
              </select>
              <input className={inputClass} inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^\d.]/g, ""))} />
            </div>
          </Field>
          <button
            onClick={() => {
              setFrom(to);
              setTo(from);
            }}
            className="mx-auto grid h-9 w-9 place-items-center rounded-full border border-ink-600 text-mist hover:border-gold-400 hover:text-gold-300"
            aria-label="Swap direction"
          >
            <ArrowDownUp className="h-4 w-4" />
          </button>
          <Field label="To">
            <div className="flex gap-2">
              <select className={cn(inputClass, "w-36")} value={to} onChange={(e) => setTo(e.target.value)}>
                {tokens.map((t) => (
                  <option key={t.symbol}>{t.symbol}</option>
                ))}
              </select>
              <input className={cn(inputClass, "text-teal-300")} readOnly value={from === to ? "—" : amount(out)} />
            </div>
          </Field>
          <label className="flex items-center gap-2 text-sm text-cream-dim">
            <input type="checkbox" className="accent-[#eaba65]" checked={keepShielded} onChange={(e) => setKeepShielded(e.target.checked)} />
            Receive the output shielded (uses the shield → swap recipe)
          </label>
          {toAsset.kind === "tokenized-stock" && (
            <p className="rounded-lg border border-gold-400/40 bg-gold-400/5 p-3 text-xs text-cream-dim">
              {toAsset.symbol} is a Gate 4 pilot asset. Transfer restrictions, eligibility and corporate actions apply.
            </p>
          )}
        </div>
      </Card>
      <Card title="Quote" eyebrow="Simulation">
        <KV k="Rate" v={from === to ? "—" : `1 ${from} = ${amount(pf / pt, 6)} ${to}`} />
        <KV k="Total cost" v={`${(feeBps / 100).toFixed(2)}%`} />
        <KV k="Max slippage" v="0.30%" />
        <KV k="Route" v={keepShielded ? "Shield → RelayAdapt → Uniswap V3" : "Uniswap V3 (public)"} />
        <KV k="Visible on-chain" v={keepShielded ? "A shield deposit. The swap comes from RelayAdapt" : "The full swap from your vault"} />
        <Button className="mt-6 w-full" disabled={from === to || n <= 0} onClick={() => onQueue(`Swap ${amount(n)} ${from} → ${to}`)}>
          Add to outbox
        </Button>
        <Link to="/app/intent" search={{ goal: `Swap ${amt} ${from} to ${to}${keepShielded ? " and keep it shielded" : ""}` }} className="mt-3 flex items-center justify-center gap-1.5 text-xs text-gold-300 hover:text-gold-200">
          <Sparkles className="h-3.5 w-3.5" /> Plan it in the Intent Console instead
        </Link>
      </Card>
    </div>
  );
}

function BridgeForm({ onQueue }: { onQueue: (s: string) => void }) {
  const [amt, setAmt] = useState("3684.11");
  const [dest, setDest] = useState("Optimism");
  const [ceiling, setCeiling] = useState(0.5);
  const [pick, setPick] = useState("Across");
  const n = Number(amt) || 0;
  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <Card title="Bridge USDG" eyebrow="Robinhood Chain →">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount (USDG)">
              <input className={inputClass} inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^\d.]/g, ""))} />
            </Field>
            <Field label="Destination">
              <select className={inputClass} value={dest} onChange={(e) => setDest(e.target.value)}>
                <option>Optimism</option>
                <option>Base</option>
                <option>Arbitrum</option>
              </select>
            </Field>
          </div>
          <Field label={`Fee ceiling: ${ceiling.toFixed(2)}%`}>
            <input type="range" min={0.05} max={1} step={0.05} value={ceiling} onChange={(e) => setCeiling(Number(e.target.value))} className="w-full accent-[#eaba65]" />
          </Field>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-mist">Routes compared</p>
            <ul className="space-y-2">
              {ROUTES.map((r) => {
                const allowed = r.fee <= ceiling;
                return (
                  <li key={r.name}>
                    <button
                      disabled={!allowed}
                      onClick={() => setPick(r.name)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left text-sm",
                        !allowed ? "cursor-not-allowed border-ink-600/50 opacity-50" : pick === r.name ? "border-gold-400 bg-gold-400/5" : "border-ink-600 hover:border-ink-500",
                      )}
                    >
                      <span className="flex-1 text-cream">{r.name}</span>
                      <span className="text-xs text-mist">{r.time}</span>
                      <span className={cn("w-14 text-right tabular-nums", allowed ? "text-teal-300" : "text-coral-400")}>{r.fee.toFixed(2)}%</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </Card>
      <Card title="Review" eyebrow="Simulation">
        <KV k="You send" v={`${amount(n)} USDG`} />
        <KV k={`You receive on ${dest}`} v={<span className="text-teal-300">{amount(n * (1 - (ROUTES.find((r) => r.name === pick)?.fee ?? 0) / 100), 2)} USDG</span>} />
        <KV k="Gas reserve after" v="0.838 ETH (floor 0.05)" />
        <KV k="Visible on-chain" v="The bridge, amount and both addresses on both chains" />
        <Button className="mt-6 w-full" disabled={n <= 0 || (ROUTES.find((r) => r.name === pick)?.fee ?? 99) > ceiling} onClick={() => onQueue(`Bridge ${amount(n)} USDG to ${dest}`)}>
          Add to outbox
        </Button>
        <p className="mt-3 text-xs text-mist">Bridged funds arrive public. Shielding at the destination is a Gate 5 recipe.</p>
      </Card>
    </div>
  );
}
