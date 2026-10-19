import { CircleCheck, CircleDashed, Loader2 } from 'lucide-react';
import { SIGNING_STEPS, stepStates, type SigningProgress } from '@/lib/signingProgress';

const seconds = (ms: number) => ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;

/** Live 2-of-3 signing steps for the review screen. */
export function SigningProgressList({ progress }: { progress: SigningProgress }) {
 if (!progress.current) return null;
 const states = stepStates(progress);
 return <ol className="mb-4 space-y-2 rounded-2xl border p-4" aria-label="Signing progress" aria-live="polite">
  {SIGNING_STEPS.map((step, i) => {
   const state = states[i];
   return <li key={step.stage} className="flex items-start gap-2.5 text-xs">
    {state.status === 'done' ? <CircleCheck size={15} className="mt-0.5 shrink-0 text-emerald-600"/> : state.status === 'active' ? <Loader2 size={15} className="mt-0.5 shrink-0 animate-spin text-blue-500"/> : <CircleDashed size={15} className="mt-0.5 shrink-0 text-muted-foreground"/>}
    <span className="min-w-0 flex-1"><strong className={`font-medium ${state.status === 'pending' ? 'text-muted-foreground' : ''}`}>{step.label}</strong>
     <span className="block text-muted-foreground">{step.detail}</span></span>
    {state.ms != null && <span className="shrink-0 tabular-nums text-muted-foreground">{seconds(state.ms)}</span>}
   </li>;
  })}
 </ol>;
}
