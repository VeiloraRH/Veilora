import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/ui';
import { VeilyReceiptPanel } from '@/components/app/VeilyReceiptPanel';
import { parseReceipt, type VeilyReceipt } from '@/lib/veilyReceipt';

export const Route = createFileRoute('/verify-receipt')({ component: VerifyReceiptPage });

/** Public: check any Veily answer receipt in the browser. Nothing is uploaded. */
function VerifyReceiptPage() {
 const [text, setText] = useState('');
 const [receipt, setReceipt] = useState<VeilyReceipt | null>(null);
 const [error, setError] = useState('');
 function load(value: string) {
  setText(value); setError(''); setReceipt(null);
  if (!value.trim()) return;
  try { setReceipt(parseReceipt(value)); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not read this receipt.'); }
 }
 return <main className="flex min-h-screen flex-col items-center bg-background px-4 py-10 text-foreground">
  <Link to="/" aria-label="Veilora home"><Logo size={34}/></Link>
  <section className="mt-8 w-full max-w-lg space-y-4 rounded-3xl border bg-card p-6 shadow-sm">
   <div><h1 className="text-lg font-medium">Verify a Veily answer receipt</h1>
    <p className="mt-1 text-sm text-muted-foreground">Paste a receipt or choose its file. It is checked in this browser against the key Veilora publishes. Nothing is uploaded.</p></div>
   <input type="file" accept="application/json,.json" className="block text-xs" onChange={event => { const file = event.target.files?.[0]; if (file) void file.text().then(load); }}/>
   <textarea aria-label="Receipt" rows={6} spellCheck={false} value={text} onChange={event => load(event.target.value)} placeholder='{"format":"veily-answer-receipt", …}'
    className="w-full rounded-xl border bg-background p-3 font-mono text-xs"/>
   {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
   {receipt && <>
    <VeilyReceiptPanel receipt={receipt}/>
    <div className="space-y-2 rounded-xl bg-muted/60 p-3 text-xs">
     <p><strong className="font-medium">Question</strong></p><p className="whitespace-pre-wrap text-muted-foreground">{receipt.question}</p>
     <p><strong className="font-medium">Answer</strong></p><p className="whitespace-pre-wrap text-muted-foreground">{receipt.answer}</p>
    </div>
   </>}
  </section>
  <Link to="/app" className="mt-6 inline-flex items-center gap-1 text-xs text-muted-foreground"><ArrowLeft size={13}/>Back to Veilora</Link>
 </main>;
}
