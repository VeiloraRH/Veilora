import { Check, CircleAlert, Loader2, ShieldCheck } from 'lucide-react';

export type TransactionCheckItem = {
  label: string;
  detail: string;
  status: 'ready' | 'attention' | 'checking';
};

/** A compact review summary of the checks completed before the wallet signs. */
export function TransactionCheck({ items }: { items: TransactionCheckItem[] }) {
  const ready = items.every((item) => item.status === 'ready');
  return (
    <section className="my-4 rounded-2xl border border-border bg-muted/35 p-4" aria-label="Transaction check">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        <ShieldCheck size={17} className={ready ? 'text-emerald-600' : 'text-amber-600'} />
        <span>Transaction check</span>
        <span className={`ml-auto text-xs ${ready ? 'text-emerald-600' : 'text-amber-600'}`}>
          {ready ? 'Ready' : 'Needs attention'}
        </span>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-start gap-2 text-xs">
            <span className="mt-0.5 shrink-0">
              {item.status === 'checking' ? <Loader2 size={14} className="animate-spin text-muted-foreground" /> : item.status === 'ready' ? <Check size={14} className="text-emerald-600" /> : <CircleAlert size={14} className="text-amber-600" />}
            </span>
            <span className="min-w-0"><strong className="font-medium">{item.label}</strong><span className="text-muted-foreground"> · {item.detail}</span></span>
          </div>
        ))}
      </div>
    </section>
  );
}
