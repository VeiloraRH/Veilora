import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowDown, ArrowRight, Check, CircleAlert, Cpu, Download, EyeOff, Fingerprint, Laptop, Server, SlidersHorizontal, X } from "lucide-react";
import { Orbits, Reveal, SitePage, useActiveSection } from "@/components/site/chrome";
import { DEFERRED, GATES, METRICS, REVISE } from "@/content/roadmap";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/whitepaper")({
  component: WhitepaperPage,
});

const PDF = "/docs/veilora-integrated-product-approach.pdf";

const TOC = [
  ["thesis", "The integrated thesis"],
  ["architecture", "Three planes"],
  ["together", "How the planes work together"],
  ["experience", "The user experience"],
  ["privacy", "Privacy model"],
  ["assets", "Shielded assets and DeFi"],
  ["custody", "Threshold custody"],
  ["network", "Broadcasters and provers"],
  ["developers", "Developer architecture"],
  ["launch", "Launch strategy"],
  ["language", "Claims and language"],
  ["decisions", "Architecture decisions"],
  ["metrics", "Success metrics"],
  ["definition", "Product definition"],
] as const;
const TOC_IDS = TOC.map(([id]) => id);

/* Plane colours, used consistently in every figure. */
const PLANE = {
  control: { label: "Control", text: "text-gold-300", border: "border-gold-400/40", bg: "bg-gold-400/10", dot: "bg-gold-300" },
  privacy: { label: "Privacy", text: "text-teal-300", border: "border-teal-300/40", bg: "bg-teal-300/10", dot: "bg-teal-300" },
  execution: { label: "Execution", text: "text-coral-400", border: "border-coral-400/40", bg: "bg-coral-400/10", dot: "bg-coral-400" },
} as const;
type Plane = keyof typeof PLANE;

/* ---------- prose primitives ---------- */

function Section({ id, n, title, kicker, children }: { id: string; n: number; title: string; kicker?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-ink-600/50 pt-16 pb-6 first:border-t-0 first:pt-0">
      <div className="flex items-baseline gap-4">
        <span className="font-mono text-sm text-gold-400">§{String(n).padStart(2, "0")}</span>
        {kicker && <span className="text-xs uppercase tracking-[0.24em] text-mist">{kicker}</span>}
      </div>
      <h2 className="mt-3 font-brand text-4xl font-semibold leading-[1.05] text-cream sm:text-5xl">{title}</h2>
      <div className="mt-8 space-y-6 text-[15.5px] leading-[1.8] text-cream-dim">{children}</div>
    </section>
  );
}

function H3({ children }: { children: ReactNode }) {
  return <h3 className="!mt-12 font-display text-xl font-semibold text-cream">{children}</h3>;
}

function Bullets({ items, tone = "gold", cols }: { items: readonly string[]; tone?: "gold" | "teal" | "coral"; cols?: boolean }) {
  const dot = tone === "teal" ? "bg-teal-300" : tone === "coral" ? "bg-coral-400" : "bg-gold-400";
  return (
    <ul className={cn("grid gap-x-8 gap-y-2.5", cols && "sm:grid-cols-2")}>
      {items.map((i) => (
        <li key={i} className="flex gap-3 text-[15px] leading-relaxed">
          <span className={cn("mt-[11px] h-1 w-1 shrink-0 rounded-full", dot)} />
          <span>{i}</span>
        </li>
      ))}
    </ul>
  );
}

function Quote({ children, by }: { children: ReactNode; by?: string }) {
  return (
    <figure className="relative !my-10 border-l-2 border-gold-400 pl-6 sm:pl-8">
      <blockquote className="font-brand text-2xl italic leading-snug text-cream sm:text-[28px]">{children}</blockquote>
      {by && <figcaption className="mt-3 text-xs uppercase tracking-[0.22em] text-mist">{by}</figcaption>}
    </figure>
  );
}

function Figure({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <figure className={cn("!my-10", className)}>
      <div className="overflow-hidden rounded-2xl border border-ink-600/60 bg-ink-850/70 p-5 sm:p-7">{children}</div>
      <figcaption className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-mist">{label}</figcaption>
    </figure>
  );
}

function Request({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-600/60 bg-ink-950/60 p-5">
      <p className="text-[11px] uppercase tracking-[0.18em] text-mist">User request</p>
      <p className="mt-2 font-display text-lg leading-snug text-cream">“{children}”</p>
    </div>
  );
}

/* ---------- figures ---------- */

const LOOP = ["Describe", "Simulate", "Shield", "Check", "Authorize", "Execute", "Prove"];

function LoopFigure() {
  return (
    <Figure label="Fig. 1 — The control loop">
      <ol className="flex flex-wrap items-center gap-y-3">
        {LOOP.map((s, i) => (
          <li key={s} className="flex items-center">
            <span className={cn("rounded-full border px-3.5 py-1.5 text-sm", i === 2 || i === 6 ? "border-teal-300/40 text-teal-300" : "border-gold-400/40 text-gold-300")}>
              <span className="mr-1.5 font-mono text-[10px] opacity-60">{i + 1}</span>
              {s}
            </span>
            {i < LOOP.length - 1 && <ArrowRight className="mx-1.5 h-3.5 w-3.5 text-ink-500" />}
          </li>
        ))}
      </ol>
      <p className="mt-5 text-sm text-mist">Describe a goal → simulate the effect → shield or unshield intentionally → check policy and provenance → authorize with quorum → execute atomically → prove or disclose only what is necessary.</p>
    </Figure>
  );
}

const PLANES: { key: Plane; icon: typeof Cpu; q: string; role: string; parts: string[]; duties: string[] }[] = [
  {
    key: "control",
    icon: SlidersHorizontal,
    q: "What do I want to happen?",
    role: "The experience layer, and the main difference from a conventional privacy pool.",
    parts: ["Command Center", "Intent Console", "Simulation and quote engine", "Policy and guardrail engine", "Outbox and approvals", "Recovery and security center", "Local audit trail", "Developer SDK"],
    duties: ["Turn natural-language goals into structured plans", "Show balances, fees, routes, timing and risk before signing", "Prevent stale, over-limit or underfunded actions", "Keep human authorization mandatory", "Make every state and failure explainable"],
  },
  {
    key: "privacy",
    icon: EyeOff,
    q: "Who can see what?",
    role: "Veilora's shielded execution layer.",
    parts: ["Shielded UTXO-style notes", "Join-split circuits and commitments", "Shield / unshield flows", "Shielded receive addresses", "View-key and disclosure registry", "Clean-provenance proofs", "Proof-provider / PPOI integration", "Ragequit or escape path"],
    duties: ["Reduce needless exposure of balances and relationships", "Allow selective disclosure to auditors, counterparties and tax tools", "Check clean provenance without publishing the full book", "Keep privacy claims specific to the mechanism used"],
  },
  {
    key: "execution",
    icon: Cpu,
    q: "How does it settle?",
    role: "The chain and protocol adapter layer.",
    parts: ["Robinhood Chain adapter", "ERC-4337 account abstraction", "DEX adapters", "Bridge and RelayAdapt adapters", "Morpho lending adapter", "Uniswap V3/V4-style swaps", "Relayer / broadcaster network", "Settlement monitor"],
    duties: ["Execute approved plans on supported networks", "Route shielded DeFi actions atomically when possible", "Keep chain-specific assumptions out of the core", "Publish a capability declaration per adapter"],
  },
];

function PlanesFigure() {
  const [open, setOpen] = useState<Plane>("control");
  const p = PLANES.find((x) => x.key === open)!;
  const c = PLANE[open];
  return (
    <Figure label="Fig. 2 — Three planes, one product">
      <div className="grid gap-2 sm:grid-cols-3" role="tablist">
        {PLANES.map((x, i) => {
          const s = PLANE[x.key];
          const on = x.key === open;
          return (
            <button
              key={x.key}
              role="tab"
              aria-selected={on}
              onClick={() => setOpen(x.key)}
              className={cn("rounded-xl border p-4 text-left transition-colors", on ? cn(s.border, s.bg) : "border-ink-600/60 hover:border-ink-500")}
            >
              <div className="flex items-center justify-between">
                <x.icon className={cn("h-5 w-5", s.text)} />
                <span className="font-mono text-[11px] text-mist">0{i + 1}</span>
              </div>
              <p className="mt-3 font-display text-lg text-cream">{s.label} Plane</p>
              <p className={cn("text-xs italic", s.text)}>{x.q}</p>
            </button>
          );
        })}
      </div>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-mist">Components</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {p.parts.map((x) => (
              <span key={x} className={cn("rounded-md border px-2 py-1 text-xs text-cream-dim", c.border)}>
                {x}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-mist">Responsibilities</p>
          <ul className="mt-3 space-y-2">
            {p.duties.map((d) => (
              <li key={d} className="flex gap-2 text-sm leading-snug text-cream-dim">
                <Check className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", c.text)} />
                {d}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-6 border-t border-ink-600/60 pt-4 text-sm text-mist">{p.role}</p>
    </Figure>
  );
}

const PURCHASE: [Plane, string][] = [
  ["control", "Parse the intent locally"],
  ["execution", "Verify the token, chain and shielded route are supported"],
  ["execution", "Retrieve a route; estimate swap, bridge, proving and execution costs"],
  ["privacy", "Simulate the balance diff and expected shielded note output"],
  ["control", "Check gas reserve, spending limit, fee ceiling, destination and eligibility"],
  ["privacy", "Show what is public, what is shielded and which third parties are involved"],
  ["execution", "Build an atomic plan: shield USDG → swap → receive shielded stock token"],
  ["control", "Require explicit human approval"],
  ["control", "Collect the required threshold signatures"],
  ["execution", "Submit through the execution adapter and track settlement"],
  ["control", "Save a local receipt with plan, proof state, route and note commitment"],
  ["privacy", "Offer a view key or selective disclosure without exposing other positions"],
];

function Pipeline({ steps, label }: { steps: [Plane, string][]; label: string }) {
  return (
    <Figure label={label}>
      <div className="mb-5 flex flex-wrap gap-4">
        {(Object.keys(PLANE) as Plane[]).map((k) => (
          <span key={k} className="flex items-center gap-2 text-xs text-mist">
            <span className={cn("h-2 w-2 rounded-full", PLANE[k].dot)} /> {PLANE[k].label}
          </span>
        ))}
      </div>
      <ol className="relative space-y-0">
        <span className="absolute bottom-4 left-[13px] top-4 w-px bg-ink-600" />
        {steps.map(([k, s], i) => (
          <li key={s} className="relative flex items-start gap-4 py-2">
            <span className={cn("relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border bg-ink-900 font-mono text-[11px]", PLANE[k].border, PLANE[k].text)}>{i + 1}</span>
            <span className="pt-1 text-sm leading-snug text-cream-dim">{s}</span>
          </li>
        ))}
      </ol>
    </Figure>
  );
}

const PPOI = ["Proof requested", "Provider pending", "Proof accepted", "Action eligible"];

function PpoiFigure() {
  return (
    <Figure label="Fig. 6 — Proof standby is an explicit state machine">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {PPOI.map((s, i) => (
          <div key={s} className="flex items-center gap-3 sm:flex-1 sm:flex-col sm:items-stretch">
            <div className={cn("flex-1 rounded-xl border px-3 py-3 text-center text-sm", i === 3 ? "border-teal-300/50 bg-teal-300/10 text-teal-300" : "border-ink-600 text-cream-dim")}>{s}</div>
            {i < PPOI.length - 1 && <ArrowRight className="hidden h-4 w-4 self-center text-ink-500 sm:block sm:rotate-0" />}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3 sm:pl-[12.5%]">
        <ArrowDown className="h-4 w-4 text-coral-400" />
        <div className="rounded-xl border border-dashed border-coral-400/50 bg-coral-400/5 px-4 py-2.5 text-sm text-coral-400">Timeout → safe refund</div>
        <span className="text-xs text-mist">from any pending state</span>
      </div>
      <p className="mt-5 text-sm text-mist">Never a “PPOI missing” limbo: users always know whether funds are safe, delayed or recoverable.</p>
    </Figure>
  );
}

function ShardsFigure() {
  const shards = [
    { icon: Laptop, k: "A", name: "Your device", d: "Local device or desktop secure storage" },
    { icon: Server, k: "B", name: "Policy co-signer", d: "Veilora-run, or deployed by the customer" },
    { icon: Fingerprint, k: "C", name: "Passkey recovery", d: "Passkey or a recovery device" },
  ];
  return (
    <Figure label="Fig. 5 — 2-of-3 threshold authorization">
      <div className="grid gap-3 sm:grid-cols-3">
        {shards.map((s) => (
          <div key={s.k} className="relative rounded-xl border border-gold-400/30 bg-ink-900/60 p-5">
            <span className="absolute right-4 top-3 font-brand text-4xl text-gold-400/25">{s.k}</span>
            <span className="grid h-10 w-10 place-items-center rounded-lg border border-gold-400/40 text-gold-300 shadow-[0_0_30px_-8px_rgba(234,186,101,0.5)]">
              <s.icon className="h-5 w-5" />
            </span>
            <p className="mt-4 font-display text-cream">Shard {s.k} · {s.name}</p>
            <p className="mt-1 text-xs text-mist">{s.d}</p>
          </div>
        ))}
      </div>
      <p className="mt-5 text-center font-mono text-xs uppercase tracking-[0.2em] text-gold-300">Any two sign · one alone cannot</p>
    </Figure>
  );
}

const SDK_LAYERS = [
  ["Core", "Shards, threshold signing, recovery"],
  ["Intent", "Natural-language normalization, structured plans"],
  ["Simulation", "Balance diffs, quotes, fees, slippage, proving, finality"],
  ["Privacy", "Notes, shield/unshield, view keys, disclosures, proof state"],
  ["Policy", "Limits, allowlists, fee ceilings, provenance requirements"],
  ["Adapters", "Chains, DEXs, bridges, lending, relayers, proof providers"],
  ["Observability", "Local receipts, redacted diagnostics, settlement state"],
];

function Code() {
  const k = "text-coral-400";
  const f = "text-gold-300";
  const s = "text-teal-300";
  const v = "text-cream";
  return (
    <Figure label="Fig. 7 — Core SDK interfaces">
      <pre className="-m-5 overflow-x-auto bg-ink-950/70 p-5 font-mono text-[12.5px] leading-relaxed text-mist sm:-m-7 sm:p-7">
        <code>
          <span className={k}>const</span> <span className={v}>plan</span> = <span className={k}>await</span> veilora.intent.<span className={f}>create</span>({"{\n"}
          {"  "}goal: <span className={s}>"Buy 500 USDG of NVDA exposure and keep it shielded"</span>,{"\n"}
          {"  "}constraints: {"{\n"}
          {"    "}maxTotalFeeBps: <span className={f}>75</span>,{"\n"}
          {"    "}preserveGas: <span className={s}>"0.05 ETH"</span>,{"\n"}
          {"    "}requireCleanProvenance: <span className={f}>true</span>,{"\n"}
          {"  }"},{"\n"}
          {"});\n\n"}
          <span className={k}>const</span> <span className={v}>simulation</span> = <span className={k}>await</span> veilora.<span className={f}>simulate</span>(plan);{"\n"}
          <span className={k}>const</span> <span className={v}>policy</span>     = <span className={k}>await</span> veilora.policies.<span className={f}>evaluate</span>(plan, simulation);{"\n"}
          <span className={k}>const</span> <span className={v}>approval</span>   = <span className={k}>await</span> veilora.approvals.<span className={f}>request</span>(plan, simulation, policy);{"\n"}
          <span className={k}>const</span> <span className={v}>result</span>     = <span className={k}>await</span> veilora.<span className={f}>execute</span>(approval);
        </code>
      </pre>
    </Figure>
  );
}

/* ---------- page chrome ---------- */

function ReadingProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const on = () => {
      const h = document.documentElement;
      setP(Math.min(1, h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)));
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return <div className="fixed inset-x-0 top-0 z-50 h-[2px] origin-left bg-brand-gradient" style={{ transform: `scaleX(${p})` }} aria-hidden="true" />;
}

function Toc() {
  const active = useActiveSection(TOC_IDS);
  return (
    <nav aria-label="Contents" className="sticky top-28 hidden max-h-[calc(100vh-8rem)] overflow-y-auto pr-2 lg:block">
      <p className="eyebrow">Contents</p>
      <ol className="mt-5 space-y-0.5 border-l border-ink-600/60">
        {TOC.map(([id, t], i) => (
          <li key={id}>
            <a
              href={`#${id}`}
              className={cn(
                "-ml-px flex gap-3 border-l py-1.5 pl-4 text-[13px] leading-snug transition-colors",
                active === id ? "border-gold-300 text-cream" : "border-transparent text-mist hover:text-cream-dim",
              )}
            >
              <span className={cn("font-mono text-[11px]", active === id ? "text-gold-300" : "text-ink-500")}>{String(i + 1).padStart(2, "0")}</span>
              {t}
            </a>
          </li>
        ))}
      </ol>
      <a href={PDF} download className="mt-8 inline-flex items-center gap-2 text-xs text-gold-300 hover:text-gold-200">
        <Download className="h-3.5 w-3.5" /> Download PDF
      </a>
    </nav>
  );
}

/* ---------- page ---------- */

function WhitepaperPage() {
  return (
    <SitePage title="Whitepaper — Veilora">
      <ReadingProgress />

      {/* Cover */}
      <section className="relative -mt-16 overflow-hidden px-4 pb-16 pt-32 sm:-mt-20 sm:px-10 sm:pb-24 sm:pt-44">
        <Orbits className="inset-0 h-full w-full opacity-80" />
        <div className="pointer-events-none absolute -left-40 top-10 h-[460px] w-[460px] rounded-full bg-teal-400/10 blur-[120px]" />
        <div className="pointer-events-none absolute -right-20 -top-20 h-[420px] w-[420px] rounded-full bg-gold-400/10 blur-[120px]" />
        <div className="relative mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-mist">
            <span className="rounded-full border border-gold-400/40 px-3 py-1 text-gold-300">Whitepaper</span>
            <span>Integrated product approach</span>
            <span className="text-ink-500">/</span>
            <span>Proposed direction</span>
          </div>
          <h1 className="mt-8 max-w-5xl font-brand text-[52px] font-semibold leading-[0.95] text-cream sm:text-8xl lg:text-[112px]">
            Threshold control,
            <br />
            <span className="italic font-medium text-brand-gradient">private execution,</span>
            <br />
            explainable finance.
          </h1>
          <p className="mt-8 max-w-2xl text-base leading-relaxed text-mist sm:text-lg">
            How Veilora combines threshold self-custody, intent planning and shielded execution into one private financial operating layer for Robinhood Chain.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <a href="#thesis" className="inline-flex items-center gap-2 rounded-lg bg-gold-400 px-6 py-3 text-sm font-medium text-ink-900 hover:bg-gold-300">
              Start reading <ArrowDown className="h-4 w-4" />
            </a>
            <a href={PDF} download className="inline-flex items-center gap-2 rounded-lg border border-cream/30 px-6 py-3 text-sm text-cream hover:border-gold-400 hover:text-gold-300">
              <Download className="h-4 w-4" /> Download PDF
            </a>
          </div>
          <dl className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-ink-600/60 bg-ink-600/40 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Status", "Proposed integrated direction"],
              ["Inputs", "Veilora PRD v1 · shielded-finance research"],
              ["Initial network", "Robinhood Chain · 4663"],
              ["Brand line", "Move quietly. Stay in control."],
            ].map(([k, v]) => (
              <div key={k} className="bg-ink-900/90 px-5 py-5">
                <dt className="text-[11px] uppercase tracking-[0.18em] text-mist">{k}</dt>
                <dd className="mt-1.5 text-sm text-cream">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Body */}
      <div className="px-4 pb-24 sm:px-10">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-16">
          <aside>
            <Toc />
          </aside>
          <article className="min-w-0 max-w-3xl">
            <div className="mb-16 flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm leading-relaxed text-cream-dim">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p>
                This is a product and architecture proposal. Claims about market position, competitor behaviour, audits, privacy guarantees, tokenized-stock standards,
                proof-provider availability and production readiness must be independently verified before public use.
              </p>
            </div>

            <Section id="thesis" n={1} title="The integrated thesis" kicker="Abstract">
              <p>Veilora combines two systems that are individually strong but much more valuable together:</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className={cn("rounded-xl border p-5", PLANE.control.border)}>
                  <p className={cn("font-display text-cream")}>Control Plane</p>
                  <p className="mt-1 text-sm leading-relaxed text-mist">Threshold self-custody, intent planning, simulations, policy checks, approvals, recovery and an auditable outbox.</p>
                </div>
                <div className={cn("rounded-xl border p-5", PLANE.privacy.border)}>
                  <p className="font-display text-cream">Privacy Plane</p>
                  <p className="mt-1 text-sm leading-relaxed text-mist">Shielded balances, private notes, selective disclosure, clean-provenance proofs and private DeFi execution.</p>
                </div>
              </div>
              <p>
                The result is not merely a wallet, mixer, privacy pool or treasury dashboard. It is a <em className="text-cream">private financial operating layer</em>.
              </p>
              <Quote by="Product statement">
                Veilora lets people and institutions plan, protect, and execute digital-asset actions privately, with no single point of signing authority and no blind movement
                of funds.
              </Quote>
              <LoopFigure />
              <H3>The core user benefit</H3>
              <p>Veilora should make private finance feel understandable. The user:</p>
              <Bullets
                items={[
                  "Sees the before-and-after state",
                  "Sees what information leaves the device",
                  "Sees the exact policy and proof requirements",
                  "Explicitly authorizes the action",
                  "Can later prove clean provenance or disclose only selected information",
                ]}
              />
            </Section>

            <Section id="architecture" n={2} title="Product architecture: three planes">
              <p>Each plane answers one question. Together they separate what you want, who can see it, and how it settles, so chain-specific details never leak into the decision.</p>
              <PlanesFigure />
            </Section>

            <Section id="together" n={3} title="How the planes work together">
              <H3>Example: shielded stock-token purchase</H3>
              <Request>Buy 500 USDG of NVDA exposure and keep it shielded. Do not proceed if the total cost exceeds 0.75%.</Request>
              <Pipeline steps={PURCHASE} label="Fig. 3 — Twelve steps, three planes, one approval" />
              <H3>Example: private treasury rebalance</H3>
              <Request>Move 20% of idle USDG to Optimism, keep 0.05 ETH reserved for gas, and only use routes under 0.5% total fees.</Request>
              <p>Veilora combines a transparent balance and gas-reserve simulation, bridge route comparison, treasury policy evaluation, outbox review, threshold approval and, where supported, a shielded destination or post-settlement position.</p>
              <p>
                The user should not need to know whether the action uses a transparent ERC-4337 account, a shielded note, a relayer or a bridge solver, unless they open the
                advanced view.
              </p>
            </Section>

            <Section id="experience" n={4} title="The user experience">
              <H3>One command center, two visibility modes</H3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-ink-600/60 bg-ink-850/60 p-5">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-gold-300">Standard mode</p>
                  <p className="mt-1 text-sm text-mist">For everyday users</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {["Send", "Receive", "Swap", "Bridge", "Shield", "Unshield", "Review", "Recover"].map((x) => (
                      <span key={x} className="rounded-full border border-gold-400/30 px-2.5 py-1 text-xs text-cream-dim">
                        {x}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-ink-600/60 bg-ink-850/60 p-5">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-teal-300">Control mode</p>
                  <p className="mt-1 text-sm text-mist">For operators and treasury managers</p>
                  <ul className="mt-4 space-y-1.5 text-xs text-cream-dim">
                    {["Route and proof details", "Note and commitment metadata", "Policy versions and disclosure permissions", "Outbox batch management", "Relayer and provider selection", "Transaction graph and settlement status", "Compliance and audit exports"].map((x) => (
                      <li key={x} className="flex gap-2">
                        <span className="text-teal-300">›</span>
                        {x}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <H3>“Enter privacy mode”</H3>
              <ol className="grid gap-3 sm:grid-cols-3">
                {[
                  ["Choose", "Asset, amount, account or strategy to protect"],
                  ["Preview", "Public balance change, shielded note, fees, reserve"],
                  ["Review", "What chain, co-signer, relayer and prover can see"],
                  ["Confirm", "Clean-provenance and destination checks"],
                  ["Authorize", "Threshold signing and proof generation"],
                  ["Track", "Settlement, note creation and receipt"],
                ].map(([t, d], i) => (
                  <li key={t} className="rounded-xl border border-ink-600/60 p-4">
                    <span className="font-mono text-[11px] text-teal-300">0{i + 1}</span>
                    <p className="mt-1 font-display text-cream">{t}</p>
                    <p className="mt-1 text-xs leading-relaxed text-mist">{d}</p>
                  </li>
                ))}
              </ol>
              <Quote>“Shield” is not a magic button that hides all risk. It is a clear state transition with a before-and-after explanation.</Quote>
              <H3>Safe unshielding</H3>
              <Bullets
                tone="teal"
                items={[
                  "The default destination is the user's verified origin account where possible",
                  "Changing the destination requires a new review and, for higher-risk flows, a cooling-off period",
                  "If a proof provider is unavailable, the state stays explicit: queued, delayed or blocked",
                  "No broadcaster can redirect a user's funds",
                  "Refund and timeout behaviour is deterministic and documented",
                ]}
              />
            </Section>

            <Section id="privacy" n={5} title="Privacy model" kicker="Controls, not a promise">
              <p>Veilora presents privacy as a set of controls, not a binary promise. Each layer states what it protects and what it does not.</p>
              <div className="!my-10 overflow-x-auto rounded-2xl border border-ink-600/60">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="bg-ink-850/80">
                    <tr className="text-[11px] uppercase tracking-[0.18em]">
                      <th className="px-5 py-3.5 font-medium text-mist">Layer</th>
                      <th className="px-5 py-3.5 font-medium text-teal-300">Protects</th>
                      <th className="px-5 py-3.5 font-medium text-coral-400">Does not guarantee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Threshold authorization", "Signing authority", "Hiding public settlement data"],
                      ["Local planning", "Intent text and strategy", "Hiding data a chosen network or provider needs"],
                      ["Shielded notes", "Amounts and relationships within the shield", "That every endpoint or exit is private"],
                      ["Selective disclosure", "Unrelated positions and history", "Privacy from the recipient of what you disclose"],
                    ].map(([l, p, n]) => (
                      <tr key={l} className="border-t border-ink-600/60 align-top">
                        <td className="px-5 py-4 font-brand text-lg text-cream">{l}</td>
                        <td className="px-5 py-4 text-cream-dim">{p}</td>
                        <td className="px-5 py-4 text-mist">{n}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <H3>Clean-provenance proofs</H3>
              <p>
                A proof-of-innocence mechanism proves inclusion in, or exclusion from, a defined set. It reduces the need to disclose an entire wallet history, and has provider,
                freshness and coverage limits. It is never marketed as a universal “clean” guarantee. Every proof shows:
              </p>
              <Bullets cols items={["Provider or association set used", "Set timestamp and freshness", "Assets and routes covered", "Proof validity period", "What the proof reveals", "What happens if the provider is down"]} />
              <H3>View keys and disclosures</H3>
              <p>View keys are scoped and revocable where technically possible, and a user can always see exactly who has access to which information.</p>
              <div className="flex flex-wrap gap-2">
                {["Account-level view key", "Note-level disclosure", "Time-limited auditor access", "Tax-period export", "Counterparty-specific proof", "Revocation and access history"].map((x) => (
                  <span key={x} className="rounded-full border border-teal-300/30 bg-teal-300/5 px-3 py-1.5 text-xs text-teal-300">
                    {x}
                  </span>
                ))}
              </div>
            </Section>

            <Section id="assets" n={6} title="Shielded assets and DeFi">
              <H3>Phase 1 asset focus</H3>
              <p>Start with a small, well-tested set:</p>
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  ["USDG", "Primary stablecoin"],
                  ["USDC / USDT", "Where the adapter supports them correctly"],
                  ["ETH", "Native gas"],
                  ["1–2 stock tokens", "Only once legal, liquidity and pricing are verified"],
                ].map(([a, d]) => (
                  <div key={a} className="rounded-xl border border-ink-600/60 p-4">
                    <p className="font-display text-lg text-gold-300">{a}</p>
                    <p className="mt-1 text-xs leading-relaxed text-mist">{d}</p>
                  </div>
                ))}
              </div>
              <H3>Tokenized stocks are not ordinary ERC-20s</H3>
              <p>Each asset needs:</p>
              <Bullets
                cols
                items={["Issuer and legal wrapper information", "Transfer restrictions and eligibility rules", "Dividend or split behaviour", "Rebase-aware accounting", "Price oracle and stale-price handling", "Shielded note denomination behaviour", "Corporate-action treatment", "Geographic and user eligibility"]}
              />
              <Quote>Veilora's strongest opportunity is shielded tokenized-stock activity on Robinhood Chain, launched only after the asset and legal model are verified.</Quote>
              <H3>Step → Recipe → Combo</H3>
              <Figure label="Fig. 4 — Composable shielded DeFi">
                <div className="grid items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
                  {[
                    ["Step", "shield · swap · lend · withdraw · bridge · unshield"],
                    ["Recipe", "One reusable, policy-checked workflow"],
                    ["Combo", "Atomic multi-step execution, one simulation, one approval"],
                  ].map(([t, d], i) => (
                    <div key={t} className="contents">
                      <div className={cn("rounded-xl border p-4", i === 2 ? "border-gold-400/50 bg-gold-400/10" : "border-ink-600")}>
                        <p className="font-brand text-2xl font-semibold text-cream">{t}</p>
                        <p className="mt-1 text-xs leading-relaxed text-mist">{d}</p>
                      </div>
                      {i < 2 && <ArrowRight className="mx-auto h-4 w-4 rotate-90 self-center text-gold-400 sm:rotate-0" />}
                    </div>
                  ))}
                </div>
              </Figure>
              <p>
                Every recipe declares its inputs and outputs, supported assets and chains, contract addresses and versions, fees and slippage, proof requirements, failure and
                refund behaviour, privacy disclosures, and test and audit status.
              </p>
              <ol className="space-y-2">
                {["Shield USDG", "Shield → swap → receive shielded asset", "Shield → lend → monitor yield position", "Unshield → execute → reshield output", "Bridge → receive → shield at destination, where supported"].map((r, i) => (
                  <li key={r} className="flex items-center gap-4 rounded-lg border border-ink-600/50 px-4 py-2.5 text-sm">
                    <span className="font-mono text-xs text-gold-400">R{i + 1}</span>
                    <span className="font-mono text-[13px] text-cream-dim">{r}</span>
                  </li>
                ))}
              </ol>
            </Section>

            <Section id="custody" n={7} title="Threshold custody integration">
              <p>The original Veilora 2-of-3 architecture remains the authorization backbone.</p>
              <ShardsFigure />
              <H3>Signature and proof order</H3>
              <p>A proof must never be read as approval, and a signature must never be read as a proof. The order is fixed:</p>
              <ol className="grid gap-2 sm:grid-cols-3">
                {["Build intent", "Simulate transparent and shielded effects", "Evaluate policy and provenance", "Generate or validate proof inputs", "Show final plan and disclosures", "Obtain explicit user approval", "Collect threshold signatures", "Submit via permitted broadcaster", "Verify settlement and commitments"].map((s, i) => (
                  <li key={s} className={cn("rounded-lg border px-3.5 py-3 text-sm leading-snug", i === 5 ? "border-gold-400/50 bg-gold-400/10 text-cream" : "border-ink-600/60 text-cream-dim")}>
                    <span className="mr-2 font-mono text-[11px] text-gold-400">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
              <H3>Server trust boundary</H3>
              <p>The co-signer may enforce policy but must not receive more financial information than it needs. Veilora documents:</p>
              <Bullets
                items={[
                  "What the co-signer sees",
                  "Whether it sees amounts, recipients, notes, or only commitments",
                  "What it stores, and for how long",
                  "How a customer can deploy or audit the policy engine",
                  "What happens if the co-signer is unavailable or malicious",
                ]}
              />
              <p>For institutional adoption, a customer-operated or independently deployable Shard B is a strategic goal.</p>
            </Section>

            <Section id="network" n={8} title="Broadcaster and prover network">
              <p>A permissionless broadcaster network can improve UX by paying gas and submitting eligible actions, but it creates a new economic and failure surface.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-coral-400/30 p-5">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-coral-400">Broadcasters must</p>
                  <ul className="mt-3 space-y-1.5 text-sm text-cream-dim">
                    {["Document bonding and slashing", "Publish a fee schedule", "Have no authority to redirect funds", "Enforce replay protection", "Guarantee timeouts and refunds", "Be shown before approval", "Fall back across broadcasters", "Be monitored for censorship"].map((x) => (
                      <li key={x} className="flex gap-2">
                        <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-coral-400" />
                        {x}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-teal-300/30 p-5">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-teal-300">Proving</p>
                  <ul className="mt-3 space-y-1.5 text-sm text-cream-dim">
                    {["Server-assisted proving with blinded witnesses on low-power devices", "Local proving remains the highest-privacy option", "The UI labels where proving happened", "Providers never get raw note contents or unrelated history", "“Under 10 seconds” is a target until measured"].map((x) => (
                      <li key={x} className="flex gap-2">
                        <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-teal-300" />
                        {x}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <PpoiFigure />
            </Section>

            <Section id="developers" n={9} title="Developer architecture">
              <p>Veilora exposes a layered SDK, so developers don't need to understand every privacy primitive to build on it.</p>
              <Code />
              <H3>SDK layers</H3>
              <div className="overflow-hidden rounded-2xl border border-ink-600/60">
                {SDK_LAYERS.map(([n, d], i) => (
                  <div key={n} className="grid grid-cols-[110px_1fr] items-center border-t border-ink-600/60 first:border-t-0 sm:grid-cols-[150px_1fr]">
                    <div className="h-full border-r border-ink-600/60 px-4 py-3" style={{ background: `rgba(234,186,101,${0.03 + i * 0.018})` }}>
                      <span className="font-mono text-[11px] text-gold-400">L{i + 1}</span>
                      <p className="font-display text-sm text-cream">{n}</p>
                    </div>
                    <p className="px-4 py-3 text-sm text-mist">{d}</p>
                  </div>
                ))}
              </div>
              <H3>Adapter contract</H3>
              <p>Every adapter declares:</p>
              <Bullets cols items={["Supported chains and assets", "Transparent and shielded capabilities", "Fee and quote sources", "Proof requirements", "Privacy limitations", "Finality assumptions", "Failure and refund behaviour", "Test, audit and version status"]} />
            </Section>

            <Section id="launch" n={10} title="Launch strategy">
              <p>Veilora ships in five gates. Each must be trustworthy before the next opens.</p>
              <ol className="!my-10 space-y-2">
                {GATES.map((g) => (
                  <li key={g.n} className={cn("flex items-center gap-4 rounded-xl border px-5 py-4", g.status === "Building" ? "border-gold-400/50 bg-gold-400/5" : "border-ink-600/60")}>
                    <span className="font-brand text-3xl font-semibold text-gold-400/80">{g.n}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-cream">{g.name}</p>
                      <p className="truncate text-xs text-mist">{g.items.join(" · ")}</p>
                    </div>
                    <span className="hidden text-[11px] uppercase tracking-[0.18em] text-mist sm:block">{g.status}</span>
                  </li>
                ))}
              </ol>
              <Link to="/roadmap" className="inline-flex items-center gap-2 text-sm font-medium text-gold-300 hover:text-gold-200">
                Open the full roadmap <ArrowRight className="h-4 w-4" />
              </Link>
            </Section>

            <Section id="language" n={11} title="Claims and language guardrails">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-teal-300/30 bg-teal-300/5 p-5">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-teal-300">We say</p>
                  <ul className="mt-4 space-y-2.5">
                    {["Private by default where supported", "Prove clean provenance without exposing your full book", "Threshold authorization with explicit human approval", "Shielded execution for supported assets and protocols", "Selective disclosure through scoped view keys", "Private DeFi on Robinhood Chain, subject to adapter support"].map((x) => (
                      <li key={x} className="flex gap-2.5 text-sm text-cream-dim">
                        <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-teal-300" />“{x}”
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-coral-400/30 bg-coral-400/5 p-5">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-coral-400">We never say</p>
                  <ul className="mt-4 space-y-2.5">
                    {["Untraceable", "Anonymous", "Invisible to everyone", "Guaranteed private", "No one can ever see your transactions", "Risk-free", "Fully decentralized (without a defined standard)"].map((x) => (
                      <li key={x} className="flex gap-2.5 text-sm text-mist line-through decoration-coral-400/60">
                        <X className="mt-1 h-3.5 w-3.5 shrink-0 text-coral-400" />“{x}”
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <Quote by="Positioning, subject to verification">
                Veilora is building a private control layer for tokenized assets and DeFi on Robinhood Chain, combining shielded execution with threshold self-custody and
                explainable intent planning.
              </Quote>
            </Section>

            <Section id="decisions" n={12} title="Privacy architecture decisions">
              <div className="grid gap-3 lg:grid-cols-3">
                <div className="rounded-xl border border-teal-300/30 p-5">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-teal-300">Adopt now</p>
                  <ul className="mt-3 space-y-2 text-sm text-cream-dim">
                    {["Shield / unshield as a first-class action", "Shielded receive addresses", "View keys and selective disclosure", "Clean-provenance proofs", "Shielded DeFi recipe model", "Explicit timeout and refund states", "Mobile proving as a requirement", "Tokenized stocks as the differentiator"].map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-gold-400/30 p-5">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-gold-300">Revise first</p>
                  <ul className="mt-3 space-y-2 text-sm text-cream-dim">
                    {REVISE.map(([t]) => (
                      <li key={t}>{t}</li>
                    ))}
                    <li>“First privacy system” claims</li>
                  </ul>
                </div>
                <div className="rounded-xl border border-dashed border-coral-400/40 p-5">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-coral-400">Defer</p>
                  <ul className="mt-3 space-y-2 text-sm text-mist">
                    {DEFERRED.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <p className="text-sm text-mist">Token design, governance, fee capture and launch mechanics need a separate product, legal and security decision, and are outside the scope of this document.</p>
            </Section>

            <Section id="metrics" n={13} title="Success metrics">
              <div className="grid gap-3 sm:grid-cols-2">
                {METRICS.map((m) => (
                  <div key={m.area} className="rounded-xl border border-ink-600/60 p-5">
                    <p className="font-brand text-2xl font-semibold text-cream">{m.area}</p>
                    <ul className="mt-3 space-y-1.5 text-sm text-mist">
                      {m.items.map((x) => (
                        <li key={x} className="flex gap-2">
                          <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-gold-400" />
                          {x}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <Quote>Do not optimize for shielded TVL or transaction count alone. Measure whether users understand and safely control what they do.</Quote>
            </Section>

            <Section id="definition" n={14} title="Final integrated product definition">
              <p>The strategic advantage is not any single primitive. It is the integration:</p>
              <div className="grid gap-2 sm:grid-cols-4">
                {[
                  ["Privacy Plane", "protects the activity", "text-teal-300"],
                  ["Veilora", "controls the decision", "text-gold-300"],
                  ["Execution layer", "settles the plan", "text-coral-400"],
                  ["Local receipt", "explains what happened", "text-cream"],
                ].map(([a, b, c]) => (
                  <div key={a} className="rounded-xl border border-ink-600/60 p-4">
                    <p className={cn("font-display", c)}>{a}</p>
                    <p className="mt-1 text-xs text-mist">{b}</p>
                  </div>
                ))}
              </div>
              <Reveal>
                <div className="relative !mt-14 overflow-hidden rounded-3xl border border-gold-400/30 bg-gradient-to-br from-ink-800 to-ink-950 p-8 sm:p-12">
                  <Orbits className="inset-0 h-full w-full opacity-60" />
                  <p className="relative font-brand text-2xl leading-snug text-cream sm:text-[32px]">
                    Veilora is a <span className="italic text-brand-gradient">private financial operating layer</span> for Robinhood Chain and compatible networks. It
                    combines threshold self-custody, intent-based planning, local-first simulation, shielded assets, private DeFi recipes, selective disclosure, clean-provenance
                    proofs and explicit human authorization into one explainable control loop.
                  </p>
                  <div className="relative mt-10 flex flex-wrap gap-3">
                    <Link to="/app" className="inline-flex items-center gap-2 rounded-lg bg-gold-400 px-6 py-3 text-sm font-medium text-ink-900 hover:bg-gold-300">
                      Launch the app <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link to="/roadmap" className="inline-flex items-center gap-2 rounded-lg border border-cream/30 px-6 py-3 text-sm text-cream hover:border-gold-400 hover:text-gold-300">
                      See the roadmap
                    </Link>
                  </div>
                </div>
              </Reveal>
            </Section>
          </article>
        </div>
      </div>
    </SitePage>
  );
}
