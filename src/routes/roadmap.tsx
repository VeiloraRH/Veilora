import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Ban, Check, Circle, FileText, LockKeyhole, PencilRuler } from "lucide-react";
import { Orbits, Reveal, SectionTitle, SitePage, useActiveSection } from "@/components/site/chrome";
import { DEFERRED, GATES, METRICS, REVISE, type GateStatus } from "@/content/roadmap";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/roadmap")({
  component: RoadmapPage,
});

const STATUS: Record<GateStatus, { dot: string; pill: string; text: string }> = {
  Building: { dot: "bg-gold-300", pill: "border-gold-400/50 bg-gold-400/10 text-gold-300", text: "text-gold-300" },
  Next: { dot: "bg-teal-300", pill: "border-teal-300/40 bg-teal-300/10 text-teal-300", text: "text-teal-300" },
  Planned: { dot: "bg-cream-dim", pill: "border-cream/20 bg-cream/5 text-cream-dim", text: "text-cream-dim" },
  Later: { dot: "bg-mist", pill: "border-ink-500 bg-ink-800 text-mist", text: "text-mist" },
};

const GATE_IDS = GATES.map((g) => `gate-${g.n}`);

/* Point on the hero's cubic orbit, so gate nodes sit exactly on the drawn curve. */
const P0 = [40, 380];
const P1 = [150, 200];
const P2 = [330, 330];
const P3 = [480, 70];
function onCurve(t: number) {
  const u = 1 - t;
  const f = (i: 0 | 1) => u * u * u * P0[i] + 3 * u * u * t * P1[i] + 3 * u * t * t * P2[i] + t * t * t * P3[i];
  return [f(0), f(1)] as const;
}
const CURVE = `M${P0} C ${P1}, ${P2}, ${P3}`;

function Constellation() {
  const nodes = GATES.map((g, i) => ({ g, p: onCurve(0.06 + (i / (GATES.length - 1)) * 0.88) }));
  return (
    <svg viewBox="0 0 520 440" className="h-auto w-full" role="img" aria-label="Five launch gates along one orbit. Gate 1 is in progress.">
      <defs>
        <linearGradient id="rm-done" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#f7d372" stopOpacity="0" />
          <stop offset="1" stopColor="#f7d372" />
        </linearGradient>
        <radialGradient id="rm-glow">
          <stop offset="0" stopColor="#eaba65" stopOpacity="0.55" />
          <stop offset="1" stopColor="#eaba65" stopOpacity="0" />
        </radialGradient>
        <clipPath id="rm-progress">
          <rect x="0" y="0" width={nodes[0].p[0] + 4} height="440" />
        </clipPath>
      </defs>
      <circle cx="260" cy="220" r="200" stroke="#eaba65" strokeOpacity="0.06" fill="none" />
      <circle cx="260" cy="220" r="140" stroke="#eaba65" strokeOpacity="0.05" fill="none" />
      <path d={CURVE} stroke="#3a4f75" strokeWidth="1.5" strokeDasharray="2 7" strokeLinecap="round" fill="none" />
      <path d={CURVE} stroke="url(#rm-done)" strokeWidth="2" fill="none" clipPath="url(#rm-progress)" />
      {nodes.map(({ g, p: [x, y] }, i) => {
        const current = g.status === "Building";
        const labelLeft = i % 2 === 1;
        return (
          <a key={g.n} href={`#gate-${g.n}`} className="group">
            {current && <circle cx={x} cy={y} r="46" fill="url(#rm-glow)" />}
            {current && (
              <circle cx={x} cy={y} r="14" fill="none" stroke="#f7d372" strokeOpacity="0.6" className="origin-center motion-safe:animate-ping" style={{ transformBox: "fill-box" }} />
            )}
            <circle cx={x} cy={y} r={current ? 11 : 8} fill={current ? "#eaba65" : "#0c142b"} stroke={current ? "#fbe3a6" : "#eaba65"} strokeOpacity={current ? 1 : 0.45} strokeWidth="1.5" />
            <text
              x={labelLeft ? x - 22 : x + 22}
              y={y - 4}
              textAnchor={labelLeft ? "end" : "start"}
              className={cn("fill-cream font-display text-[15px] transition-colors group-hover:fill-gold-300", !current && "fill-cream-dim")}
            >
              Gate {g.n}
            </text>
            <text x={labelLeft ? x - 22 : x + 22} y={y + 14} textAnchor={labelLeft ? "end" : "start"} className="fill-mist text-[11px] uppercase tracking-[0.18em]">
              {g.short}
            </text>
          </a>
        );
      })}
    </svg>
  );
}

function StatusPill({ status }: { status: GateStatus }) {
  const s = STATUS[status];
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em]", s.pill)}>
      <span className="relative flex h-1.5 w-1.5">
        {status === "Building" && <span className={cn("absolute inset-0 rounded-full motion-safe:animate-ping", s.dot)} />}
        <span className={cn("relative h-1.5 w-1.5 rounded-full", s.dot)} />
      </span>
      {status}
    </span>
  );
}

function GateRail() {
  const active = useActiveSection(GATE_IDS);
  const idx = Math.max(0, GATE_IDS.indexOf(active));
  return (
    <nav aria-label="Gates" className="sticky top-28 hidden lg:block">
      <p className="eyebrow">Five gates</p>
      <ol className="relative mt-6">
        <span className="absolute left-[11px] w-px bg-ink-600" style={{ top: `${50 / GATES.length}%`, bottom: `${50 / GATES.length}%` }} />
        <span
          className="absolute left-[11px] w-px bg-gradient-to-b from-gold-300 to-coral-500 transition-[height] duration-500"
          style={{ top: `${50 / GATES.length}%`, height: `${(idx / GATES.length) * 100}%` }}
        />
        {GATES.map((g, i) => (
          <li key={g.n}>
            <a href={`#gate-${g.n}`} className="group relative flex items-center gap-4 py-2.5">
              <span
                className={cn(
                  "relative z-10 grid h-6 w-6 place-items-center rounded-full border text-[11px] transition-colors",
                  i <= idx ? "border-gold-300 bg-ink-900 text-gold-300" : "border-ink-500 bg-ink-900 text-mist",
                  i === idx && "bg-gold-400 text-ink-900",
                )}
              >
                {g.n}
              </span>
              <span className={cn("text-sm transition-colors group-hover:text-gold-300", i === idx ? "text-cream" : "text-mist")}>{g.short}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function RoadmapPage() {
  return (
    <SitePage title="Roadmap — Veilora">
      {/* Hero */}
      <section className="relative -mt-16 overflow-hidden px-4 pb-20 pt-32 sm:-mt-20 sm:px-10 sm:pb-28 sm:pt-40">
        <Orbits className="inset-0 h-full w-full opacity-70" />
        <div className="pointer-events-none absolute -top-40 right-0 h-[520px] w-[520px] rounded-full bg-gold-400/10 blur-[120px]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <p className="eyebrow">Roadmap · Launch strategy</p>
            <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.02] text-cream sm:text-7xl">
              Earn trust
              <br />
              <span className="font-brand text-6xl italic font-medium text-brand-gradient sm:text-8xl">one gate</span>
              <br />
              at a time.
            </h1>
            <p className="mt-7 max-w-xl text-base leading-relaxed text-mist sm:text-lg">
              Veilora ships in gates, not dates. Each gate has to be trustworthy on its own before the next one opens: wallet safety, everyday flows, reliable swaps, and broader asset coverage.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              {(Object.keys(STATUS) as GateStatus[]).map((s) => (
                <StatusPill key={s} status={s} />
              ))}
            </div>
          </div>
          <Reveal>
            <div className="relative mx-auto w-full max-w-[520px]">
              <Constellation />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Principles */}
      <section className="px-4 sm:px-10">
        <div className="mx-auto grid max-w-6xl gap-px overflow-hidden rounded-2xl border border-ink-600/60 bg-ink-600/40 md:grid-cols-3">
          {[
            ["Wallet", "Flows", "Secure key handling and signed authorization come before convenience features."],
            ["Quotes", "Swaps", "Show route, minimum output, and expiry before the user signs."],
            ["One chain", "Many", "Robinhood Chain first. Add networks only after current flows are dependable."],
          ].map(([a, b, d], i) => (
            <Reveal key={a} delay={i * 90} className="h-full">
              <div className="h-full bg-ink-900 p-7">
                <p className="flex items-center gap-3 font-display text-2xl text-cream">
                  {a} <ArrowRight className="h-5 w-5 text-gold-400" /> <span className="text-mist">{b}</span>
                </p>
                <p className="mt-3 text-sm leading-relaxed text-mist">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Gates */}
      <section className="px-4 py-24 sm:px-10 sm:py-32">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[220px_1fr]">
          <div>
            <GateRail />
          </div>
          <div className="space-y-8">
            {GATES.map((g) => {
              const current = g.status === "Building";
              return (
                <Reveal key={g.n}>
                  <article
                    id={`gate-${g.n}`}
                    className={cn(
                      "group relative scroll-mt-28 overflow-hidden rounded-3xl border bg-ink-850/60 p-6 sm:p-10",
                      current ? "border-gold-400/40 shadow-[0_0_80px_-30px_rgba(234,186,101,0.5)]" : "border-ink-600/60",
                    )}
                  >
                    {current && <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold-400/10 blur-3xl" />}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute -right-2 -top-10 select-none font-display text-[180px] font-bold leading-none text-transparent sm:text-[240px]"
                      style={{ WebkitTextStroke: current ? "1px rgba(234,186,101,0.35)" : "1px rgba(58,79,117,0.7)" }}
                    >
                      {String(g.n).padStart(2, "0")}
                    </span>
                    <div className="relative">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-xs uppercase tracking-[0.24em] text-mist">Gate {g.n}</span>
                        <StatusPill status={g.status} />
                      </div>
                      <h2 className="mt-4 max-w-xl font-display text-3xl font-semibold leading-tight text-cream sm:text-5xl">{g.name}</h2>
                      <p className="mt-4 max-w-xl text-base leading-relaxed text-mist">{g.why}</p>
                      <ul className="mt-8 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                        {g.items.map((it) => (
                          <li key={it} className="flex items-start gap-3 text-sm text-cream-dim">
                            <span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border", current ? "border-gold-400/60 text-gold-300" : "border-ink-500 text-ink-500")}>
                              {current ? <Check className="h-3 w-3" /> : <Circle className="h-1.5 w-1.5 fill-current" />}
                            </span>
                            {it}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-8 flex items-start gap-3 rounded-2xl border border-ink-600/60 bg-ink-950/50 px-5 py-4">
                        <LockKeyhole className={cn("mt-0.5 h-4 w-4 shrink-0", STATUS[g.status].text)} />
                        <p className="text-sm text-cream-dim">
                          <span className="text-mist">{g.n < GATES.length ? `Gate ${g.n + 1} opens when ` : "Done when "}</span>
                          {g.opens.charAt(0).toLowerCase() + g.opens.slice(1)}
                        </p>
                      </div>
                    </div>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Revise and defer */}
      <section className="relative overflow-hidden px-4 py-24 sm:px-10">
        <Orbits className="-left-40 top-0 h-[600px] w-[1200px] rotate-180 opacity-50" />
        <div className="relative mx-auto max-w-6xl">
          <SectionTitle eyebrow="What we won't rush" title={<>Some ideas wait. <span className="font-brand italic font-medium text-gold-300">On purpose.</span></>}>
            A roadmap is also a list of things we have decided not to do yet. These are reworked before they ship, or left out until the product earns them.
          </SectionTitle>
          <div className="mt-14 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <Reveal>
              <div className="h-full rounded-3xl border border-ink-600/60 bg-ink-850/60 p-7 sm:p-9">
                <p className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-teal-300">
                  <PencilRuler className="h-4 w-4" /> Revise before building
                </p>
                <dl className="mt-6 divide-y divide-ink-600/60">
                  {REVISE.map(([t, d]) => (
                    <div key={t} className="grid gap-1 py-4 sm:grid-cols-[180px_1fr] sm:gap-6">
                      <dt className="font-display text-lg text-cream">{t}</dt>
                      <dd className="text-sm leading-relaxed text-mist">{d}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="h-full rounded-3xl border border-dashed border-coral-400/30 bg-ink-950/40 p-7 sm:p-9">
                <p className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-coral-400">
                  <Ban className="h-4 w-4" /> Not on the roadmap
                </p>
                <ul className="mt-6 space-y-3">
                  {DEFERRED.map((d) => (
                    <li key={d} className="flex items-start gap-3 rounded-xl border border-ink-600/50 px-4 py-3 text-sm text-cream-dim">
                      <span className="mt-2 h-px w-3 shrink-0 bg-coral-400/70" />
                      {d}
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-xs leading-relaxed text-mist">Token design, governance and fee capture need their own product, legal and security decision.</p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Metrics */}
      <section className="px-4 py-24 sm:px-10">
        <div className="mx-auto max-w-6xl">
          <SectionTitle eyebrow="How we'll know" title="Measured by control, not by volume.">
            We measure whether people can understand, authorize, and reconcile their wallet activity safely.
          </SectionTitle>
          <div className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-ink-600/60 bg-ink-600/40 sm:grid-cols-2 lg:grid-cols-4">
            {METRICS.map((m, i) => (
              <div key={m.area} className="bg-ink-900 p-7">
                <span className="font-display text-sm text-ink-500">0{i + 1}</span>
                <h3 className="mt-2 font-brand text-3xl font-semibold text-cream">{m.area}</h3>
                <ul className="mt-5 space-y-2.5">
                  {m.items.map((it) => (
                    <li key={it} className="flex gap-2.5 text-sm leading-snug text-mist">
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-gold-400" />
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-24 sm:px-10">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl border border-gold-400/30 bg-gradient-to-br from-ink-800 via-ink-850 to-ink-950 p-8 sm:p-14">
          <Orbits className="inset-0 h-full w-full opacity-60" />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="eyebrow">The reasoning behind every gate</p>
              <h2 className="mt-4 max-w-2xl font-display text-3xl font-semibold leading-tight text-cream sm:text-5xl">Read the integrated product approach.</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/whitepaper" className="inline-flex items-center gap-2 rounded-lg bg-gold-400 px-6 py-3 text-sm font-medium text-ink-900 hover:bg-gold-300">
                <FileText className="h-4 w-4" /> Whitepaper
              </Link>
              <Link to="/app" className="inline-flex items-center gap-2 rounded-lg border border-cream/30 px-6 py-3 text-sm text-cream hover:border-gold-400 hover:text-gold-300">
                Try Gate 1 <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </SitePage>
  );
}
