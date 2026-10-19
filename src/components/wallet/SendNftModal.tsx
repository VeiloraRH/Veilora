import { useEffect, useState } from 'react';
import { ArrowLeft, Image, Loader2, Send } from 'lucide-react';
import { getAddress, isAddress, zeroAddress, type Hex } from 'viem';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWallet } from '@/lib/walletContext';
import { useSpendingPolicy } from '@/lib/spendingPolicy';
import { chainClient, EXPLORER, executeWalletCall } from '@/lib/walletChain';
import type { WalletNft } from '@/lib/nftHoldings';
import { nftHeld, nftTransferCall, nftTransfersLeft, NFT_DAILY_TRANSFER_LIMIT } from '@/lib/nftTransfer';
import { shortAddress } from '@/components/wallet/WalletUI';
import { ContactBook } from '@/components/wallet/ContactBook';
import { RecipientCheck, isBlockedRecipient, useRecipientAssessment } from '@/components/wallet/RecipientCheck';
import { TransactionCheck, type TransactionCheckItem } from '@/components/wallet/TransactionCheck';
import { SignPreview } from '@/components/wallet/TxExplanation';
import type { TransferReceipt } from '@/lib/transferReceipt';

type Simulation = null | { status: 'passed' | 'reverted' | 'unavailable'; detail: string };

export function SendNftModal({ nft, onClose, onSent }: { nft: WalletNft | null; onClose: () => void; onSent: (receipt: TransferReceipt) => void }) {
 const { walletAddress, getStoredDeviceKey } = useWallet();
 const spendingPolicy = useSpendingPolicy();
 const [step, setStep] = useState(0);
 const [recipient, setRecipient] = useState('');
 const [quantity, setQuantity] = useState('1');
 const [acknowledged, setAcknowledged] = useState(false);
 const [simulation, setSimulation] = useState<Simulation>(null);
 const [simulationAck, setSimulationAck] = useState(false);
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');
 useEffect(() => { if (nft) { setStep(0); setRecipient(''); setQuantity('1'); setError(''); } }, [nft]);
 useEffect(() => setAcknowledged(false), [recipient]);

 const held = nft ? nftHeld(nft) : 1n;
 let amount = 0n; try { amount = /^\d+$/.test(quantity) ? BigInt(quantity) : 0n; } catch { /* stays invalid */ }
 const validAmount = amount > 0n && amount <= held;
 const validRecipient = isAddress(recipient) && recipient.toLowerCase() !== zeroAddress && recipient.toLowerCase() !== walletAddress.toLowerCase() && recipient.toLowerCase() !== nft?.contractAddress.toLowerCase();
 const { assessment, loading: checking } = useRecipientAssessment(validRecipient ? recipient : '');
 const blocked = isBlockedRecipient(assessment);
 // New and similar recipients require explicit confirmation before signing.
 const needsAck = (assessment?.level === 'danger' || assessment?.level === 'warn') && !blocked;
 const left = nftTransfersLeft(spendingPolicy.data);
 const call = nft && validRecipient && validAmount ? nftTransferCall(getAddress(walletAddress), nft, getAddress(recipient), amount) : null;

 useEffect(() => {
  setSimulation(null); setSimulationAck(false);
  if (step !== 1 || !call) return;
  let active = true; let timeout: number | undefined;
  void Promise.race([
   chainClient.call({ account: getAddress(walletAddress), to: call.target, data: call.data }),
   new Promise<never>((_, reject) => { timeout = window.setTimeout(() => reject(new Error('Simulation timed out.')), 10_000); }),
  ]).then(() => { if (active) setSimulation({ status: 'passed', detail: 'This NFT transfer passed against the latest Robinhood Chain state.' }); })
   .catch((cause: unknown) => {
    if (!active) return;
    const reverted = /revert|execution reverted|returned error/i.test(cause instanceof Error ? cause.message : '');
    setSimulation(reverted
     ? { status: 'reverted', detail: 'The transfer reverted at the latest block. The recipient may not accept NFTs, or this account no longer holds it.' }
     : { status: 'unavailable', detail: 'The RPC could not complete this simulation. The transfer has not been confirmed to work.' });
   })
   .finally(() => { if (timeout !== undefined) window.clearTimeout(timeout); });
  return () => { active = false; if (timeout !== undefined) window.clearTimeout(timeout); };
 }, [step, call?.data, call?.target, walletAddress]);

 const ready = !!call && !blocked && !checking && !!assessment && (!needsAck || acknowledged) && left !== 0 &&
  !!simulation && simulation.status !== 'reverted' && (simulation.status !== 'unavailable' || simulationAck);
 async function send() {
  const key = getStoredDeviceKey();
  if (!key) { setError('Unlock your device key first.'); return; }
  if (!ready || !call || !nft) return;
  setBusy(true); setError('');
  try {
   const hash = await executeWalletCall(getAddress(walletAddress), key as Hex, call.target, call.value, call.data);
   onSent({ what: `${amount > 1n ? `${amount} × ` : ''}${nft.name}`, recipient: getAddress(recipient), recipientName: assessment?.contactName ?? null, from: getAddress(walletAddress), hash: hash as Hex, sentAt: new Date().toISOString() });
   onClose();
  } catch (cause) { setError(cause instanceof Error ? cause.message : 'Transfer failed. Please try again.'); }
  finally { setBusy(false); }
 }

 const checks: TransactionCheckItem[] = [
  { label: 'Ownership', detail: `${nft?.tokenType ?? 'NFT'} · ${held > 1n ? `${held} held` : 'held by this account'}; the co-signer checks it on-chain`, status: validAmount ? 'ready' : 'attention' },
  { label: 'Daily NFT limit', detail: left == null ? (spendingPolicy.isLoading ? 'Checking today’s count' : 'Limit unavailable') : left > 0 ? `${left} of ${spendingPolicy.data?.nftDailyLimit ?? NFT_DAILY_TRANSFER_LIMIT} NFT transfers left today` : 'No NFT transfers left today; resets at 00:00 UTC', status: left == null ? (spendingPolicy.isLoading ? 'checking' : 'attention') : left > 0 ? 'ready' : 'attention' },
  { label: 'Call simulation', detail: simulation?.detail ?? 'Simulating this exact NFT transfer…', status: !simulation ? 'checking' : simulation.status === 'passed' ? 'ready' : simulation.status === 'reverted' ? 'failed' : 'attention' },
  { label: 'Recipient', detail: blocked ? 'This address cannot be used' : checking || !assessment ? 'Checking address history and chain data' : needsAck && !acknowledged ? 'Confirm you checked the address' : `${assessment.contactName ?? shortAddress(recipient)} on Robinhood Chain`, status: blocked || needsAck && !acknowledged ? 'attention' : checking || !assessment ? 'checking' : 'ready' },
 ];

 return <Dialog open={!!nft} onOpenChange={value => { if (!value && !busy) onClose(); }}>
  <DialogContent className="wallet-dialog sm:max-w-md">
   <DialogHeader><div className="flex items-center gap-3">
    {step > 0 ? <Button variant="ghost" size="icon" aria-label="Previous step" disabled={busy} onClick={() => { setError(''); setStep(0); }}><ArrowLeft/></Button> : <span className="rounded-xl bg-blue-500/10 p-3 text-blue-500"><Send size={20}/></span>}
    <div><DialogTitle>{step === 0 ? 'Who are you sending it to?' : 'Review your NFT transfer'}</DialogTitle><DialogDescription className="mt-1">Send NFT · Step {step + 1} of 2</DialogDescription></div>
   </div></DialogHeader>
   {nft && <div className="flex items-center gap-3 rounded-2xl bg-muted/70 p-3">
    <div className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted text-muted-foreground"><Image size={20}/>{nft.imageUrl && <img src={nft.imageUrl} alt="" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover" onError={event => { event.currentTarget.style.display = 'none'; }}/>}</div>
    <div className="min-w-0"><p className="truncate text-sm font-medium">{nft.name}</p><p className="truncate text-xs text-muted-foreground">{nft.collectionName} · #{nft.tokenId}</p></div>
   </div>}
   {step === 0 && <form className="space-y-5" onSubmit={event => { event.preventDefault(); if (validRecipient && validAmount && !blocked) setStep(1); }}>
    <label className="block space-y-2"><span>Recipient address</span><Input autoFocus value={recipient} onChange={event => setRecipient(event.target.value.trim())} placeholder="0x…" className="h-12 rounded-xl font-mono text-xs"/></label>
    <ContactBook wallet={walletAddress} address={recipient} onSelect={setRecipient}/>
    {held > 1n && <label className="block space-y-2"><span>How many copies</span><Input inputMode="numeric" value={quantity} onChange={event => setQuantity(event.target.value.trim())} className="h-12 rounded-xl"/><span className="text-xs text-muted-foreground">You hold {held.toString()}.</span></label>}
    {recipient && !validRecipient && <p className="text-xs text-red-500">Enter a valid wallet address other than your own account or the collection contract.</p>}
    {!validAmount && <p className="text-xs text-red-500">Choose between 1 and {held.toString()}.</p>}
    {validRecipient && <RecipientCheck recipient={recipient} assessment={assessment} loading={checking}/>}
    <p className="text-xs leading-6 text-muted-foreground">NFTs are sent on Robinhood Chain only. Up to {spendingPolicy.data?.nftDailyLimit ?? NFT_DAILY_TRANSFER_LIMIT} NFT transfers a day are co-signed.</p>
    <Button className="h-12 w-full rounded-xl" disabled={!validRecipient || !validAmount || blocked}>Review transfer</Button>
   </form>}
   {step === 1 && nft && <div>
    <RecipientCheck recipient={recipient} assessment={assessment} loading={checking} showAddress/>
    {needsAck && <label className="recipient-ack"><input type="checkbox" checked={acknowledged} onChange={e=>setAcknowledged(e.target.checked)}/><span>I checked every character of this address with the recipient.</span></label>}
    <div className="send-review">
     <div><span>Recipient</span><strong className="max-w-60 break-all text-right font-mono text-xs font-normal">{assessment?.contactName ?? shortAddress(recipient)}</strong></div>
     <div><span>Collection</span><a className="font-mono text-xs" href={`${EXPLORER}/token/${nft.contractAddress}`} title={nft.contractAddress} target="_blank" rel="noreferrer">{shortAddress(nft.contractAddress)}</a></div>
     {amount > 1n && <div><span>Copies</span><strong className="font-normal">{amount.toString()}</strong></div>}
     <div><span>Network gas</span><strong className="font-normal">Paid by Veilora</strong></div>
    </div>
    <TransactionCheck items={checks} footnote="A passing simulation reflects the latest block only. Ownership and the daily NFT limit are checked again by the co-signer when you submit."/>
    <SignPreview wallet={walletAddress} calls={call ? [call] : []} title="Veily’s transaction review" facts={[
     { label: 'Transfer', value: `${amount > 1n ? `${amount} × ` : ''}${nft.name} to ${shortAddress(recipient)}` },
     { label: 'Recipient', value: recipient },
     { label: 'Daily NFT transfers left', value: left == null ? 'Unavailable' : String(left) },
     { label: 'Network fee', value: 'Paid by Veilora' },
    ]}/>
    {simulation?.status === 'unavailable' && <label className="recipient-ack"><input type="checkbox" checked={simulationAck} onChange={e=>setSimulationAck(e.target.checked)}/><span>The transfer could not be simulated. I reviewed the NFT and recipient and want to continue.</span></label>}
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-500/5 p-3 text-xs text-red-500">{error}</p>}
    <Button className="h-12 w-full rounded-xl" disabled={busy || !ready} onClick={() => void send()}>{busy ? <><Loader2 className="animate-spin"/>Signing & sending…</> : left === 0 ? 'Daily NFT limit reached' : simulation?.status === 'reverted' ? 'Transfer would revert' : simulation?.status === 'unavailable' && !simulationAck ? 'Confirm details to continue' : 'Confirm & send'}</Button>
   </div>}
  </DialogContent>
 </Dialog>;
}
