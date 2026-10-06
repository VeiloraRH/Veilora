import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ArrowRight, Check, CircleAlert, Cpu, EyeOff, Fingerprint, Laptop, Server, SlidersHorizontal } from "lucide-react";
import { PLANS, RECIPES } from "@/demo/data";
import { Logo, VisibilityBadge } from "@/components/ui";
import { cn } from "@/lib/utils";

/* Thin gold orbit lines, echoing the brand banners. */
function Orbits({ className }: { className?: string }) {
  return (
    <svg className={cn("pointer-events-none absolute", className)} viewBox="0 0 1200 600" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="orbit" x1="0" x2="1">
          <stop offset="0" stopColor="#eaba65" stopOpacity="0" />
          <stop offset="0.5" stopColor="#eaba65" stopOpacity="0.55" />
          <stop offset="1" stopColor="#db6b55" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M-20 520 C 300 360, 700 120, 1220 60" stroke="url(#orbit)" strokeWidth="1.2" />
      <circle cx="0" cy="0" r="520" transform="translate(980 760)" stroke="#eaba65" strokeOpacity="0.07" />
      <circle cx="0" cy="0" r="380" transform="translate(160 -60)" stroke="#eaba65" strokeOpacity="0.06" />
      <circle cx="612" cy="214" r="3" fill="#f7d372" />
    </svg>
  );
}

function SectionTitle({ eyebrow, title, children, center }: { eyebrow: string; title: ReactNode; children?: ReactNode; center?: boolean }) {
  return (
    <div className={cn("max-w-3xl", center && "mx-auto text-center")}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-4 font-display text-4xl font-semibold leading-[1.05] text-cream sm:text-5xl lg:text-6xl">{title}</h2>
      {children && <p className="mt-5 text-base leading-relaxed text-mist sm:text-lg">{children}</p>}
    </div>
  );
}

const LOOP = [
  ["Describe", "Say the goal in plain words."],
  ["Simulate", "See the before and after."],
  ["Shield", "Protect on purpose, not by default magic."],
  ["Check", "Policy and provenance, before signing."],
  ["Authorize", "Two of three keys, and your yes."],
  ["Execute", "Atomically, through approved adapters."],
  ["Prove", "Disclose only what's needed."],
];

const PLANES = [
  {
    icon: SlidersHorizontal,
    n: "01",
    name: "Control Plane",
    q: "What do I want to happen?",
    body: "Intent planning, simulation, policy checks, approvals, recovery and an auditable outbox. Every state and every failure is explained.",
    items: ["Intent Console", "Simulation and quotes", "Policy engine", "Outbox and approvals"],
  },
  {
    icon: EyeOff,
    n: "02",
    name: "Privacy Plane",
    q: "Who can see what?",
    body: "Shielded notes, shield and unshield flows, scoped view keys and clean-provenance proofs. Privacy claims stay specific to the mechanism used.",
    items: ["Shielded balances", "Selective disclosure", "Provenance proofs", "Safe refund paths"],
  },
  {
    icon: Cpu,
    n: "03",
    name: "Execution Plane",
    q: "How does it settle?",
    body: "Adapters for Robinhood Chain, ERC-4337 accounts, DEXs, lending and bridges, with a bonded broadcaster network and settlement monitoring.",
    items: ["Robinhood Chain adapter", "Uniswap and Morpho", "Bridges", "Broadcasters with fallback"],
  },
];

const LAYERS = [
  ["Threshold authorization", "Signing authority", "Does not hide public settlement data"],
  ["Local planning", "Your intent text and strategy", "Does not hide data a chosen network or provider needs"],
  ["Shielded notes", "Amounts and relationships inside the shield", "Does not make every entry or exit private"],
  ["Selective disclosure", "Unrelated positions and history", "Does not keep disclosed data private from its recipient"],
];

const GATES = [
  { n: 1, name: "Trustworthy control core", items: "2-of-3 wallet and recovery · local intents · simulation · policies and outbox · public send, swap, bridge", status: "Building" },
  { n: 2, name: "Shielded payments", items: "Shield and unshield one stablecoin · shielded receive · selective disclosure · provenance proofs", status: "Next" },
  { n: 3, name: "Shielded DeFi", items: "Shielded swap and lending recipes · atomic unshield → execute → reshield · broadcaster failover", status: "Planned" },
  { n: 4, name: "Tokenized stocks", items: "One verified issuer first · corporate-action tests · legal and eligibility review", status: "Planned" },
  { n: 5, name: "Multichain privacy", items: "More chains only once Robinhood Chain is stable · privacy assumptions shown per chain", status: "Later" },
];

const SDK = `const plan = await veilora.intent.create({
  goal: "Buy 500 USDG of NVDA exposure and keep it shielded",
  constraints: {
    maxTotalFeeBps: 75,
    preserveGas: "0.05 ETH",
    requireCleanProvenance: true,
  },
});

const simulation = await veilora.simulate(plan);
const policy     = await veilora.policies.evaluate(plan, simulation);
const approval   = await veilora.approvals.request(plan, simulation, policy);
const result     = await veilora.execute(approval);`;

export function Landing() {
  const plan = PLANS[0];
  return (
    <div className="bg-ink-900 text-cream">
      {/* Statement */}
      <section className="relative overflow-hidden px-5 py-24 sm:px-10 sm:py-32">
        <Orbits className="inset-0 h-full w-full opacity-80" />
        <div className="relative mx-auto max-w-6xl">
          <p className="eyebrow">Move quietly / Stay in control</p>
          <p className="mt-6 max-w-4xl font-display text-4xl leading-[1.1] text-cream sm:text-6xl">
            Plan, protect and execute digital-asset actions privately, with <span className="text-brand-gradient">no single point of signing authority</span> and no blind movement
            of funds.
          </p>
          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-ink-600/60 bg-ink-600/40 sm:grid-cols-3">
            {[
              ["2 of 3", "keys to move anything"],
              ["0", "actions without a simulation you saw"],
              ["4663", "Robinhood Chain, first"],
            ].map(([v, l]) => (
              <div key={l} className="bg-ink-900 px-6 py-7">
                <p className="font-display text-5xl text-gold-300">{v}</p>
                <p className="mt-1 text-sm text-mist">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Control loop */}
      <section id="how-it-works" className="scroll-mt-10 px-5 py-24 sm:px-10">
        <div className="mx-auto max-w-6xl">
          <SectionTitle eyebrow="One explainable loop" title="Say what you want. Review what happens.">
            Veilora turns a goal into a plan, shows you exactly what changes, and waits for your yes. Nothing moves without it.
          </SectionTitle>
          <ol className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
            {LOOP.map(([t, d], i) => (
              <li key={t} className="panel relative p-5">
                <span className="font-display text-3xl text-gold-400/80">{String(i + 1).padStart(2, "0")}</span>
                <p className="mt-3 font-medium text-cream">{t}</p>
                <p className="mt-1 text-sm leading-snug text-mist">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Live example */}
      <section className="px-5 py-24 sm:px-10">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1fr_1.15fr]">
          <SectionTitle eyebrow="Intent-based treasury control" title="From a sentence to a signed plan.">
            Type the goal. Veilora parses it on your device, prices the route, simulates the balances, checks your policies and lists every party that will see something, before
            anything is signed.
          </SectionTitle>
          <div className="panel overflow-hidden">
            <div className="border-b border-ink-600/60 p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-mist">Your goal</p>
              <p className="mt-2 font-display text-xl leading-snug text-cream">“{plan.goal}”</p>
            </div>
            <div className="grid gap-px bg-ink-600/40 sm:grid-cols-2">
              <div className="bg-ink-850 p-5">
                <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-mist">Before → after</p>
                {plan.diff.map((d) => (
                  <div key={d.label} className="flex justify-between gap-2 py-1 text-sm">
                    <span className="text-mist">{d.label}</span>
                    <span className={d.tone === "teal" ? "text-teal-300" : d.tone === "coral" ? "text-coral-400" : "text-cream"}>{d.after}</span>
                  </div>
                ))}
                <div className="mt-3 flex justify-between border-t border-ink-600/60 pt-3 text-sm">
                  <span className="text-mist">Total cost</span>
                  <span className="text-teal-300">0.34% of 0.75% limit</span>
                </div>
              </div>
              <div className="bg-ink-850 p-5">
                <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-mist">Policy</p>
                <ul className="space-y-1.5">
                  {plan.policy.slice(0, 4).map((p) => (
                    <li key={p.rule} className="flex items-center gap-2 text-sm">
                      {p.result === "pass" ? <Check className="h-3.5 w-3.5 text-teal-300" /> : <CircleAlert className="h-3.5 w-3.5 text-gold-300" />}
                      <span className="text-cream-dim">{p.rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="space-y-2.5 border-t border-ink-600/60 p-5">
              {plan.steps.map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-cream-dim">{s.label}</span>
                  <VisibilityBadge v={s.visibility} />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-ink-600/60 bg-ink-950/40 px-5 py-4">
              <span className="text-xs text-mist">Demo plan. Nothing is signed.</span>
              <Link to="/app/intent" search={{ goal: plan.goal }} className="inline-flex items-center gap-1.5 text-sm font-medium text-gold-300 hover:text-gold-200">
                Try it <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Three planes */}
      <section className="px-5 py-24 sm:px-10">
        <div className="mx-auto max-w-6xl">
          <SectionTitle eyebrow="Three planes, one product" title="Control. Privacy. Execution.">
            The advantage isn't any single primitive. It's the integration: privacy protects the activity, Veilora controls the decision, the execution layer settles the approved
            plan, and a local receipt explains what happened.
          </SectionTitle>
          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {PLANES.map((p) => (
              <article key={p.name} className="panel flex flex-col p-7">
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-xl border border-gold-400/40 bg-gold-400/5 text-gold-300">
                    <p.icon className="h-5 w-5" />
                  </span>
                  <span className="font-display text-2xl text-ink-500">{p.n}</span>
                </div>
                <h3 className="mt-6 font-display text-3xl text-cream">{p.name}</h3>
                <p className="mt-1 text-sm italic text-gold-300">{p.q}</p>
                <p className="mt-4 text-sm leading-relaxed text-mist">{p.body}</p>
                <ul className="mt-6 space-y-2 border-t border-ink-600/60 pt-5">
                  {p.items.map((i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-cream-dim">
                      <span className="h-1 w-1 rounded-full bg-gold-400" />
                      {i}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy model */}
      <section id="privacy" className="relative scroll-mt-10 overflow-hidden px-5 py-24 sm:px-10">
        <Orbits className="-right-40 top-0 h-[600px] w-[1200px] rotate-180 opacity-60" />
        <div className="relative mx-auto max-w-6xl">
          <SectionTitle eyebrow="Private by default where supported" title={<>Privacy as controls, <span className="italic text-gold-300">not a promise.</span></>}>
            Every layer says what it protects and what it doesn't. No “untraceable”, no “invisible to everyone”. Just specific mechanisms with stated limits.
          </SectionTitle>
          <div className="mt-14 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.18em] text-mist">
                  <th className="pb-4 pr-6 font-medium">Layer</th>
                  <th className="pb-4 pr-6 font-medium text-teal-300">Protects</th>
                  <th className="pb-4 font-medium text-coral-400">Does not guarantee</th>
                </tr>
              </thead>
              <tbody>
                {LAYERS.map(([l, p, n]) => (
                  <tr key={l} className="border-t border-ink-600/60">
                    <td className="py-5 pr-6 font-display text-2xl text-cream">{l}</td>
                    <td className="py-5 pr-6 text-sm text-cream-dim">{p}</td>
                    <td className="py-5 text-sm text-mist">{n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-2">
            <div className="panel p-7">
              <p className="eyebrow">Clean provenance</p>
              <h3 className="mt-3 font-display text-3xl text-cream">Prove clean provenance without exposing your full book.</h3>
              <p className="mt-3 text-sm leading-relaxed text-mist">
                Proofs show membership in a defined association set. Every proof lists its provider, set date, freshness, coverage, validity and what it reveals, plus what
                happens if the provider is down.
              </p>
            </div>
            <div className="panel p-7">
              <p className="eyebrow">Scoped view keys</p>
              <h3 className="mt-3 font-display text-3xl text-cream">Show your auditor one quarter. Not your life.</h3>
              <p className="mt-3 text-sm leading-relaxed text-mist">
                Account, note, time-limited, tax-period and counterparty keys, each revocable where the scheme allows it, with a full history of who saw what.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Custody */}
      <section className="px-5 py-24 sm:px-10">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <SectionTitle eyebrow="Threshold self-custody" title="No single key can move your funds.">
            Your vault is split three ways. Any two shards sign; one alone can't. The co-signer enforces your policies and sees only what it must, and you can run it yourself.
          </SectionTitle>
          <div className="relative mx-auto aspect-square w-full max-w-[440px]">
            <div className="absolute inset-[14%] rounded-full border border-gold-400/25" />
            <div className="absolute inset-[30%] rounded-full border border-gold-400/10" />
            <div className="absolute inset-0 grid place-items-center">
              <Logo size={110} wordmark={false} />
            </div>
            {[
              { icon: Laptop, label: "A · Your device", pos: "left-1/2 top-0 -translate-x-1/2" },
              { icon: Server, label: "B · Policy co-signer", pos: "bottom-[6%] left-0" },
              { icon: Fingerprint, label: "C · Passkey recovery", pos: "bottom-[6%] right-0" },
            ].map((s) => (
              <div key={s.label} className={cn("absolute flex flex-col items-center gap-2", s.pos)}>
                <span className="grid h-14 w-14 place-items-center rounded-2xl border border-gold-400/50 bg-ink-850 text-gold-300 shadow-[0_0_40px_-8px_rgba(234,186,101,0.45)]">
                  <s.icon className="h-6 w-6" />
                </span>
                <span className="whitespace-nowrap text-xs text-cream-dim">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recipes */}
      <section className="px-5 py-24 sm:px-10">
        <div className="mx-auto max-w-6xl">
          <SectionTitle eyebrow="Shielded DeFi, as recipes" title="Step → Recipe → Combo.">
            Composable workflows with one simulation and one approval. Each declares its contracts, fees, proof needs, failure behaviour and audit status.
          </SectionTitle>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {RECIPES.map((r) => (
              <div key={r.id} className="panel p-5">
                <p className="text-xs text-gold-400">Gate {r.gate}</p>
                <p className="mt-2 font-medium leading-snug text-cream">{r.name}</p>
                <p className="mt-2 text-xs text-mist">{r.steps.join(" → ")}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-mist">
            Tokenized stocks on Robinhood Chain are the long-term edge, and launch only once the asset and legal model are verified.
          </p>
        </div>
      </section>

      {/* Roadmap */}
      <section className="px-5 py-24 sm:px-10">
        <div className="mx-auto max-w-6xl">
          <SectionTitle eyebrow="Launch strategy" title="Earn trust one gate at a time." />
          <ol className="mt-12 border-l border-gold-400/30">
            {GATES.map((g) => (
              <li key={g.n} className="relative pb-10 pl-8 last:pb-0">
                <span className={cn("absolute -left-[7px] top-1.5 h-3.5 w-3.5 rounded-full border-2", g.n === 1 ? "border-gold-300 bg-gold-400" : "border-gold-400/50 bg-ink-900")} />
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <p className="font-display text-3xl text-cream">
                    Gate {g.n} · {g.name}
                  </p>
                  <span className={cn("text-xs uppercase tracking-[0.2em]", g.n === 1 ? "text-gold-300" : "text-mist")}>{g.status}</span>
                </div>
                <p className="mt-2 max-w-3xl text-sm text-mist">{g.items}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Developers */}
      <section id="developers" className="px-5 py-24 sm:px-10">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1fr_1.2fr]">
          <SectionTitle eyebrow="Developer SDK" title="Plans, simulations, policies, approvals.">
            A layered SDK, so you don't need every privacy primitive to build on Veilora: core, intent, simulation, privacy, policy, adapters and observability.
          </SectionTitle>
          <pre className="panel overflow-x-auto p-6 font-mono text-[12.5px] leading-relaxed text-cream-dim">
            <code>{SDK}</code>
          </pre>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative overflow-hidden px-5 py-32 text-center sm:px-10">
        <Orbits className="inset-0 h-full w-full" />
        <div className="relative mx-auto max-w-4xl">
          <img src="/brand/veilora-mark.png" alt="" className="mx-auto h-24 w-24" />
          <h2 className="mt-8 font-display text-5xl font-semibold uppercase leading-[1.02] tracking-wide text-cream sm:text-7xl">
            Think locally.
            <br />
            <span className="text-brand-gradient">Move deliberately.</span>
          </h2>
          <p className="eyebrow mt-8">Your strategy stays with you</p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link to="/app" className="inline-flex items-center gap-2 rounded-lg bg-gold-400 px-6 py-3 text-sm font-medium text-ink-900 hover:bg-gold-300">
              Launch the app <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#developers" className="inline-flex items-center gap-2 rounded-lg border border-cream/30 px-6 py-3 text-sm text-cream hover:border-gold-400 hover:text-gold-300">
              Read the SDK
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-ink-600/60 px-5 py-10 sm:px-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Logo size={28} />
            <p className="mt-2 text-xs text-mist">© 2026 Veilora · Robinhood Chain (4663)</p>
          </div>
          <nav className="flex flex-wrap gap-6 text-sm text-mist">
            <a href="#how-it-works" className="hover:text-gold-300">Product</a>
            <a href="#privacy" className="hover:text-gold-300">Privacy</a>
            <a href="#developers" className="hover:text-gold-300">Developers</a>
            <Link to="/app" className="hover:text-gold-300">App</Link>
          </nav>
        </div>
        <p className="mx-auto mt-8 max-w-6xl text-xs leading-relaxed text-mist/70">
          Veilora is in development. Claims about privacy guarantees, audits, tokenized-stock support and proof providers are subject to independent verification before
          production use. The app shows demo data.
        </p>
      </footer>
    </div>
  );
}
