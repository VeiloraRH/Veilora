import { useEffect, useState } from 'react';
import { CircleCheck, CircleX, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchAttestationAddress, verifyReceipt, type ReceiptVerification, type VeilyReceipt } from '@/lib/veilyReceipt';

/** Verification result for one receipt, re-checked on this device. Used in Veily and on /verify-receipt. */
export function VeilyReceiptPanel({ receipt }: { receipt: VeilyReceipt }) {
 const signer = useQuery({ queryKey: ['veily-attestation'], queryFn: fetchAttestationAddress, staleTime: 3_600_000, retry: 1 });
 const [result, setResult] = useState<ReceiptVerification | null>(null);
 useEffect(() => {
  if (signer.isPending) return;
  let active = true;
  void verifyReceipt(receipt, signer.data ?? null).then(r => { if (active) setResult(r); });
  return () => { active = false; };
 }, [receipt, signer.data, signer.isPending]);
 if (!result) return <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 size={14} className="animate-spin"/>Checking receipt…</p>;
 const p = result.payload;
 return <div className="space-y-3 text-left">
  <p className={`rounded-xl p-3 text-xs font-medium ${result.valid ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-red-500/10 text-red-600'}`}>
   {result.valid ? 'Verified. Veilora signed this exact question, answer and suggested actions.' : 'Not verified. See which check failed below.'}
  </p>
  <ul className="space-y-1.5">{result.checks.map(c => <li key={c.label} className="flex items-start gap-2 text-xs">
   {c.ok ? <CircleCheck size={14} className="mt-0.5 shrink-0 text-emerald-600"/> : <CircleX size={14} className="mt-0.5 shrink-0 text-red-500"/>}
   <span><strong className="font-medium">{c.label}</strong> · <span className="break-all text-muted-foreground">{c.detail}</span></span>
  </li>)}</ul>
  {p && <div className="send-review">
   <div><span>AI provider</span><strong className="font-normal">{p.provider}</strong></div>
   <div><span>Model</span><strong className="max-w-48 truncate font-normal" title={p.model}>{p.model}</strong></div>
   <div><span>Answered</span><strong className="font-normal">{new Date(p.issuedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</strong></div>
   <div><span>Wallet tools used</span><strong className="font-normal">{p.toolCalls}</strong></div>
  </div>}
  <p className="text-[11px] leading-5 text-muted-foreground">A receipt proves what Veilora received from the AI provider and showed you. It does not prove the answer is right.</p>
 </div>;
}
