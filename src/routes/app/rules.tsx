import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, BellRing, CalendarClock, Check, CircleAlert, ExternalLink, Loader2, Lock, Pause, Play, Plus, ShieldCheck, Sparkles, Target, Trash2, Workflow, X } from 'lucide-react';
import { formatUnits, getAddress, type Hex } from 'viem';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageTitle, TokenIcon } from '@/components/wallet/WalletUI';
import { useWallet } from '@/lib/walletContext';
import { WALLET_TOKENS, ROBINHOOD_TOKEN_REGISTRY as TOKENS } from '@/lib/tokens';
import { EXPLORER, performSwap, planSwapCalls, quoteSwap, tokenBalance, type PlannedCall, type SwapQuote } from '@/lib/walletChain';
import { SignPreview } from '@/components/wallet/TxExplanation';
import { CompletionDialog, type CompletionNotice } from '@/components/app/CompletionDialog';
import { createRule, describeAction, describeLimits, describeTrigger, hourLabel, useWalletRules, rawText, resolveExecution, setRuleStatus, WEEKDAY_NAMES, type RuleExecution, type RuleSpec, type RuleTrigger, type WalletRule } from '@/lib/rulesApi';
export const Route=createFileRoute('/app/rules')({component:RulesScreen});

function RulesScreen() {
 const rules=useWalletRules(); const [builder,setBuilder]=useState<RuleSpec|null>(null); const [review,setReview]=useState<RuleExecution|null>(null); const [completion,setCompletion]=useState<CompletionNotice|null>(null);
 const pending=(rules.data?.executions??[]).filter(e=>e.status==='pending'); const history=(rules.data?.executions??[]).filter(e=>e.status!=='pending').slice(0,12);
 const live=(rules.data?.rules??[]).filter(r=>r.status==='active'||r.status==='paused'); const ended=(rules.data?.rules??[]).filter(r=>r.status==='revoked'||r.status==='expired');
 return <><PageTitle title="Wallet Rules" description="Set the conditions. Veilora prepares the move. You approve it." action={<button className="wallet-soft-button" onClick={()=>setBuilder(blankSpec())}><Plus size={15}/>New rule</button>}/>
 {rules.isError&&<p role="alert" className="wallet-error mb-5">{rules.error instanceof Error?rules.error.message:'Rules are unavailable right now.'}</p>}
 <div className="rules-layout"><div className="rules-main">
  <section><div className="wallet-section-heading"><h2>Waiting for you {pending.length>0&&<span className="rules-count">{pending.length}</span>}</h2></div>
   {pending.length?<div className="rules-stack">{pending.map(e=><ApprovalCard key={e.id} run={e} onReview={()=>setReview(e)}/>)}</div>:<div className="wallet-panel rules-quiet"><BellRing size={18}/><p>{rules.isPending?'Checking your rules…':'Nothing to approve. When a rule triggers, its prepared swap waits here for your yes.'}</p></div>}
  </section>
  <section><div className="wallet-section-heading"><h2>Your rules</h2></div>
   {rules.isPending?<div className="wallet-panel wallet-empty"><Loader2 className="animate-spin"/><h3>Loading rules</h3></div>:live.length?<div className="rules-stack">{live.map(r=><RuleCard key={r.id} rule={r} onChanged={message=>setCompletion({title:'Wallet Rule updated',description:message})}/>)}</div>:<EmptyRules onStart={spec=>setBuilder(spec)}/>}
  </section>
  {history.length>0&&<section><div className="wallet-section-heading"><h2>Recent runs</h2></div><div className="wallet-panel rules-history">{history.map(e=><HistoryRow key={e.id} run={e}/>)}</div></section>}
  {ended.length>0&&<section><div className="wallet-section-heading"><h2>Ended</h2></div><div className="rules-stack">{ended.map(r=><RuleCard key={r.id} rule={r} onChanged={message=>setCompletion({title:'Wallet Rule updated',description:message})}/>)}</div></section>}
 </div><RulesAside/></div>
 {builder&&<RuleBuilder initial={builder} onClose={()=>setBuilder(null)} onCreated={name=>{setBuilder(null);setCompletion({title:'Wallet Rule created',description:`“${name}” is live. You’ll approve every run.`});}}/>}
 {review&&<ApprovalReview run={review} onClose={()=>setReview(null)} onDone={message=>{setReview(null);setCompletion({title:message.startsWith('Declined')?'Run declined':'Rule run complete',description:message});}}/>}
 <CompletionDialog notice={completion} onClose={()=>setCompletion(null)}/>
 </>;
}

function RulesAside() {
 return <aside className="rules-aside"><div className="wallet-panel rules-aside-card"><span className="rules-aside-icon"><ShieldCheck size={20}/></span><h3>Approval first, always</h3><p>A rule can only prepare a swap. Every run still needs your device key and Veilora's co-signer, under the same policy limits as a manual swap.</p>
  <ol className="rules-steps">{[['Trigger','Funds arrive, a schedule fires, or a price is reached.'],['Prepare','Veilora sizes the swap within your per-run and daily limits.'],['Approve','You review live quotes and sign, or decline.']].map(([t,d],i)=><li key={t}><span>{i+1}</span><div><strong>{t}</strong><p>{d}</p></div></li>)}</ol></div>
  <div className="wallet-panel rules-aside-card rules-locked"><span className="rules-aside-icon"><Lock size={18}/></span><h3>Automatic mode is not available yet</h3><p>Running rules unattended needs a scoped, audited preauthorization in your smart account that enforces each rule's assets, limits and expiry on-chain. Until that ships, nothing runs without you.</p></div></aside>;
}

function EmptyRules({onStart}:{onStart:(spec:RuleSpec)=>void}) {
 const templates:[string,string,typeof Workflow,RuleSpec][]=[
  ['Split incoming USDG','When USDG arrives, put 20% into META and 20% into NVDA.',Workflow,{...blankSpec(),name:'Split incoming USDG',allocations:[{asset:'META',percent:20},{asset:'NVDA',percent:20}]}],
  ['Weekly buy','Every Monday, buy 50 USDG of SPY.',CalendarClock,{...blankSpec(),name:'Weekly SPY buy',trigger:{type:'schedule',frequency:'weekly',hourUtc:14,weekday:1},source:{asset:'USDG',amount:'50'},allocations:[{asset:'SPY',percent:100}],limits:{...blankSpec().limits,maxPerRun:'50',dailyCap:'50'}}],
  ['Buy the dip','When NVDA drops below a price, buy 100 USDG of it.',Target,{...blankSpec(),name:'Buy NVDA dip',trigger:{type:'price',asset:'NVDA',direction:'below',priceUsdg:'150'},source:{asset:'USDG',amount:'100'},allocations:[{asset:'NVDA',percent:100}],limits:{...blankSpec().limits,maxPerRun:'100',dailyCap:'100'}}],
 ];
 return <div className="wallet-panel rules-empty"><span className="wallet-empty-icon"><Sparkles/></span><h3>Your wallet, on your terms</h3><p>Start from a template or build your own rule. You stay in control of every run.</p><div className="rules-templates">{templates.map(([title,text,Icon,spec])=><button key={title} onClick={()=>onStart(spec)}><Icon size={18}/><strong>{title}</strong><span>{text}</span><em>Use template <ArrowRight size={13}/></em></button>)}</div></div>;
}

function statusLabel(rule:WalletRule) {
 if(rule.status!=='active') return rule.status;
 const t=rule.spec.trigger;
 if(t.type==='schedule'&&rule.nextRunAt) return `Next ${new Date(rule.nextRunAt).toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}`;
 if(t.type==='price'&&rule.lastPriceRaw) return `Now ${Number(formatUnits(BigInt(rule.lastPriceRaw),6)).toLocaleString(undefined,{maximumFractionDigits:2})} USDG`;
 return rule.lastCheckedAt?'Watching':'Starting';
}

function RuleCard({rule,onChanged}:{rule:WalletRule;onChanged:(m:string)=>void}) {
 const {walletAddress,getStoredDeviceKey}=useWallet(); const cache=useQueryClient(); const [busy,setBusy]=useState(''); const [confirmRevoke,setConfirmRevoke]=useState(false); const [error,setError]=useState('');
 const Icon=rule.spec.trigger.type==='incoming'?Workflow:rule.spec.trigger.type==='schedule'?CalendarClock:Target;
 async function act(action:'pause'|'resume'|'revoke'){const key=getStoredDeviceKey();if(!key){setError('Unlock your device key first.');return;}setBusy(action);setError('');try{await setRuleStatus(walletAddress,key as Hex,rule.id,action);onChanged(action==='pause'?`“${rule.name}” is paused.`:action==='resume'?`“${rule.name}” is live again.`:`“${rule.name}” was revoked. Waiting runs were closed.`);void cache.invalidateQueries({queryKey:['wallet-rules']});}catch(e){setError(e instanceof Error?e.message:'Could not update the rule.');}finally{setBusy('');setConfirmRevoke(false);}}
 const ended=rule.status==='revoked'||rule.status==='expired';
 return <article className={`wallet-panel rule-card ${ended?'ended':''}`}><div className="rule-card-head"><span className={`rule-icon ${rule.spec.trigger.type}`}><Icon size={19}/></span><div className="min-w-0 flex-1"><h3>{rule.name}</h3><p>{describeTrigger(rule.spec.trigger)}, {describeAction(rule.spec)}.</p></div><span className={`rule-status ${rule.status}`}>{statusLabel(rule)}</span></div>
  <div className="rule-allocations">{rule.spec.allocations.map(a=><span key={a.asset}><TokenIcon token={TOKENS[a.asset]} size={18}/>{a.asset}<b>{a.percent}%</b></span>)}<span className="rule-from">from {rule.spec.source.asset}</span></div>
  <p className="rule-limits">{describeLimits(rule.spec)}</p>
  {error&&<p role="alert" className="wallet-error mt-3">{error}</p>}
  {!ended&&<div className="rule-actions"><span className="rule-mode"><ShieldCheck size={14}/>Approval first</span>{confirmRevoke?<><span className="text-[11px] text-[var(--w-muted)]">Revoke permanently?</span><button className="rule-button danger" disabled={!!busy} onClick={()=>void act('revoke')}>{busy==='revoke'?<Loader2 size={14} className="animate-spin"/>:<Check size={14}/>}Revoke</button><button className="rule-button" onClick={()=>setConfirmRevoke(false)}>Keep</button></>:<>{rule.status==='active'?<button className="rule-button" disabled={!!busy} onClick={()=>void act('pause')}>{busy==='pause'?<Loader2 size={14} className="animate-spin"/>:<Pause size={14}/>}Pause</button>:<button className="rule-button" disabled={!!busy} onClick={()=>void act('resume')}>{busy==='resume'?<Loader2 size={14} className="animate-spin"/>:<Play size={14}/>}Resume</button>}<button className="rule-button danger" disabled={!!busy} onClick={()=>setConfirmRevoke(true)}><Trash2 size={14}/>Revoke</button></>}</div>}
 </article>;
}

function triggerText(run:RuleExecution) {
 const t=run.trigger;
 if(t.kind==='incoming'&&t.baseRaw&&t.asset) return `${rawText(t.baseRaw,t.asset)} arrived`;
 if(t.kind==='price'&&t.priceRaw&&t.asset) return `${t.asset} hit ${Number(formatUnits(BigInt(t.priceRaw),6)).toLocaleString(undefined,{maximumFractionDigits:2})} USDG`;
 if(t.kind==='schedule'&&t.dueAt) return `Scheduled run · ${new Date(t.dueAt).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}`;
 return 'Rule triggered';
}
const timeLeft=(iso:string)=>{const ms=Date.parse(iso)-Date.now();if(ms<=0)return 'expiring';const h=Math.floor(ms/3600000);return h>=1?`${h}h left`:`${Math.max(1,Math.floor(ms/60000))}m left`;};

function ApprovalCard({run,onReview}:{run:RuleExecution;onReview:()=>void}) {
 return <article className="wallet-panel approval-card"><div className="approval-top"><span className="approval-pulse"/><div className="min-w-0 flex-1"><strong>{run.ruleName}</strong><small>{triggerText(run)}{run.trigger.txHash&&<a href={`${EXPLORER}/tx/${run.trigger.txHash}`} target="_blank" rel="noreferrer" aria-label="View trigger transaction"><ExternalLink size={12}/></a>}</small></div><span className="approval-timer">{timeLeft(run.expiresAt)}</span></div>
  <div className="approval-legs">{run.legs.map(l=><div key={l.asset}><span>{rawText(l.amountRaw,run.sourceAsset)}</span><ArrowRight size={14}/><span className="approval-target"><TokenIcon token={TOKENS[l.asset]} size={20}/>{l.asset}</span></div>)}</div>
  {run.reason&&<p className="approval-reason"><CircleAlert size={13}/>{run.reason}</p>}
  <button className="wallet-primary-button" onClick={onReview}>Review & approve</button></article>;
}

function HistoryRow({run}:{run:RuleExecution}) {
 const label={executed:'Executed',failed:'Failed',declined:'Declined',skipped:'Skipped',expired:'Expired',pending:'Pending'}[run.status];
 return <div className="history-row"><div className="min-w-0 flex-1"><strong>{run.ruleName}</strong><small>{triggerText(run)} · {new Date(run.createdAt).toLocaleDateString(undefined,{month:'short',day:'numeric'})}{run.legs.length>0&&` · ${rawText(run.totalRaw,run.sourceAsset)} → ${run.legs.map(l=>l.asset).join(', ')}`}</small>{(run.reason||run.error)&&run.status!=='executed'&&<small className="history-note">{run.error||run.reason}</small>}</div><div className="history-side">{run.txHashes.map((h,i)=><a key={h} href={`${EXPLORER}/tx/${h}`} target="_blank" rel="noreferrer" aria-label={`View transaction ${i+1}`}><ExternalLink size={13}/></a>)}<span className={`wallet-status ${run.status==='executed'?'confirmed':run.status==='failed'?'failed':run.status==='pending'?'pending':''}`}>{label}</span></div></div>;
}

type LegQuote={asset:string;amountRaw:bigint;quote?:SwapQuote;error?:string};
function ApprovalReview({run,onClose,onDone}:{run:RuleExecution;onClose:()=>void;onDone:(m:string)=>void}) {
 const {walletAddress,getStoredDeviceKey}=useWallet(); const cache=useQueryClient(); const source=TOKENS[run.sourceAsset];
 const [legs,setLegs]=useState<LegQuote[]>([]); const [loading,setLoading]=useState(true); const [balance,setBalance]=useState<bigint|null>(null); const [busy,setBusy]=useState(''); const [error,setError]=useState(''); const [refresh,setRefresh]=useState(0); const [now,setNow]=useState(Date.now());
 const total=useMemo(()=>run.legs.reduce((s,l)=>s+BigInt(l.amountRaw),0n),[run]);
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t);},[]);
 useEffect(()=>{let active=true;setLoading(true);setError('');
  void Promise.all([tokenBalance(getAddress(walletAddress),source).catch(()=>null),...run.legs.map(async l=>{const amountRaw=BigInt(l.amountRaw);try{return {asset:l.asset,amountRaw,quote:await quoteSwap(source,TOKENS[l.asset],amountRaw,run.slippageBps)};}catch(e){return {asset:l.asset,amountRaw,error:e instanceof Error?e.message:'No quote'};}})]).then(([bal,...quoted])=>{if(!active)return;setBalance(bal as bigint|null);setLegs(quoted as LegQuote[]);}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};},[run,refresh,walletAddress,source]);
 const [planned,setPlanned]=useState<PlannedCall[]>([]);
 useEffect(()=>{setPlanned([]);if(loading||!legs.length||legs.some(l=>!l.quote))return;let active=true;void Promise.all(legs.map(l=>planSwapCalls(getAddress(walletAddress),source,TOKENS[l.asset],l.quote!))).then(plans=>{if(active)setPlanned(plans.flatMap(p=>[...(p.approval?[p.approval]:[]),p.swap]));}).catch(()=>{});return()=>{active=false;};},[legs,loading,walletAddress,source]);
 const expired=legs.some(l=>l.quote&&l.quote.expiresAt<=now); const missing=legs.some(l=>!l.quote); const enough=balance!=null&&balance>=total;
 async function approve(){const key=getStoredDeviceKey();if(!key){setError('Unlock your device key before approving.');return;}const hashes:string[]=[];setError('');
  try{for(const [i,l] of legs.entries()){const fresh=l.quote&&l.quote.expiresAt-Date.now()>15000?l.quote:await quoteSwap(source,TOKENS[l.asset],l.amountRaw,run.slippageBps);setBusy(`Swap ${i+1} of ${legs.length}: ${l.asset}…`);hashes.push(await performSwap(getAddress(walletAddress),key as Hex,source,TOKENS[l.asset],fresh,s=>setBusy(`Swap ${i+1} of ${legs.length}: ${s}`)));}
   await resolveExecution(walletAddress,key as Hex,run.id,'executed',hashes);onDone(`“${run.ruleName}” ran: ${legs.length} swap${legs.length>1?'s':''} confirmed.`);}
  catch(e){const message=e instanceof Error?e.message:'The swap could not be completed.';setError(hashes.length?`${hashes.length} of ${legs.length} swaps completed before this failed: ${message}`:message);
   if(hashes.length){try{await resolveExecution(walletAddress,key as Hex,run.id,'failed',hashes,message);}catch{/* the run stays pending and can be declined */}}}
  finally{setBusy('');void cache.invalidateQueries({queryKey:['wallet-rules']});void cache.invalidateQueries({queryKey:['holdings']});void cache.invalidateQueries({queryKey:['transactions']});}}
 async function decline(){const key=getStoredDeviceKey();if(!key){setError('Unlock your device key first.');return;}setBusy('Declining…');try{await resolveExecution(walletAddress,key as Hex,run.id,'declined');void cache.invalidateQueries({queryKey:['wallet-rules']});onDone(`Declined this run of “${run.ruleName}”. The rule stays active.`);}catch(e){setError(e instanceof Error?e.message:'Could not decline.');}finally{setBusy('');}}
 return <Dialog open onOpenChange={v=>{if(!v&&!busy)onClose();}}><DialogContent className="wallet-dialog sm:max-w-lg"><DialogHeader><DialogTitle>Approve this run</DialogTitle><DialogDescription>{run.ruleName} · {triggerText(run)}</DialogDescription></DialogHeader>
  <div className="review-legs">{loading?<div className="review-loading"><Loader2 className="animate-spin" size={18}/>Getting live quotes…</div>:legs.map(l=><div key={l.asset} className="review-leg"><div className="review-leg-pair"><TokenIcon token={source} size={26}/><ArrowRight size={14}/><TokenIcon token={TOKENS[l.asset]} size={26}/><div><strong>{rawText(l.amountRaw,run.sourceAsset)} → {l.asset}</strong><small>{l.quote?`Uniswap ${l.quote.venue==='uniswap-v4'?'v4':'v3'} · ${l.quote.fee/10000}% pool`:l.error}</small></div></div>{l.quote&&<dl><div><dt>Expected</dt><dd>{rawText(l.quote.amountOut,l.asset)}</dd></div><div><dt>Minimum received</dt><dd>{rawText(l.quote.minOut,l.asset)}</dd></div></dl>}</div>)}</div>
  <div className="send-review"><div><span>Total from your wallet</span><strong>{rawText(total,run.sourceAsset)}</strong></div><div><span>Your balance</span><strong>{balance==null?'—':rawText(balance,run.sourceAsset)}</strong></div><div><span>Max slippage</span><strong>{run.slippageBps/100}%</strong></div><div><span>Network</span><strong>Robinhood Chain</strong></div><div><span>Network fee</span><strong>Paid by Veilora's relayer</strong></div><div><span>Signing</span><strong>Your device key + co-signer</strong></div></div>
  <SignPreview wallet={walletAddress} calls={planned}/>
  <ul className="review-risks"><li>Each target is a separate swap. If one fails, the ones before it stay completed.</li>{!source.native&&<li>A token approval may be signed first, limited to each swap's amount.</li>}<li>Prices move. You receive at least the minimum shown, or the swap does not execute.</li></ul>
  {!loading&&!enough&&<p role="alert" className="wallet-error mb-3">Your {run.sourceAsset} balance is below this run's total. Top up or decline it.</p>}
  {error&&<p role="alert" className="wallet-error mb-3">{error}</p>}
  <div className="review-actions"><button className="rule-button" disabled={!!busy} onClick={()=>void decline()}><X size={14}/>Decline</button>{expired?<button className="wallet-primary-button" disabled={!!busy} onClick={()=>setRefresh(v=>v+1)}>Refresh quotes</button>:<button className="wallet-primary-button" disabled={loading||missing||!enough||!!busy} onClick={()=>void approve()}>{busy?<><Loader2 size={16} className="animate-spin"/>{busy}</>:'Approve & sign'}</button>}</div>
 </DialogContent></Dialog>;
}

const TOKEN_ASSETS=WALLET_TOKENS.map(t=>t.symbol);
const daysFromNow=(d:number)=>new Date(Date.now()+d*86400000).toISOString();
function blankSpec():RuleSpec {return {version:1,name:'Split incoming USDG',trigger:{type:'incoming',asset:'USDG',minAmount:'10'},source:{asset:'USDG'},allocations:[{asset:'NVDA',percent:20}],limits:{maxPerRun:'500',dailyCap:'1000',slippageBps:50,expiresAt:daysFromNow(90)},mode:'approval'};}

function RuleBuilder({initial,onClose,onCreated}:{initial:RuleSpec;onClose:()=>void;onCreated:(name:string)=>void}) {
 const {walletAddress,getStoredDeviceKey}=useWallet(); const cache=useQueryClient();
 const [spec,setSpec]=useState<RuleSpec>(initial); const [days,setDays]=useState(90); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [price,setPrice]=useState<string|null>(null);
 const t=spec.trigger; const sourceAsset=t.type==='incoming'?t.asset:spec.source.asset; const percentTotal=spec.allocations.reduce((s,a)=>s+a.percent,0);
 const patch=(p:Partial<RuleSpec>)=>setSpec(s=>({...s,...p}));
 const setTrigger=(next:RuleTrigger)=>setSpec(s=>{const source=next.type==='incoming'?{asset:next.asset}:{asset:s.source.asset,amount:s.source.amount??'50'};const kept=s.allocations.filter(a=>a.asset!==source.asset);return {...s,trigger:next,source,allocations:kept.length?kept:[{asset:source.asset==='NVDA'?'SPY':'NVDA',percent:20}]};});
 const watched=t.type==='price'?t.asset:null;
 useEffect(()=>{setPrice(null);if(!watched)return;let active=true;void quoteSwap(TOKENS[watched],TOKENS.USDG,10n**BigInt(TOKENS[watched].decimals),50).then(q=>{if(active)setPrice(Number(formatUnits(q.amountOut,6)).toLocaleString(undefined,{maximumFractionDigits:2}));}).catch(()=>{if(active)setPrice('unavailable');});return()=>{active=false;};},[watched]);
 async function submit(){const key=getStoredDeviceKey();if(!key){setError('Unlock your device key to sign this rule.');return;}setBusy(true);setError('');
  try{const final:RuleSpec={...spec,source:t.type==='incoming'?{asset:t.asset}:{asset:spec.source.asset,amount:spec.source.amount},limits:{...spec.limits,expiresAt:daysFromNow(days)}};await createRule(walletAddress,key as Hex,final);void cache.invalidateQueries({queryKey:['wallet-rules']});onCreated(final.name);}
  catch(e){setError(e instanceof Error?e.message:'Could not create the rule.');}finally{setBusy(false);}}
 const targets=TOKEN_ASSETS.filter(s=>s!==sourceAsset);
 return <Dialog open onOpenChange={v=>{if(!v&&!busy)onClose();}}><DialogContent className="wallet-dialog rule-builder sm:max-w-xl"><DialogHeader><DialogTitle>New wallet rule</DialogTitle><DialogDescription>Rules prepare swaps. You approve each run.</DialogDescription></DialogHeader>
  <label className="builder-field"><span>Name</span><input className="builder-input" maxLength={60} value={spec.name} onChange={e=>patch({name:e.target.value})}/></label>
  <fieldset className="builder-block"><legend>When</legend><div className="builder-segments" role="radiogroup">{([['incoming','Funds arrive',Workflow],['schedule','On a schedule',CalendarClock],['price','Price target',Target]] as const).map(([type,label,Icon])=><button key={type} role="radio" aria-checked={t.type===type} className={t.type===type?'on':''} onClick={()=>t.type!==type&&setTrigger(type==='incoming'?{type,asset:'USDG',minAmount:'10'}:type==='schedule'?{type,frequency:'weekly',hourUtc:14,weekday:1}:{type,asset:'NVDA',direction:'below',priceUsdg:'150'})}><Icon size={16}/>{label}</button>)}</div>
   {t.type==='incoming'&&<div className="builder-row"><label className="builder-field"><span>Asset received</span><select className="wallet-select" value={t.asset} onChange={e=>setTrigger({...t,asset:e.target.value})}>{TOKEN_ASSETS.filter(s=>s!=='ETH').map(s=><option key={s}>{s}</option>)}</select></label><label className="builder-field"><span>Minimum amount</span><input className="builder-input" inputMode="decimal" value={t.minAmount} onChange={e=>setTrigger({...t,minAmount:e.target.value})}/></label></div>}
   {t.type==='schedule'&&<div className="builder-row"><label className="builder-field"><span>Repeat</span><select className="wallet-select" value={t.frequency} onChange={e=>{const f=e.target.value as 'daily'|'weekly'|'monthly';setTrigger({type:'schedule',frequency:f,hourUtc:t.hourUtc,...(f==='weekly'?{weekday:1}:f==='monthly'?{dayOfMonth:1}:{})});}}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
    {t.frequency==='weekly'&&<label className="builder-field"><span>Day</span><select className="wallet-select" value={t.weekday} onChange={e=>setTrigger({...t,weekday:Number(e.target.value)})}>{WEEKDAY_NAMES.map((d,i)=><option key={d} value={i}>{d}</option>)}</select></label>}
    {t.frequency==='monthly'&&<label className="builder-field"><span>Day of month</span><select className="wallet-select" value={t.dayOfMonth} onChange={e=>setTrigger({...t,dayOfMonth:Number(e.target.value)})}>{Array.from({length:28},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}</select></label>}
    <label className="builder-field"><span>Time</span><select className="wallet-select" value={t.hourUtc} onChange={e=>setTrigger({...t,hourUtc:Number(e.target.value)})}>{Array.from({length:24},(_,h)=><option key={h} value={h}>{hourLabel(h)} · {new Date(Date.UTC(2026,0,1,h)).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})} local</option>)}</select></label></div>}
   {t.type==='price'&&<><div className="builder-row"><label className="builder-field"><span>Asset to watch</span><select className="wallet-select" value={t.asset} onChange={e=>setTrigger({...t,asset:e.target.value})}>{TOKEN_ASSETS.filter(s=>s!=='USDG').map(s=><option key={s}>{s}</option>)}</select></label><label className="builder-field"><span>Condition</span><select className="wallet-select" value={t.direction} onChange={e=>setTrigger({...t,direction:e.target.value as 'above'|'below'})}><option value="below">Falls to or below</option><option value="above">Rises to or above</option></select></label><label className="builder-field"><span>Price (USDG)</span><input className="builder-input" inputMode="decimal" value={t.priceUsdg} onChange={e=>setTrigger({...t,priceUsdg:e.target.value})}/></label></div><p className="builder-hint">Current Uniswap price: {price===null?'checking…':price==='unavailable'?'unavailable':`${price} USDG`}. The rule fires once per crossing.</p></>}
  </fieldset>
  <fieldset className="builder-block"><legend>Do</legend>
   {t.type!=='incoming'&&<div className="builder-row"><label className="builder-field"><span>Spend</span><select className="wallet-select" value={spec.source.asset} onChange={e=>setSpec(s=>({...s,source:{...s.source,asset:e.target.value},allocations:s.allocations.filter(a=>a.asset!==e.target.value)}))}>{TOKEN_ASSETS.map(s=><option key={s}>{s}</option>)}</select></label><label className="builder-field"><span>Amount per run</span><input className="builder-input" inputMode="decimal" value={spec.source.amount??''} onChange={e=>patch({source:{...spec.source,amount:e.target.value}})}/></label></div>}
   <p className="builder-hint">{t.type==='incoming'?`Swap a share of each ${t.asset} arrival into:`:`Split the ${spec.source.amount||'—'} ${spec.source.asset} into:`}</p>
   <div className="builder-allocations">{spec.allocations.map((a,i)=><div key={i} className="builder-allocation"><select className="wallet-select" aria-label={`Target asset ${i+1}`} value={a.asset} onChange={e=>patch({allocations:spec.allocations.map((x,j)=>j===i?{...x,asset:e.target.value}:x)})}>{targets.filter(s=>s===a.asset||!spec.allocations.some(x=>x.asset===s)).map(s=><option key={s}>{s}</option>)}</select><div className="builder-percent"><input aria-label={`Percent for ${a.asset}`} inputMode="numeric" value={a.percent} onChange={e=>patch({allocations:spec.allocations.map((x,j)=>j===i?{...x,percent:Math.max(0,Math.min(100,Number(e.target.value.replace(/\D/g,''))||0))}:x)})}/>%</div>{spec.allocations.length>1&&<button className="wallet-icon-button" aria-label={`Remove ${a.asset}`} onClick={()=>patch({allocations:spec.allocations.filter((_,j)=>j!==i)})}><X size={15}/></button>}</div>)}
    {spec.allocations.length<4&&<button className="builder-add" onClick={()=>{const next=targets.find(s=>!spec.allocations.some(a=>a.asset===s));if(next)patch({allocations:[...spec.allocations,{asset:next,percent:10}]});}}><Plus size={14}/>Add asset</button>}</div>
   <p className={`builder-hint ${percentTotal>100?'text-red-500':''}`}>{percentTotal}% allocated{t.type==='incoming'?`, ${100-percentTotal>0?`${100-percentTotal}% stays as ${t.asset}`:'nothing kept'}`:''}.</p>
  </fieldset>
  <fieldset className="builder-block"><legend>Limits</legend><div className="builder-row"><label className="builder-field"><span>Max per run ({sourceAsset})</span><input className="builder-input" inputMode="decimal" value={spec.limits.maxPerRun} onChange={e=>patch({limits:{...spec.limits,maxPerRun:e.target.value}})}/></label><label className="builder-field"><span>Daily cap ({sourceAsset})</span><input className="builder-input" inputMode="decimal" value={spec.limits.dailyCap} onChange={e=>patch({limits:{...spec.limits,dailyCap:e.target.value}})}/></label></div>
   <div className="builder-row"><label className="builder-field"><span>Max slippage</span><select className="wallet-select" value={spec.limits.slippageBps} onChange={e=>patch({limits:{...spec.limits,slippageBps:Number(e.target.value)}})}>{[10,50,100,200,300].map(b=><option key={b} value={b}>{b/100}%</option>)}</select></label><label className="builder-field"><span>Ends after</span><select className="wallet-select" value={days} onChange={e=>setDays(Number(e.target.value))}>{[7,30,90,180,365].map(d=><option key={d} value={d}>{d===365?'1 year':`${d} days`}</option>)}</select></label></div></fieldset>
  <fieldset className="builder-block"><legend>Execution mode</legend><div className="builder-modes"><div className="builder-mode on" role="radio" aria-checked="true"><ShieldCheck size={18}/><div><strong>Approval first</strong><span>Veilora prepares each run. You review live quotes and sign with your device key and co-signer.</span></div><Check size={16} className="ml-auto shrink-0"/></div><div className="builder-mode locked" role="radio" aria-checked="false" aria-disabled="true"><Lock size={18}/><div><strong>Automatic <em>Not available yet</em></strong><span>Needs an audited, scoped preauthorization in your smart account. Nothing will run unattended until it ships.</span></div></div></div></fieldset>
  <div className="builder-summary"><Sparkles size={16}/><p>{describeTrigger(t)}, {describeAction({...spec,source:t.type==='incoming'?{asset:t.asset}:spec.source})}. {describeLimits({...spec,source:{asset:sourceAsset},limits:{...spec.limits,expiresAt:daysFromNow(days)}})}. You approve every run.</p></div>
  {error&&<p role="alert" className="wallet-error mb-3">{error}</p>}
  <button className="wallet-primary-button" disabled={busy||!spec.name.trim()||percentTotal<1||percentTotal>100} onClick={()=>void submit()}>{busy?<><Loader2 size={16} className="animate-spin"/>Signing rule…</>:'Sign & create rule'}</button>
 </DialogContent></Dialog>;
}
