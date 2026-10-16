import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Send, X } from 'lucide-react';
import { encodeFunctionData, erc20Abi, getAddress, type Hex } from 'viem';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Private } from '@/components/wallet/Private';
import { RecipientCheck, isBlockedRecipient, useRecipientAssessment } from '@/components/wallet/RecipientCheck';
import { SignPreview } from '@/components/wallet/TxExplanation';
import { useWallet } from '@/lib/walletContext';
import { ROBINHOOD_TOKEN_REGISTRY as TOKENS } from '@/lib/tokens';
import { sendAsset, tokenBalance } from '@/lib/walletChain';
import { rawText, resolveExecution, type RuleExecution } from '@/lib/rulesApi';

/** Approve one prepared transfer from a send rule: one signed transfer, no swaps or quotes. */
export function SendRunReview({ run, onClose, onDone }: { run: RuleExecution; onClose: () => void; onDone: (message: string) => void }) {
 const { walletAddress, getStoredDeviceKey } = useWallet(); const cache = useQueryClient();
 const leg = run.legs[0]; const token = TOKENS[run.sourceAsset]; const amount = BigInt(leg.amountRaw); const recipient = getAddress(leg.recipient!);
 const { assessment, loading } = useRecipientAssessment(recipient);
 const [balance, setBalance] = useState<bigint | null>(null); const [busy, setBusy] = useState(''); const [error, setError] = useState(''); const [ack, setAck] = useState(false);
 useEffect(() => { let active = true; void tokenBalance(getAddress(walletAddress), token).then(b => { if (active) setBalance(b); }).catch(() => { if (active) setBalance(null); }); return () => { active = false; }; }, [walletAddress, token]);
 const blocked = isBlockedRecipient(assessment); const needsAck = assessment?.level === 'danger' && !blocked;
 const enough = balance != null && balance >= amount;
 const call = token.native ? { target: recipient, value: amount, data: '0x' as Hex } : { target: token.address, value: 0n, data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [recipient, amount] }) };
 const settle = () => { void cache.invalidateQueries({ queryKey: ['wallet-rules'] }); void cache.invalidateQueries({ queryKey: ['wallet-rule-runs'] }); void cache.invalidateQueries({ queryKey: ['holdings'] }); void cache.invalidateQueries({ queryKey: ['transactions'] }); };

 async function approve() {
  const key = getStoredDeviceKey(); if (!key) { setError('Unlock your device key before approving.'); return; }
  setBusy('Signing & sending…'); setError('');
  try {
   const hash = await sendAsset(getAddress(walletAddress), key as Hex, token, recipient, amount);
   await resolveExecution(walletAddress, key as Hex, run.id, 'executed', [hash]);
   onDone(`“${run.ruleName}” ran: sent ${rawText(amount, run.sourceAsset)} to ${leg.recipientName ?? recipient}.`);
  } catch (e) { setError(e instanceof Error ? e.message : 'The transfer could not be completed.'); }
  finally { setBusy(''); settle(); }
 }
 async function decline() {
  const key = getStoredDeviceKey(); if (!key) { setError('Unlock your device key first.'); return; }
  setBusy('Declining…');
  try { await resolveExecution(walletAddress, key as Hex, run.id, 'declined'); settle(); onDone(`Declined this run of “${run.ruleName}”. The rule stays active.`); }
  catch (e) { setError(e instanceof Error ? e.message : 'Could not decline.'); } finally { setBusy(''); }
 }

 return <Dialog open onOpenChange={v => { if (!v && !busy) onClose(); }}><DialogContent className="wallet-dialog sm:max-w-lg"><DialogHeader><DialogTitle>Approve this transfer</DialogTitle><DialogDescription>{run.ruleName}</DialogDescription></DialogHeader>
  <div className="py-2 text-center"><p className="text-3xl font-medium tracking-tight"><Private>{rawText(amount, run.sourceAsset)}</Private></p><p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-muted-foreground"><Send size={14}/>to {leg.recipientName ?? 'recipient'}</p></div>
  <RecipientCheck recipient={recipient} assessment={assessment} loading={loading} showAddress/>
  {needsAck && <label className="recipient-ack"><input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)}/><span>I checked every character of this address with the recipient.</span></label>}
  <div className="send-review"><div><span>Your balance</span><strong><Private>{balance == null ? '—' : rawText(balance, run.sourceAsset)}</Private></strong></div><div><span>Network</span><strong>Robinhood Chain</strong></div><div><span>Network fee</span><strong>Paid by Veilora's relayer</strong></div><div><span>Signing</span><strong>Your device key + co-signer</strong></div></div>
  <SignPreview wallet={walletAddress} calls={[call]}/>
  {balance != null && !enough && <p role="alert" className="wallet-error mb-3">Your {run.sourceAsset} balance is below this transfer. Top up or decline it.</p>}
  {error && <p role="alert" className="wallet-error mb-3">{error}</p>}
  <div className="review-actions"><button className="rule-button" disabled={!!busy} onClick={() => void decline()}><X size={14}/>Decline</button><button className="wallet-primary-button" disabled={!enough || blocked || (needsAck && !ack) || !!busy} onClick={() => void approve()}>{busy ? <><Loader2 size={16} className="animate-spin"/>{busy}</> : 'Approve & send'}</button></div>
 </DialogContent></Dialog>;
}
