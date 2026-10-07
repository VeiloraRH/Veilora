import { useState } from "react";
import { Sparkles, ArrowRight, X, ShieldCheck } from "lucide-react";
import { Button, inputClass } from "@/components/ui";
import { useNavigate } from "@tanstack/react-router";

interface IntentModalProps {
  open: boolean;
  onClose: () => void;
  defaultGoal?: string;
}

const PRESET_INTENTS = [
  "Shield 2,000 USDG into the privacy pool",
  "Buy 500 USDG of NVDA exposure and keep it shielded",
  "Send 1,250 USDG to verified supplier on Robinhood Chain",
  "Swap 1,000 USDC to USDG with clean provenance check",
];

export function IntentModal({ open, onClose, defaultGoal = "" }: IntentModalProps) {
  const [goal, setGoal] = useState(defaultGoal);
  const navigate = useNavigate();

  if (!open) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = goal.trim();
    if (!clean) return;
    onClose();
    navigate({ to: "/app/intent", search: { goal: clean } });
  };

  const handlePickPreset = (preset: string) => {
    setGoal(preset);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 dark:bg-ink-950/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="panel relative z-10 w-full max-w-lg overflow-hidden bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 shadow-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-ink-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-400/10 text-gold-400 border border-gold-400/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-cream">Plan Intent with AI</h2>
              <p className="text-xs text-slate-500 dark:text-mist">Threshold-guarded natural language execution</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:text-mist dark:hover:text-cream transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-cream mb-1.5">
              Describe what you want to achieve
            </label>
            <textarea
              className={`${inputClass} min-h-[96px] resize-y py-2.5 text-sm bg-slate-50 dark:bg-ink-950/80`}
              rows={3}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Shield 1,500 USDG and swap 500 USDG for NVDA tokenized stock exposure..."
            />
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-mist mb-2">Example intent prompts:</p>
            <div className="flex flex-wrap gap-2">
              {PRESET_INTENTS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePickPreset(preset)}
                  className="rounded-lg border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950/60 px-2.5 py-1 text-xs text-slate-600 dark:text-mist hover:border-gold-400/60 hover:text-slate-900 dark:hover:text-cream text-left transition-colors"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-teal-400/20 bg-teal-400/5 p-3 flex items-center gap-2.5 text-xs text-teal-600 dark:text-teal-300">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>All intent routes are simulated locally and validated against your 2-of-3 guardrails.</span>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-ink-800">
            <Button type="button" variant="outline" onClick={onClose} className="text-xs">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!goal.trim()}
              className="bg-[#eaba65] hover:bg-[#d8a855] text-slate-950 font-medium text-xs flex items-center gap-1.5"
            >
              <span>Compile Plan</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
