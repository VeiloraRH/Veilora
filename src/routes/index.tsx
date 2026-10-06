import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Shield,
  EyeOff,
  Sliders,
  CheckCircle2,
  Lock,
  ArrowRight,
  Cpu,
  FileCheck2,
  Layers,
  ChevronRight,
  Database,
  Network
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const [intentInput, setIntentInput] = useState(
    "Buy 500 USDG of NVDA exposure and keep it shielded. Max fee 0.75%."
  );
  const [activeStep, setActiveStep] = useState<number>(1);
  const [simulated, setSimulated] = useState(true);

  return (
    <div className="space-y-24 py-12 px-4 sm:px-6 max-w-6xl mx-auto">
      {/* Hero Section */}
      <section className="text-center space-y-6 pt-8 pb-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>ROBINHOOD CHAIN · CHAIN ID 4663</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-3xl mx-auto leading-tight">
          Move quietly.<br />
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            Stay in control.
          </span>
        </h1>

        <p className="text-base sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Veilora is a private financial operating layer combining threshold self-custody,
          intent-based simulation, and shielded DeFi execution with explainable controls.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <a
            href="#intent-simulator"
            className="px-6 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
          >
            <span>Simulate Intent</span>
            <ArrowRight className="w-4 h-4" />
          </a>
          <a
            href="https://github.com/notadeveloper7/veilora"
            target="_blank"
            rel="noreferrer"
            className="px-6 py-3 rounded-lg bg-slate-800/80 hover:bg-slate-750 text-slate-200 border border-slate-700/80 text-sm font-medium transition-all flex items-center gap-2"
          >
            <span>Explore SDK</span>
            <ChevronRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* The 3 Planes Overview */}
      <section className="grid md:grid-cols-3 gap-6">
        <div id="control-plane" className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4 relative overflow-hidden">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xs font-mono uppercase tracking-wider text-cyan-400">Plane 01</h2>
            <h3 className="text-lg font-bold text-white mt-1">Control Plane</h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">What do I want to happen?</p>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            Intent normalization, before-and-after balance diffs, gas reservation, and 2-of-3 threshold quorum before signing.
          </p>
          <ul className="text-xs text-slate-400 space-y-1.5 pt-2 border-t border-slate-800/80">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Intent Console & Quoting</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Policy & Guardrail Engine</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>2-of-3 Shard Threshold Quorum</span>
            </li>
          </ul>
        </div>

        <div id="privacy-plane" className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4 relative overflow-hidden">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <EyeOff className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xs font-mono uppercase tracking-wider text-emerald-400">Plane 02</h2>
            <h3 className="text-lg font-bold text-white mt-1">Privacy Plane</h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">Who can see what?</p>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            Shielded UTXO notes, join-split commitments, clean-provenance (PPOI) proofs, and selective disclosure via scoped view keys.
          </p>
          <ul className="text-xs text-slate-400 space-y-1.5 pt-2 border-t border-slate-800/80">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Shielded UTXO-style Notes</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Clean-Provenance Proofs</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Scoped & Revocable View Keys</span>
            </li>
          </ul>
        </div>

        <div id="execution-plane" className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4 relative overflow-hidden">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xs font-mono uppercase tracking-wider text-purple-400">Plane 03</h2>
            <h3 className="text-lg font-bold text-white mt-1">Execution Plane</h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">How does it settle?</p>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            Direct Robinhood Chain settlement via ERC-4337 account abstraction, Uniswap V3 swap router, and Morpho lending adapters.
          </p>
          <ul className="text-xs text-slate-400 space-y-1.5 pt-2 border-t border-slate-800/80">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span>Robinhood Chain Native (4663)</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span>USDG & NVDA Tokenized Stock</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span>Deterministic Refund State Machine</span>
            </li>
          </ul>
        </div>
      </section>

      {/* Interactive Intent Simulator */}
      <section id="intent-simulator" className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 sm:p-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-emerald-400" />
              <span>Explainable Intent Engine</span>
            </h3>
            <p className="text-sm text-slate-400 mt-1">
              Describe a financial goal. Veilora simulates balance transitions, checks policy, and prompts 2-of-3 quorum.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((step) => (
              <button
                key={step}
                onClick={() => setActiveStep(step)}
                className={`px-3 py-1 text-xs rounded-md font-mono transition-colors ${
                  activeStep === step
                    ? "bg-emerald-500 text-slate-950 font-bold"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                Step {step}
              </button>
            ))}
          </div>
        </div>

        {/* Input bar */}
        <div className="space-y-2">
          <label className="text-xs font-mono uppercase tracking-wider text-slate-400">
            Natural-Language Goal
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={intentInput}
              onChange={(e) => setIntentInput(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-lg bg-slate-950 border border-slate-750 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={() => setSimulated(true)}
              className="px-5 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-mono text-xs rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <span>Simulate</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Simulator Content based on step */}
        {simulated && (
          <div className="grid md:grid-cols-2 gap-6 pt-2">
            {/* Step 1: Simulated diff */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between text-slate-400 border-b border-slate-850 pb-2">
                <span className="font-semibold text-white">Before & After Simulation</span>
                <span className="text-emerald-400">Checked</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between py-1 border-b border-slate-900">
                  <span className="text-slate-400">Public USDG:</span>
                  <span className="text-red-400">- 500.00 USDG</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-900">
                  <span className="text-slate-400">Shielded NVDA Note:</span>
                  <span className="text-emerald-400">+ 3.8219 NVDA (shielded)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-900">
                  <span className="text-slate-400">Gas Reserve Preserved:</span>
                  <span className="text-slate-200">0.050 ETH (Safe)</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Execution Route:</span>
                  <span className="text-slate-300">Shield → Uniswap V3 → Note Commit</span>
                </div>
              </div>
            </div>

            {/* Step 2: Quorum & Policy */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between text-slate-400 border-b border-slate-850 pb-2">
                <span className="font-semibold text-white">Threshold Quorum (2-of-3)</span>
                <span className="text-cyan-400">Pending Signature</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-1 border-b border-slate-900">
                  <span className="text-slate-400">Shard A (Local Device):</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Authorized
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-900">
                  <span className="text-slate-400">Shard B (Policy Co-signer):</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Policy Passed (0.34% fee)
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-900">
                  <span className="text-slate-400">Shard C (Passkey Recovery):</span>
                  <span className="text-slate-500">Standby (Quorum Met)</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-400">Clean-Provenance Proof:</span>
                  <span className="text-cyan-400">PPOI Association Verified</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Developer SDK Snippet */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6 sm:p-8 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <span>Developer SDK Integration</span>
          </h3>
          <span className="text-xs font-mono text-slate-400">TypeScript · Bun</span>
        </div>
        <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed">
{`import { veilora } from "@veilora/sdk";

// 1. Build structured intent
const plan = await veilora.intent.create({
  goal: "Buy 500 USDG of NVDA exposure and keep it shielded",
  constraints: { maxTotalFeeBps: 75, preserveGas: "0.05 ETH", requireCleanProvenance: true }
});

// 2. Simulate & evaluate guardrails
const simulation = await veilora.simulate(plan);
const policy = await veilora.policies.evaluate(plan, simulation);

// 3. Request threshold authorization & settle on Robinhood Chain
const approval = await veilora.approvals.request(plan, simulation, policy);
const result = await veilora.execute(approval);`}
        </pre>
      </section>
    </div>
  );
}
