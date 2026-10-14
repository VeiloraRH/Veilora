import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronDown, Clock3, ExternalLink, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { formatUnits, getAddress, type Address, type Hex } from 'viem';
import { getBridgeQuote, getBridgeStatus, type BridgeQuote } from '@/lib/api';
import { useWallet } from '@/lib/walletContext';
import { useHoldings } from '@/lib/walletQueries';
import { executeWalletCall, rawAmount } from '@/lib/walletChain';
import { PageTitle, TokenIcon, shortAddress } from '@/components/wallet/WalletUI';
import { TokenPicker } from '@/components/wallet/TokenPicker';
import { ROBINHOOD_TOKEN_REGISTRY, type WalletToken } from '@/lib/tokens';

export const Route = createFileRoute('/app/bridge')({ component: BridgeScreen });

const NATIVE = '0x0000000000000000000000000000000000000000';
const USDG = '0x5fc5360d0400a0fd4f2af552add042d716f1d168';
const DESTINATIONS = [
  { chainId: 8453, name: 'Base', explorer: 'https://basescan.org', assets: [
    { symbol: 'ETH', currency: NATIVE, decimals: 18 },
    { symbol: 'USDC', currency: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', decimals: 6 },
  ] },
  { chainId: 1, name: 'Ethereum', explorer: 'https://etherscan.io', assets: [
    { symbol: 'ETH', currency: NATIVE, decimals: 18 },
    { symbol: 'USDC', currency: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', decimals: 6 },
    { symbol: 'USDT', currency: '0xdac17f958d2ee523a2206206994597c13d831ec7', decimals: 6 },
  ] },
] as const;
const SOURCES = [
  { symbol: 'ETH', currency: NATIVE, decimals: 18 },
  { symbol: 'USDG', currency: USDG, decimals: 6 },
] as const;
type BridgeRecord = {
  requestId: string; chainId: number; chainName: string; explorer: string; sourceSymbol: string; amount: string;
  outputSymbol: string; outputAmount: string; recipient: string; sourceHash?: string; status: string;
  destinationHashes: string[]; updatedAt?: string;
};
const storageKey = (wallet: string) => `veilora:bridge:tracking:${wallet.toLowerCase()}`;
const recordsFor = (wallet: string): BridgeRecord[] => {
  try { return JSON.parse(localStorage.getItem(storageKey(wallet)) || '[]') as BridgeRecord[]; } catch { return []; }
};
const outputSummary = (value: string, decimals: number, symbol: string) => `${Number(formatUnits(BigInt(value), decimals)).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${symbol}`;
const feeSummary = (fees: BridgeQuote['fees']) => Object.values(fees || {})
  .filter((fee) => Number(fee.amountUsd || 0) > 0)
  .map((fee) => `${fee.amountFormatted ?? '—'} ${fee.currency?.symbol ?? ''}`.trim());

function BridgeScreen() {
  const { walletAddress, getStoredDeviceKey } = useWallet();
  const holdings = useHoldings();
  const cache = useQueryClient();
  const [sourceSymbol, setSourceSymbol] = useState<'ETH' | 'USDG'>('ETH');
  const [destinationChainId, setDestinationChainId] = useState<number>(8453);
  const [destinationSymbol, setDestinationSymbol] = useState('ETH');
  const [picker, setPicker] = useState<'source' | 'destination' | null>(null);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState(1);
  const [quote, setQuote] = useState<BridgeQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [now, setNow] = useState(Date.now());
  const [records, setRecords] = useState<BridgeRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [quoteRefresh, setQuoteRefresh] = useState(0);

  const source = SOURCES.find((asset) => asset.symbol === sourceSymbol)!;
  const destinationChain = DESTINATIONS.find((chain) => chain.chainId === destinationChainId)!;
  const destination = destinationChain.assets.find((asset) => asset.symbol === destinationSymbol) || destinationChain.assets[0];
  const destinationTokens: WalletToken[] = destinationChain.assets.map((asset) => {
    const known = ROBINHOOD_TOKEN_REGISTRY[asset.symbol];
    return {
      symbol: asset.symbol,
      name: known?.name || (asset.symbol === 'ETH' ? 'Ether' : asset.symbol === 'USDC' ? 'USD Coin' : 'Tether USD'),
      address: asset.currency as Address,
      decimals: asset.decimals,
      logo: known?.logo || `/tokens/${asset.symbol.toLowerCase()}.svg`,
      stock: false,
      native: asset.symbol === 'ETH',
      category: 'crypto',
    };
  });
  const sourceTokens = [ROBINHOOD_TOKEN_REGISTRY.ETH, ROBINHOOD_TOKEN_REGISTRY.USDG];
  const sourceToken = ROBINHOOD_TOKEN_REGISTRY[sourceSymbol] as WalletToken;
  const balance = holdings.data?.find((holding) => holding.token.symbol === sourceSymbol)?.raw;
  const policyCap = balance == null ? null : sourceSymbol === 'ETH'
    ? (balance > 50_000_000_000_000_000n ? (balance - 50_000_000_000_000_000n) / 5n : 0n)
    : balance / 5n;
  const quoteExpired = !!quote && quote.expiresAt <= now;
  const amountRaw = useMemo(() => {
    try { return rawAmount(amount, source.decimals); } catch { return null; }
  }, [amount, source.decimals]);
  const validRecipient = /^0x[\da-f]{40}$/i.test(recipient.trim()) && !/^0x0{40}$/i.test(recipient.trim());

  useEffect(() => {
    setRecords(recordsFor(walletAddress));
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [walletAddress]);

  useEffect(() => {
    setDestinationSymbol('ETH');
    setQuote(null);
  }, [destinationChainId]);

  useEffect(() => {
    setQuote(null);
    setError('');
    if (!amountRaw || !validRecipient) { setQuoting(false); return; }
    let active = true;
    const timer = setTimeout(() => {
      setQuoting(true);
      void getBridgeQuote({
        ownerAddress: walletAddress,
        recipient: recipient.trim(),
        originCurrency: source.currency,
        destinationChainId,
        destinationCurrency: destination.currency,
        amount: amountRaw.toString(),
      }).then((result) => { if (active) setQuote(result.quote); })
        .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Could not get a route.'); })
        .finally(() => { if (active) setQuoting(false); });
    }, 450);
    return () => { active = false; clearTimeout(timer); };
  }, [amountRaw, destination.currency, destinationChainId, recipient, source.currency, walletAddress, quoteRefresh]);

  const persistRecords = (next: BridgeRecord[]) => {
    setRecords(next);
    localStorage.setItem(storageKey(walletAddress), JSON.stringify(next.slice(0, 20)));
  };

  const refreshRecord = async (record: BridgeRecord) => {
    const result = await getBridgeStatus(record.requestId);
    const status = result.status;
    const updated: BridgeRecord = {
      ...record,
      status: status.status,
      destinationHashes: status.outTxHashes,
      updatedAt: status.updatedAt || undefined,
    };
    const next = recordsFor(walletAddress).map((item) => item.requestId === record.requestId ? updated : item);
    persistRecords(next);
  };

  const refreshAll = async () => {
    if (!records.length || refreshing) return;
    setRefreshing(true);
    await Promise.allSettled(records.filter((record) => !['success', 'completed', 'failure', 'failed', 'refund', 'refunded'].includes(record.status.toLowerCase())).map(refreshRecord));
    setRefreshing(false);
  };

  useEffect(() => {
    const timer = setInterval(() => { void refreshAll(); }, 20_000);
    return () => clearInterval(timer);
  }, [records, refreshing]);

  async function submitBridge() {
    if (!quote || quoteExpired || busy || !amountRaw || !validRecipient) return;
    const key = getStoredDeviceKey();
    if (!key) { setError('Unlock your device key before bridging.'); return; }
    if (balance == null || amountRaw > balance) { setError(`Your ${sourceSymbol} balance is too low for this transfer.`); return; }
    if (policyCap == null || amountRaw > policyCap) { setError('This amount exceeds Veilora’s current per-transaction signing limit for this asset.'); return; }
    const sameQuote = quote.input.ownerAddress.toLowerCase() === walletAddress.toLowerCase() &&
      quote.input.recipient.toLowerCase() === recipient.trim().toLowerCase() && quote.input.amount === amountRaw.toString() &&
      quote.input.originCurrency.toLowerCase() === source.currency.toLowerCase() &&
      quote.input.destinationChainId === destinationChainId && quote.input.destinationCurrency.toLowerCase() === destination.currency.toLowerCase();
    if (!sameQuote) { setError('This quote no longer matches your selections. Request a fresh quote.'); return; }

    setError('');
    try {
      const address = getAddress(walletAddress) as Address;
      let sourceHash: string | undefined;
      let trackingRecord: BridgeRecord | null = null;
      for (const tx of quote.steps) {
        if (Date.now() >= quote.expiresAt) throw new Error('The quote expired. Request a fresh quote before continuing.');
        setBusy(tx.id === 'approve' ? 'Approving source token…' : 'Submitting bridge deposit…');
        if (tx.id === 'deposit') {
          trackingRecord = {
            requestId: quote.requestId,
            chainId: destinationChainId,
            chainName: destinationChain.name,
            explorer: destinationChain.explorer,
            sourceSymbol,
            amount,
            outputSymbol: destination.symbol,
            outputAmount: outputSummary(quote.amountOut, quote.outputDecimals, quote.outputSymbol),
            recipient: recipient.trim(),
            status: 'submitting',
            destinationHashes: [],
          };
          persistRecords([trackingRecord, ...recordsFor(walletAddress).filter((item) => item.requestId !== quote.requestId)]);
        }
        const hash = await executeWalletCall(address, key as Hex, getAddress(tx.to), BigInt(tx.value), tx.data as Hex);
        if (tx.id === 'deposit') {
          sourceHash = hash;
          trackingRecord = { ...trackingRecord!, sourceHash, status: 'submitted' };
          persistRecords([trackingRecord, ...recordsFor(walletAddress).filter((item) => item.requestId !== quote.requestId)]);
        }
      }
      setBusy('Tracking delivery…');
      if (trackingRecord) await refreshRecord(trackingRecord).catch(() => undefined);
      void cache.invalidateQueries({ queryKey: ['holdings'] });
      void cache.invalidateQueries({ queryKey: ['transactions'] });
      setStep(4);
      setAmount('');
      setQuote(null);
    } catch (cause) {
      setError(cause instanceof Error ? `${cause.message} Check wallet activity before trying again.` : 'Bridge submission failed. Check wallet activity before trying again.');
    } finally {
      setBusy('');
    }
  }

  const formattedBalance = balance == null ? '—' : Number(formatUnits(balance, source.decimals)).toLocaleString(undefined, { maximumFractionDigits: 6 });
  const formattedPolicyCap = policyCap == null ? '—' : Number(formatUnits(policyCap, source.decimals)).toLocaleString(undefined, { maximumFractionDigits: 6 });
  const fees = quote ? feeSummary(quote.fees) : [];
  const lastDeposit = records[0];

  return <>
    <PageTitle title="Bridge" description="Move ETH or USDG from Robinhood Chain to Base or Ethereum." />
    <div className="wallet-bridge-layout">
      <section className="wallet-panel wallet-bridge-card">
        <div className="wallet-bridge-steps" aria-label="Bridge steps">
          {[1, 2, 3].map((item) => <span key={item} className={step >= item && step < 4 ? 'active' : step === 4 && item === 3 ? 'active' : ''}>{step > item || step === 4 ? <Check size={13} /> : item}</span>)}
        </div>
        {step === 1 && <>
          <h2>Choose what to bridge</h2>
          <p className="wallet-bridge-intro">Select ETH or USDG held in your Veilora account on Robinhood Chain.</p>
          <div className="wallet-swap-box">
            <div className="wallet-swap-caption"><span>You send</span><span>Balance: {formattedBalance} {sourceSymbol}</span></div>
            <div className="wallet-swap-input"><input aria-label="Bridge amount" placeholder="0.00" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
              <button type="button" className="wallet-token-button" aria-label="Choose source asset" onClick={() => setPicker('source')}><TokenIcon token={sourceToken} size={24}/>{sourceSymbol}<ChevronDown size={14}/></button>
            </div>
            <div className="wallet-percentages">{[25, 50, 75, 100].map((part) => <button key={part} disabled={policyCap == null || !!busy} onClick={() => policyCap != null && setAmount(formatUnits(policyCap * BigInt(part) / 100n, source.decimals))}>{part === 100 ? `Max ${formattedPolicyCap}` : `${part}%`}</button>)}</div>
          </div>
          <p className="wallet-bridge-limit">Available balance: {formattedBalance} {sourceSymbol}. Max under the current 20% signing cap: {formattedPolicyCap} {sourceSymbol}. Earlier spending today may reduce the amount the co-signer approves.</p>
          <button className="wallet-primary-button mt-5" disabled={!amountRaw || balance == null || policyCap == null || !!busy || amountRaw > policyCap} onClick={() => setStep(2)}>Choose destination <ArrowRight size={17} /></button>
        </>}
        {step === 2 && <>
          <div className="wallet-bridge-heading"><button className="wallet-icon-button" aria-label="Back" onClick={() => setStep(1)}><ArrowLeft size={17} /></button><div><h2>Where should it arrive?</h2><p className="wallet-bridge-intro">Enter an address that can receive the selected asset.</p></div></div>
          <label className="wallet-bridge-field"><span>Destination network</span><select className="wallet-select" value={destinationChainId} onChange={(event) => setDestinationChainId(Number(event.target.value))}>{DESTINATIONS.map((chain) => <option key={chain.chainId} value={chain.chainId}>{chain.name}</option>)}</select></label>
          <div className="wallet-bridge-field"><span>Receive asset</span><button type="button" className="wallet-token-button wallet-bridge-token-choice" aria-label="Choose destination asset" onClick={() => setPicker('destination')}><TokenIcon token={destinationTokens.find((token) => token.symbol === destinationSymbol)!} size={25}/>{destinationSymbol}<ChevronDown size={14}/></button></div>
          <label className="wallet-bridge-field"><span>Destination address</span><input className="wallet-bridge-address" value={recipient} onChange={(event) => setRecipient(event.target.value.trim())} placeholder="0x…" autoComplete="off" spellCheck={false} aria-invalid={!!recipient && !validRecipient} /></label>
          {recipient && !validRecipient && <p className="wallet-error">Enter a valid EVM address. Funds go to this exact address on {destinationChain.name}.</p>}
          <p className="wallet-bridge-custody"><ShieldCheck size={16} /> Destination funds go to the address you provide and are controlled by that address on {destinationChain.name}.</p>
          <button className="wallet-primary-button mt-5" disabled={!validRecipient || !!busy} onClick={() => setStep(3)}>Review route <ArrowRight size={17} /></button>
        </>}
        {step === 3 && <>
          <div className="wallet-bridge-heading"><button className="wallet-icon-button" aria-label="Back" disabled={!!busy} onClick={() => setStep(2)}><ArrowLeft size={17} /></button><div><h2>Review your route</h2><p className="wallet-bridge-intro">Relay will find the route and settle the selected asset.</p></div></div>
          <div className="wallet-bridge-route"><div><TokenIcon token={sourceToken} size={34} /><span><small>From Robinhood Chain</small><strong>{amount || '0'} {sourceSymbol}</strong></span></div><ArrowRight size={18} /><div><span className="wallet-bridge-chain-icon">{destinationChain.name.slice(0, 1)}</span><span><small>To {destinationChain.name}</small><strong>{quote ? outputSummary(quote.amountOut, quote.outputDecimals, quote.outputSymbol) : `— ${destinationSymbol}`}</strong></span></div></div>
          <div className="wallet-bridge-recipient"><span>Destination address</span><code title={recipient}>{shortAddress(recipient)}</code></div>
          {quoting && <div className="wallet-bridge-loading"><Loader2 size={17} className="animate-spin" /> Finding the best available route…</div>}
          {!quoting && quote && <div className="wallet-bridge-quote">
            <div><span>You receive at least</span><strong>{outputSummary(quote.minimumAmountOut, quote.outputDecimals, quote.outputSymbol)}</strong></div>
            <div><span>Estimated fees</span><strong>{fees.length ? fees.join(' + ') : 'Included in quote'}</strong></div>
            <div><span>Estimated time</span><strong>{quote.timeEstimate ? `${Math.ceil(quote.timeEstimate / 60)} min` : 'Varies by route'}</strong></div>
            <div><span>Quote validity</span><strong>{quoteExpired ? 'Expired' : `${Math.max(0, Math.ceil((quote.expiresAt - now) / 1000))} sec`}</strong></div>
          </div>}
          {error && <p role="alert" className="wallet-error mt-4">{error}</p>}
          {quoteExpired ? <button className="wallet-primary-button mt-5" onClick={() => setQuoteRefresh((value) => value + 1)}>Get a new quote <RefreshCw size={16} /></button> :
            <button className="wallet-primary-button mt-5" disabled={!quote || quoting || !!busy} onClick={() => void submitBridge()}>{busy ? <><Loader2 size={17} className="animate-spin" />{busy}</> : quoting ? 'Finding route…' : !quote ? 'Route unavailable' : 'Confirm bridge'}</button>}
          <p className="wallet-bridge-note"><ShieldCheck size={15} /> Source transaction is authorized by your Veilora threshold account. The destination address is outside Veilora unless it is itself a deployed Veilora account.</p>
        </>}
        {step === 4 && <div className="wallet-bridge-success"><span><Check size={23} /></span><h2>Bridge submitted</h2><p>Your source transaction is confirmed. Relay is processing delivery to {destinationChain.name}.</p>{lastDeposit?.sourceHash && <a href={`https://robinhoodchain.blockscout.com/tx/${lastDeposit.sourceHash}`} target="_blank" rel="noreferrer">View source transaction <ExternalLink size={15} /></a>}<button className="wallet-primary-button mt-5" onClick={() => { setStep(1); setRecipient(''); }}>Start another bridge</button></div>}
      </section>
      <aside className="wallet-bridge-aside"><span><ArrowDown size={21} /></span><h3>Cross-chain, with a clear destination.</h3><p>Relay routes ETH or USDG from Robinhood Chain to ETH or USDC on Base, and ETH, USDC, or USDT on Ethereum.</p><small><Clock3 size={15} /> Network delivery can take several minutes. You can track the Relay status below.</small><small><ShieldCheck size={15} /> You review the destination address and minimum receive amount before signing.</small></aside>
    </div>
    <section className="wallet-bridge-history">
      <div className="wallet-section-heading"><h2>Bridge activity</h2><button className="wallet-icon-button" onClick={() => void refreshAll()} disabled={refreshing || !records.length} aria-label="Refresh bridge status"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /></button></div>
      {!records.length ? <div className="wallet-panel wallet-bridge-empty"><span>↗</span><div><strong>No bridge activity yet</strong><p>Your recent cross-chain transfers will appear here.</p></div></div> : <div className="wallet-panel wallet-bridge-records">{records.map((record) => { const normalized = record.status.toLowerCase(); const statusClass = ['success', 'completed'].includes(normalized) ? 'confirmed' : ['failure', 'failed', 'refund', 'refunded'].includes(normalized) ? 'failed' : 'pending'; return <article key={record.requestId} className="wallet-bridge-record"><div className="wallet-bridge-record-icon"><ArrowUpRight size={18} /></div><div className="wallet-bridge-record-main"><strong>{record.amount} {record.sourceSymbol} <ArrowRight size={13} /> {record.chainName} {record.outputSymbol}</strong><small>To {shortAddress(record.recipient)} · {record.outputAmount}</small></div><span className={`wallet-status ${statusClass}`}>{record.status}</span><div className="wallet-bridge-record-links">{record.sourceHash && <a href={`https://robinhoodchain.blockscout.com/tx/${record.sourceHash}`} target="_blank" rel="noreferrer">Source <ExternalLink size={13} /></a>}{record.destinationHashes.map((hash) => <a key={hash} href={`${record.explorer}/tx/${hash}`} target="_blank" rel="noreferrer">Destination <ExternalLink size={13} /></a>)}<button onClick={() => void refreshRecord(record)}>Refresh status</button></div></article>;})}</div>}
    </section>
    <TokenPicker open={picker === 'source'} onClose={() => setPicker(null)} onPick={(token) => { setSourceSymbol(token.symbol as 'ETH' | 'USDG'); setAmount(''); }} tokens={sourceTokens} description="Assets on Robinhood Chain" />
    <TokenPicker open={picker === 'destination'} onClose={() => setPicker(null)} onPick={(token) => setDestinationSymbol(token.symbol)} tokens={destinationTokens} description={`Assets available on ${destinationChain.name}`} />
  </>;
}
