import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, ChevronRight } from "lucide-react";
import { RECIPES, type Recipe } from "@/demo/data";
import { Badge, Button, Card, KV, PageHeader } from "@/components/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/recipes")({
  component: RecipesScreen,
});

const AUDIT_TONE = { Audited: "teal", "Audit in progress": "gold", "Testnet only": "mist" } as const;

function StepChain({ steps }: { steps: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {steps.map((s, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <span className="rounded-md border border-gold-400/30 bg-gold-400/5 px-2 py-0.5 text-xs text-gold-200">{s}</span>
          {i < steps.length - 1 && <ChevronRight className="h-3 w-3 text-mist" />}
        </span>
      ))}
    </div>
  );
}

function RecipesScreen() {
  const [selected, setSelected] = useState<Recipe>(RECIPES[1]);
  return (
    <>
      <PageHeader
        eyebrow="Shielded DeFi"
        title="Recipes"
        description="Steps (shield, swap, lend, bridge, unshield) combine into recipes. A combo runs several steps atomically, with one simulation and one approval. Every recipe declares what it touches and how it fails."
      />

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        {[
          ["Step", "One action: shield, swap, lend, withdraw, bridge or unshield."],
          ["Recipe", "One reusable workflow that is checked against your policies."],
          ["Combo", "Several steps executed atomically: all succeed, or nothing moves."],
        ].map(([t, d], i) => (
          <div key={t} className="panel px-5 py-4">
            <p className="font-display text-2xl text-gold-300">
              {i + 1}. {t}
            </p>
            <p className="mt-1 text-sm text-mist">{d}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <ul className="space-y-3">
          {RECIPES.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => setSelected(r)}
                className={cn("panel w-full p-4 text-left transition-colors", selected.id === r.id ? "!border-gold-400/70" : "hover:!border-ink-500")}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="flex-1 font-medium text-cream">{r.name}</p>
                  {r.combo && <Badge tone="cream">Combo</Badge>}
                  <Badge tone={AUDIT_TONE[r.audit]}>{r.audit}</Badge>
                </div>
                <p className="mt-1 text-sm text-mist">{r.summary}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <StepChain steps={r.steps} />
                  <span className="text-xs text-mist">Gate {r.gate}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>

        <Card title={selected.name} eyebrow="Recipe declaration" className="xl:sticky xl:top-24 xl:self-start">
          <StepChain steps={selected.steps} />
          <div className="mt-5">
            <KV k="Inputs" v={selected.inputs} />
            <KV k="Outputs" v={selected.outputs} />
            <KV k="Assets" v={selected.assets} />
            <KV k="Chain" v="Robinhood Chain · 4663" />
            <KV k="Contracts and versions" v={selected.contracts} mono />
            <KV k="Fees and slippage" v={selected.fees} />
            <KV k="Proof requirements" v={selected.proof} />
            <KV k="Failure and refund" v={selected.failure} />
            <KV k="Privacy" v={selected.privacy} />
            <KV k="Test and audit status" v={<Badge tone={AUDIT_TONE[selected.audit]}>{selected.audit}</Badge>} />
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-mist">{selected.audit === "Testnet only" ? "Not available on mainnet until audited." : "Runs through the Intent Console so you see the full simulation first."}</p>
            <Link to="/app/intent" search={{ goal: selected.id === "rc-2" ? "Buy 500 USDG of NVDA exposure and keep it shielded" : "Shield 2,000 USDG and keep the rest public for payroll" }}>
              <Button disabled={selected.audit === "Testnet only"} className="w-full sm:w-auto">
                Use recipe <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </>
  );
}
