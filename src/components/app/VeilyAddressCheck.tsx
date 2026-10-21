import { Link } from '@tanstack/react-router';
import { isAddress } from 'viem';
import { RecipientCheck, useRecipientAssessment } from '@/components/wallet/RecipientCheck';

const FULL_ADDRESS = /0x[0-9a-fA-F]{40}(?![0-9a-fA-F])/;

/** The first full address in a message, if any. */
export const addressIn = (text: string): string | null => { const m = text.match(FULL_ADDRESS); return m && isAddress(m[0], { strict: false }) ? m[0] : null; };

/**
 * The same recipient check Send uses — contacts, blocklist, approved list,
 * look-alikes, burn addresses — run on this device for an address the user
 * asked Veily about. None of it is sent to the AI provider.
 */
export function VeilyAddressCheck({ address }: { address: string }) {
 const { assessment, loading } = useRecipientAssessment(address);
 return <div className="mt-2 space-y-1.5 rounded-xl border border-slate-200 bg-white p-2.5 dark:border-ink-700 dark:bg-ink-900">
  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-mist">Checked on this device</p>
  {loading && !assessment ? <p className="text-[11px] text-slate-500">Checking this address…</p> : <RecipientCheck recipient={address} assessment={assessment} loading={loading} showAddress/>}
  <Link to="/app/security" className="block text-[11px] text-blue-600 hover:underline">Manage blocked and approved addresses</Link>
 </div>;
}
