import { useEffect, useState } from 'react';
import { Private } from '@/components/wallet/Private';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowUpRight, ChevronDown, Loader2 } from 'lucide-react';
import { encodeFunctionData, erc20Abi, getAddress, isAddress, formatUnits, zeroAddress, type Hex } from 'viem';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWallet } from '@/lib/walletContext';
import { useHoldings } from '@/lib/walletQueries';
import { ROBINHOOD_TOKEN_REGISTRY } from '@/lib/tokens';
import { chainClient, EXPLORER, rawAmount,sendAsset } from '@/lib/walletChain';
import { TokenIcon,shortAddress } from '@/components/wallet/WalletUI';
import { TokenPicker } from '@/components/wallet/TokenPicker';
import { ContactBook } from '@/components/wallet/ContactBook';
import { RecipientCheck, isBlockedRecipient, useRecipientAssessment } from '@/components/wallet/RecipientCheck';
import { TransactionCheck, type TransactionCheckItem } from '@/components/wallet/TransactionCheck';
import { spendingAllowance } from '@/lib/spendingAllowance';
import { useSpendingPolicy } from '@/lib/spendingPolicy';
interface SendModalProps{open:boolean;onClose:()=>void;publicUsdg:number;ethBalance:number;onSuccess:(details:string)=>void}
export function SendModal({open,onClose,onSuccess}:SendModalProps){
 const {walletAddress,getStoredDeviceKey}=useWallet();const holdings=useHoldings();const spendingPolicy=useSpendingPolicy();const reduce=useReducedMotion();
 const [step,setStep]=useState(0);const [recipient,setRecipient]=useState('');const [amount,setAmount]=useState('');const [symbol,setSymbol]=useState('USDG');const [picker,setPicker]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const [acknowledged,setAcknowledged]=useState(false);
 const [simulation,setSimulation]=useState<null|{status:'passed'|'reverted'|'unavailable';detail:string}>(null);const [simulationAck,setSimulationAck]=useState(false);
 useEffect(()=>{if(open){setStep(0);setError('');setAmount('');setRecipient('');}},[open]);
 useEffect(()=>setAcknowledged(false),[recipient]);
 const token=ROBINHOOD_TOKEN_REGISTRY[symbol];const balance=holdings.data?.find(h=>h.token.symbol===symbol)?.raw;
 const allowance=spendingAllowance(token,balance,spendingPolicy.data);const policyCap=allowance?.max??null;
 let raw=0n;try{raw=rawAmount(amount,token.decimals);}catch{/* Input stays editable until valid. */}
 const validRecipient=isAddress(recipient)&&recipient.toLowerCase()!==zeroAddress;
 const validAmount=raw>0n&&balance!=null&&raw<=balance;
 const withinPolicy=!!allowance&&raw<=allowance.perTransaction&&raw<=allowance.dailyRemaining;
 const {assessment,loading:checking}=useRecipientAssessment(validRecipient?recipient:'');
 const blocked=isBlockedRecipient(assessment);
 // New and similar recipients require explicit confirmation before signing.
 const needsAck=(assessment?.level==='danger'||assessment?.level==='warn')&&!blocked;
 useEffect(()=>{
  setSimulation(null);setSimulationAck(false);
  if(step!==2||!validRecipient||!validAmount)return;
  let active=true;let timeout:number|undefined;
  const call=token.native
   ? chainClient.call({account:getAddress(walletAddress),to:getAddress(recipient),value:raw})
   : chainClient.call({account:getAddress(walletAddress),to:token.address,data:encodeFunctionData({abi:erc20Abi,functionName:'transfer',args:[getAddress(recipient),raw]})});
  void Promise.race([call,new Promise<never>((_,reject)=>{timeout=window.setTimeout(()=>reject(new Error('Simulation timed out.')),10_000);})])
   .then(()=>{if(active)setSimulation({status:'passed',detail:'This transfer call passed against the latest Robinhood Chain state.'});})
   .catch((cause:unknown)=>{if(!active)return;const message=cause instanceof Error?cause.message:'';const reverted=/revert|execution reverted|returned error/i.test(message);setSimulation(reverted?{status:'reverted',detail:'The transfer call reverted at the latest block. Do not send unless the token or recipient issue is resolved.'}:{status:'unavailable',detail:'The RPC could not complete this simulation. The transaction has not been confirmed to work.'});})
   .finally(()=>{if(timeout!==undefined)window.clearTimeout(timeout);});
  return()=>{active=false;if(timeout!==undefined)window.clearTimeout(timeout);};
 },[step,validRecipient,validAmount,walletAddress,recipient,token,raw.toString()]);
 async function send(){const key=getStoredDeviceKey();if(!key){setError('Unlock your device key first.');return;}if(!validRecipient||!validAmount||!withinPolicy||blocked||checking||!assessment||(needsAck&&!acknowledged)||!simulation||simulation.status==='reverted'||simulation.status==='unavailable'&&!simulationAck)return;setBusy(true);setError('');try{await sendAsset(getAddress(walletAddress),key as Hex,token,getAddress(recipient),raw);onSuccess(`Sent ${amount} ${symbol} to ${shortAddress(recipient)}. Transaction confirmed.`);onClose();}catch(e){setError(e instanceof Error?e.message:'Transfer failed. Please try again.');}finally{setBusy(false);}}
 const formatLimit=(value:bigint|null|undefined)=>value==null?'—':Number(formatUnits(value,token.decimals)).toLocaleString(undefined,{maximumFractionDigits:6});
 const transactionChecks:TransactionCheckItem[]=[
  {label:'Wallet balance',detail:balance==null?'Balance unavailable':raw<=balance?`${amount} ${symbol} is available`:`Not enough ${symbol} for this transfer`,status:balance==null?(holdings.isLoading?'checking':'attention'):raw<=balance?'ready':'attention' as const},
  {label:'Per-transaction limit',detail:allowance?`${formatLimit(allowance.perTransaction)} ${symbol} maximum`:(spendingPolicy.isLoading?'Checking your limit':'Limit unavailable'),status:allowance?(raw<=allowance.perTransaction?'ready':'attention'):(spendingPolicy.isLoading?'checking':'attention')},
  {label:'Daily limit remaining',detail:allowance?`${formatLimit(allowance.dailyRemaining)} ${symbol} remains today`:(spendingPolicy.isLoading?'Checking today’s limit':'Limit unavailable'),status:allowance?(raw<=allowance.dailyRemaining?'ready':'attention'):(spendingPolicy.isLoading?'checking':'attention')},
  {label:'Call simulation',detail:simulation?.detail??'Simulating this exact token or ETH transfer…',status:!simulation?'checking':simulation.status==='passed'?'ready':simulation.status==='reverted'?'failed':'attention'},
  {label:'Recipient',detail:blocked?'This address cannot be used':checking||!assessment?'Checking address history and chain data':needsAck&&!acknowledged?'Confirm you checked the address':`${assessment.contactName??shortAddress(recipient)} on Robinhood Chain`,status:blocked||needsAck&&!acknowledged?'attention':checking||!assessment?'checking':'ready' as const},
 ];
 return <><Dialog open={open} onOpenChange={value=>{if(!value&&!busy)onClose();}}><DialogContent className="wallet-dialog sm:max-w-md"><DialogHeader><div className="flex items-center gap-3">{step>0?<Button variant="ghost" size="icon" aria-label="Previous step" disabled={busy} onClick={()=>{setError('');setStep(step-1);}}><ArrowLeft/></Button>:<span className="rounded-xl bg-blue-500/10 p-3 text-blue-500"><ArrowUpRight size={20}/></span>}<div><DialogTitle>{['Who are you sending to?','Choose your amount','Review your transfer'][step]}</DialogTitle><DialogDescription className="mt-1">Send · Step {step+1} of 3</DialogDescription></div></div></DialogHeader><div className="send-step-dots">{[0,1,2].map(i=><span key={i} className={i<=step?'active':''}/>)}</div><div className="overflow-hidden"><AnimatePresence mode="wait" initial={false}><motion.div key={step} initial={{opacity:0,x:reduce?0:25}} animate={{opacity:1,x:0}} exit={{opacity:0,x:reduce?0:-25}} transition={{duration:reduce?0:.18}}>
 {step===0&&<form className="space-y-5" onSubmit={e=>{e.preventDefault();if(validRecipient&&!blocked)setStep(1);}}><label className="block space-y-2"><span>Recipient address</span><Input autoFocus value={recipient} onChange={e=>setRecipient(e.target.value.trim())} placeholder="0x…" className="h-12 rounded-xl font-mono text-xs"/></label><ContactBook wallet={walletAddress} address={recipient} onSelect={setRecipient}/><p className="text-xs leading-6 text-muted-foreground">Enter a wallet address on Robinhood Chain.</p>{recipient&&!validRecipient&&<p className="text-xs text-red-500">Enter a valid, non-zero wallet address.</p>}{validRecipient&&<RecipientCheck recipient={recipient} assessment={assessment} loading={checking}/>}<Button className="h-12 w-full rounded-xl" disabled={!validRecipient||blocked}>{blocked?'Choose a different address':'Continue'}</Button></form>}
 {step===1&&<form className="space-y-5" onSubmit={e=>{e.preventDefault();if(validAmount)setStep(2);}}><div className="rounded-2xl bg-muted/70 p-5"><div className="mb-5 flex items-center justify-between"><span className="text-xs text-muted-foreground">Amount</span><button type="button" className="flex items-center gap-2 rounded-full bg-card p-2 text-xs" onClick={()=>setPicker(true)}><TokenIcon token={token} size={23}/>{symbol}<ChevronDown size={14}/></button></div><Input aria-label="Send amount" autoFocus inputMode="decimal" placeholder="0.00" value={amount} onChange={e=>setAmount(e.target.value)} className="h-16 border-0 bg-transparent text-4xl shadow-none"/><div className="mt-4 flex justify-between text-xs text-muted-foreground"><span>Available: <Private>{balance!=null?Number(formatUnits(balance,token.decimals)).toLocaleString(undefined,{maximumFractionDigits:6}):'—'}</Private> {symbol}</span><button type="button" className="text-blue-500" disabled={policyCap==null} onClick={()=>policyCap!=null&&setAmount(formatUnits(policyCap,token.decimals))}>Max under your limits</button></div></div><p className="text-xs text-muted-foreground">To <span className="font-mono">{shortAddress(recipient)}</span></p><Button className="h-12 w-full rounded-xl" disabled={!validAmount}>{balance!=null&&raw>balance?'Insufficient balance':'Review transfer'}</Button></form>}
 {step===2&&<div><div className="py-4 text-center"><p className="text-3xl font-medium tracking-tight">{amount} <span className="text-muted-foreground">{symbol}</span></p></div><RecipientCheck recipient={recipient} assessment={assessment} loading={checking} showAddress/><div className="send-review"><div><span>Recipient</span><strong className="max-w-60 break-all text-right font-mono text-xs font-normal">{assessment?.contactName??shortAddress(recipient)}</strong></div><div><span>Token contract</span>{token.native?<strong className="font-normal">Native ETH</strong>:<a className="font-mono text-xs" href={`${EXPLORER}/address/${token.address}`} title={token.address} target="_blank" rel="noreferrer">{shortAddress(token.address)}</a>}</div><div><span>Network</span><strong className="font-normal">Robinhood Chain</strong></div><div><span>Network gas</span><strong className="font-normal">Paid by Veilora</strong></div></div><TransactionCheck items={transactionChecks} footnote="A passing simulation reflects the latest block only. Chain state and co-signer policy are checked again when you submit."/>{simulation?.status==='unavailable'&&<label className="recipient-ack"><input type="checkbox" checked={simulationAck} onChange={e=>setSimulationAck(e.target.checked)}/><span>The call could not be simulated. I reviewed the amount, token and recipient and want to continue.</span></label>}{error&&<p role="alert" className="mb-4 rounded-xl bg-red-500/5 p-3 text-xs text-red-500">{error}</p>}<Button className="h-12 w-full rounded-xl" disabled={busy||!validAmount||!withinPolicy||blocked||checking||!assessment||!simulation||simulation.status==='reverted'||simulation.status==='unavailable'&&!simulationAck||(needsAck&&!acknowledged)} onClick={()=>void send()}>{busy?<><Loader2 className="animate-spin"/>Signing & sending…</>:!validAmount?'Insufficient balance':!withinPolicy&&policyCap!=null?'Over co-signer allowance':simulation?.status==='reverted'?'Transfer would revert':simulation?.status==='unavailable'&&!simulationAck?'Confirm details to continue':'Confirm & send'}</Button></div>}
 </motion.div></AnimatePresence></div></DialogContent></Dialog><TokenPicker open={picker} onClose={()=>setPicker(false)} onPick={t=>{setSymbol(t.symbol);setAmount('');}}/></>;
}
