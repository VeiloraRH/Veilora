import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, ShieldAlert } from 'lucide-react';
import { isAddress, type Address } from 'viem';
import { useWallet } from '@/lib/walletContext';
import { useTransactions } from '@/lib/walletQueries';
import { getWalletContacts } from '@/lib/contacts';
import { useWalletBlocklist } from '@/lib/addressBlocklist';
import { WALLET_TOKENS } from '@/lib/tokens';
import { chainClient } from '@/lib/walletChain';
import { addressGroups, assessRecipient, type CheckLevel, type RecipientAssessment } from '@/lib/recipientCheck';

const TOKEN_CONTRACTS = WALLET_TOKENS.filter(t => !t.native).map(t => ({ symbol: t.symbol, address: t.address }));
const ICONS = { ok: CheckCircle2, info: Info, warn: AlertTriangle, danger: ShieldAlert } as const;

/** Assess a recipient against contacts, past sends and the chain. `loading` stays true until history is in. */
export function useRecipientAssessment(recipient: string): { assessment: RecipientAssessment | null; loading: boolean } {
 const { walletAddress } = useWallet();
 const blockedAddresses = useWalletBlocklist(walletAddress);
 const history = useTransactions();
 const [code, setCode] = useState<string | null | undefined>(undefined);
 const valid = isAddress(recipient);
 useEffect(() => {
  setCode(undefined);
  if (!valid) return;
  let active = true;
  void chainClient.getCode({ address: recipient as Address }).then(c => { if (active) setCode(c ?? '0x'); }).catch(() => { if (active) setCode(null); });
  return () => { active = false; };
 }, [recipient, valid]);
 const assessment = useMemo(() => valid && walletAddress ? assessRecipient({
  recipient, wallet: walletAddress, contacts: getWalletContacts(walletAddress), history: history.data ?? [], tokenContracts: TOKEN_CONTRACTS, blockedAddresses, code,
 }) : null, [recipient, valid, walletAddress, history.data, blockedAddresses, code]);
 return { assessment, loading: valid && (history.isPending || code === undefined) };
}

/** Recipients that must never receive a send: your own account or a token contract. */
export const isBlockedRecipient = (a: RecipientAssessment | null) => !!a?.items.some(i => i.code === 'self' || i.code === 'token-contract' || i.code === 'user-blocked');

export function RecipientCheck({ recipient, assessment, loading, showAddress = false }: { recipient: string; assessment: RecipientAssessment | null; loading: boolean; showAddress?: boolean }) {
 if (!assessment) return null;
 const level: CheckLevel = assessment.level;
 return <div className={`recipient-check ${level}`} role={level === 'danger' ? 'alert' : 'status'}>
  {showAddress && <div className="recipient-address" aria-label="Recipient address, in groups of four characters">{addressGroups(recipient).map((g, i, all) => <span key={i} className={i <= 2 || i >= all.length - 2 ? 'edge' : ''}>{g}</span>)}</div>}
  <ul>{assessment.items.map(item => { const Icon = ICONS[item.level]; return <li key={item.code} className={item.level}><Icon size={14}/><span>{item.text}</span></li>; })}</ul>
  {loading && <p className="recipient-loading"><Loader2 size={12} className="animate-spin"/>Checking your history…</p>}
 </div>;
}
