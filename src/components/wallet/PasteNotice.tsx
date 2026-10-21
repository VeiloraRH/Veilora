import type { PasteCheck } from '@/lib/clipboardGuard';

/** What paste protection found in the last pasted address, shown under the recipient field. */
export function PasteNotice({ check }: { check: PasteCheck | null }) {
 if (!check || (!check.mismatch && !check.removedHidden)) return null;
 return check.mismatch
  ? <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-xs font-medium leading-5 text-red-600">{check.mismatch}</p>
  : <p role="status" className="rounded-xl bg-amber-500/10 p-3 text-xs leading-5 text-amber-700 dark:text-amber-400">Removed hidden characters from the pasted address. Check it against the source before sending.</p>;
}
