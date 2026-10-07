import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, ChevronRight } from "lucide-react";
import { getRecipes, type RecipeItem } from "@/lib/api";
import { Badge, Button, Card, KV, PageHeader } from "@/components/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/recipes")({
  component: RecipesScreen,
});

function StepChain({ steps }: { steps: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {steps.map((s, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <span className="rounded-md border border-gold-400/30 bg-gold-400/5 px-2 py-0.5 text-xs text-gold-200 capitalize">
            {s.replace(/_/g, " ")}
          </span>
          {i < steps.length - 1 && <ChevronRight className="h-3 w-3 text-mist" />}
        </span>
      ))}
    </div>
  );
}

export function RecipesScreen() {
  const [recipes, setRecipes] = useState<RecipeItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRecipes()
      .then((res) => {
        setRecipes(res.recipes);
        if (res.recipes.length > 0) {
          setSelectedId(res.recipes[0].recipe_id);
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const selected = recipes.find((r) => r.recipe_id === selectedId) || recipes[0];

  const getRecipeGoal = (r: RecipeItem) => {
    switch (r.recipe_id) {
      case "shield-usdg":
        return "Shield 2,000 USDG into the privacy pool";
      case "shield-swap-stock":
        return "Buy 500 USDG of NVDA exposure and keep it shielded";
      case "shield-lend-morpho":
        return "Shield 1,000 USDG and allocate to private Morpho vault";
      case "safe-unshield":
        return "Safe unshield 1,000 USDG to verified origin account";
      default:
        return `Run ${r.name} with clean provenance check`;
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Composable DeFi"
        title="Privacy Recipes"
        description="Atomic combinations of shielding, swapping, and unshielding on Robinhood Chain. Every recipe declares its execution steps, slippage limits, and safety invariants upfront."
      />

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        {[
          ["Action", "Single step: shield, swap, unshield, or transfer."],
          ["Recipe", "Tested multi-step workflow evaluated by the policy engine."],
          ["Atomic Combo", "Executed atomically on Robinhood Chain: all steps succeed or nothing moves."],
        ].map(([t, d], i) => (
          <div key={t} className="panel px-5 py-4">
            <p className="font-display text-2xl text-gold-300">
              {i + 1}. {t}
            </p>
            <p className="mt-1 text-sm text-mist">{d}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="panel p-8 text-center text-sm text-mist">
          Loading recipes from Robinhood Chain registry…
        </div>
      ) : recipes.length === 0 ? (
        <div className="panel p-8 text-center text-sm text-mist">
          No active recipes found.
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
          <ul className="space-y-3">
            {recipes.map((r) => (
              <li key={r.recipe_id}>
                <button
                  onClick={() => setSelectedId(r.recipe_id)}
                  className={cn(
                    "panel w-full p-4 text-left transition-colors",
                    selected?.recipe_id === r.recipe_id ? "!border-gold-400/70" : "hover:!border-ink-500"
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="flex-1 font-medium text-cream">{r.name}</p>
                    <Badge tone="teal">Verified</Badge>
                  </div>
                  <p className="mt-1 text-sm text-mist">{r.description}</p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <StepChain steps={r.steps} />
                    <span className="text-xs text-mist">Max {(r.max_slippage_bps / 100).toFixed(2)}% fee</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {selected && (
            <Card
              title={selected.name}
              eyebrow="Recipe Declaration"
              className="xl:sticky xl:top-24 xl:self-start"
            >
              <StepChain steps={selected.steps} />
              <div className="mt-5 space-y-2 text-sm">
                <KV k="Supported Assets" v={selected.supported_assets.join(", ")} />
                <KV k="Network" v="Robinhood Chain" />
                <KV k="Max Slippage / Fee" v={`${(selected.max_slippage_bps / 100).toFixed(2)}%`} />
                <KV
                  k="Clean Provenance Required"
                  v={
                    selected.requires_clean_provenance ? (
                      <span className="text-teal-300 font-medium">Yes (PPOI Association Set)</span>
                    ) : (
                      "No"
                    )
                  }
                />
                <KV k="Execution Mode" v="Atomic 2-of-3 Threshold Signing" />
                <KV k="Status" v={<Badge tone="teal">Production Ready</Badge>} />
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-ink-600/60 pt-4">
                <p className="text-xs text-mist">
                  Simulates balance changes and checks policy limits before signing.
                </p>
                <Link to="/app/intent" search={{ goal: getRecipeGoal(selected) }}>
                  <Button className="w-full sm:w-auto">
                    Use Recipe <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
