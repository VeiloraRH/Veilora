import { createFileRoute } from '@tanstack/react-router';
import { Private } from '@/components/wallet/Private';
import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronDown, Clock3, Copy, ExternalLink, KeyRound, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { formatUnits, getAddress, type Address, type Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getBridgeQuote, getBridgeStatus, type BridgeQuote } from '@/lib/api';
import { useWallet } from '@/lib/walletContext';
import { useHoldings } from '@/lib/walletQueries';
import { executeWalletCall, rawAmount } from '@/lib/walletChain';
import { PageTitle, TokenIcon, shortAddress } from '@/components/wallet/WalletUI';
import { TokenPicker } from '@/components/wallet/TokenPicker';
import { ROBINHOOD_TOKEN_REGISTRY, type WalletToken } from '@/lib/tokens';
import { useSpendingPolicy } from '@/lib/spendingPolicy';
import { spendingAllowance } from '@/lib/spendingAllowance';
import { TransactionCheck } from '@/components/wallet/TransactionCheck';
import { SignPreview } from '@/components/wallet/TxExplanation';
import { CompletionDialog, type CompletionNotice } from '@/components/app/CompletionDialog';
import { ContactBook } from '@/components/wallet/ContactBook';
import { RecipientCheck, isBlockedRecipient } from '@/components/wallet/RecipientCheck';
import { assessRecipient } from '@/lib/recipientCheck';
import { getWalletContacts } from '@/lib/contacts';
import { useWalletBlocklist } from '@/lib/addressBlocklist';
import { useWalletApprovedRecipients } from '@/lib/approvedRecipients';
import { usePrivacyMode } from '@/lib/privacyMode';
import { bridgeTrackingChangedEvent, isBridgeStatusFinal, loadBridgeRecords, saveBridgeRecords, type BridgeRecord } from '@/lib/bridgeTracking';
import { notifyBridgeOutcome } from '@/lib/bridgeNotifications';

export const Route = createFileRoute('/app/bridge')({
  validateSearch: (search: Record<string, unknown>) => ({
    ...(search.sourceAsset === 'ETH' || search.sourceAsset === 'USDG' ? { sourceAsset: search.sourceAsset } : {}),
    ...(typeof search.destinationChainId === 'number' && [1, 56, 137, 8453].includes(search.destinationChainId) ? { destinationChainId: search.destinationChainId } : {}),
    ...(typeof search.destinationSymbol === 'string' ? { destinationSymbol: search.destinationSymbol.slice(0, 16) } : {}),
    ...(typeof search.amount === 'string' ? { amount: search.amount.slice(0, 80) } : {}),
    ...(typeof search.recipient === 'string' ? { recipient: search.recipient.slice(0, 80) } : {}),
  }),
  component: BridgeScreen,
});

const NATIVE = '0x0000000000000000000000000000000000000000';
const USDG = '0x5fc5360d0400a0fd4f2af552add042d716f1d168';
const DESTINATIONS = [
  { chainId: 8453, name: 'Base', explorer: 'https://basescan.org', assets: [
    { symbol: 'ETH', currency: NATIVE, decimals: 18 },
    { symbol: 'USDC', currency: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', decimals: 6 },
    { symbol: 'cbBTC', name: 'Coinbase Wrapped BTC', currency: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', decimals: 8 },
  ] },
  { chainId: 1, name: 'Ethereum', explorer: 'https://etherscan.io', assets: [
    { symbol: 'ETH', currency: NATIVE, decimals: 18 },
    { symbol: 'USDC', currency: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', decimals: 6 },
    { symbol: 'USDT', currency: '0xdac17f958d2ee523a2206206994597c13d831ec7', decimals: 6 },
    { symbol: 'PYUSD', name: 'PayPal USD', currency: '0x6c3ea9036406852006290770bedfcaba0e23a0e8', decimals: 6 },
  ] },
  { chainId: 137, name: 'Polygon', explorer: 'https://polygonscan.com', assets: [
    { symbol: 'POL', name: 'POL', currency: NATIVE, decimals: 18, native: true },
    { symbol: 'ETH', name: 'Wrapped Ether', currency: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619', decimals: 18 },
    { symbol: 'USDC', name: 'USD Coin', currency: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', decimals: 6 },
    { symbol: 'USDT', name: 'Tether USD', currency: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', decimals: 6 },
  ] },
  { chainId: 56, name: 'BNB Chain', explorer: 'https://bscscan.com', assets: [
    { symbol: 'ETH', name: 'Binance-Peg Ethereum Token', currency: '0x2170ed0880ac9a755fd29b2688956bd959f933f8', decimals: 18 },
    { symbol: 'BNB', name: 'BNB', currency: NATIVE, decimals: 18, native: true },
    { symbol: 'USDC', name: 'Binance-Peg USD Coin', currency: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', decimals: 18 },
    { symbol: 'USDT', name: 'Tether USD', currency: '0x55d398326f99059ff775485246999027b3197955', decimals: 18 },
  ] },
] as const;
const SOURCES = [
  { symbol: 'ETH', currency: NATIVE, decimals: 18 },
  { symbol: 'USDG', currency: USDG, decimals: 6 },
] as const;
const outputSummary = (value: string, decimals: number, symbol: string) => `${Number(formatUnits(BigInt(value), decimals)).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${symbol}`;
const feeSummary = (fees: BridgeQuote['fees']) => Object.values(fees || {})
  .filter((fee) => Number(fee.amountUsd || 0) > 0)
  .map((fee) => `${fee.amountFormatted ?? '—'} ${fee.currency?.symbol ?? ''}`.trim());

function BridgeScreen() {
  const search = Route.useSearch();
  const { walletAddress, getStoredDeviceKey } = useWallet();
  const privacy = usePrivacyMode();
  const blockedAddresses = useWalletBlocklist(walletAddress);
  const approvedRecipients = useWalletApprovedRecipients(walletAddress);
  const holdings = useHoldings();
  const spendingPolicy = useSpendingPolicy();
  const cache = useQueryClient();
  const [sourceSymbol, setSourceSymbol] = useState<'ETH' | 'USDG'>(search.sourceAsset === 'USDG' ? 'USDG' : 'ETH');
  const [destinationChainId, setDestinationChainId] = useState<number>(search.destinationChainId ?? 8453);
  const [destinationSymbol, setDestinationSymbol] = useState(search.destinationSymbol ?? 'ETH');
  const [picker, setPicker] = useState<'source' | 'destination' | null>(null);
  const [recipient, setRecipient] = useState(search.recipient ?? '');
  const [amount, setAmount] = useState(search.amount ?? '');
  const [step, setStep] = useState(1);
  const [quote, setQuote] = useState<BridgeQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [now, setNow] = useState(Date.now());
  const [records, setRecords] = useState<BridgeRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [quoteRefresh, setQuoteRefresh] = useState(0);
  const [freshWallet, setFreshWallet] = useState<{ address: Address; privateKey: Hex } | null>(null);
  const [freshWalletError, setFreshWalletError] = useState('');
  const [copiedPrivateKey, setCopiedPrivateKey] = useState(false);
  const [completion, setCompletion] = useState<CompletionNotice | null>(null);

  const source = SOURCES.find((asset) => asset.symbol === sourceSymbol)!;
  const destinationChain = DESTINATIONS.find((chain) => chain.chainId === destinationChainId)!;
  const destination = destinationChain.assets.find((asset) => asset.symbol === destinationSymbol) || destinationChain.assets[0];
  const destinationTokens: WalletToken[] = destinationChain.assets.map((asset) => {
    const known = ROBINHOOD_TOKEN_REGISTRY[asset.symbol];
    return {
      symbol: asset.symbol,
      name: 'name' in asset ? asset.name : known?.name || (asset.symbol === 'ETH' ? 'Ether' : asset.symbol === 'USDC' ? 'USD Coin' : 'Tether USD'),
      address: asset.currency as Address,
      decimals: asset.decimals,
      logo: asset.symbol === 'BNB' ? '/tokens/bnb.png' : known?.logo || `/tokens/${asset.symbol.toLowerCase()}.svg`,
      stock: false,
      native: 'native' in asset ? asset.native : asset.currency === NATIVE,
      category: 'crypto',
    };
  });
  const sourceTokens = [ROBINHOOD_TOKEN_REGISTRY.ETH, ROBINHOOD_TOKEN_REGISTRY.USDG];
  const sourceToken = ROBINHOOD_TOKEN_REGISTRY[sourceSymbol] as WalletToken;
  const balance = holdings.data?.find((holding) => holding.token.symbol === sourceSymbol)?.raw;
  const allowance = spendingAllowance(sourceToken, balance, spendingPolicy.data);
  const dailyRemaining = allowance?.dailyRemaining ?? null;
  const transactionLimit = allowance?.perTransaction ?? null;
  const policyCap = allowance?.max ?? null;
  const quoteExpired = !!quote && quote.expiresAt <= now;
  const amountRaw = useMemo(() => {
    try { return rawAmount(amount, source.decimals); } catch { return null; }
  }, [amount, source.decimals]);
  const validRecipient = /^0x[\da-f]{40}$/i.test(recipient.trim()) && !/^0x0{40}$/i.test(recipient.trim());
  // Address-poisoning check for the destination: contacts, past bridge recipients, and your own
  // Veilora address, which does not exist on other chains.
  const recipientCheck = useMemo(() => validRecipient && walletAddress ? assessRecipient({
    recipient: recipient.trim(), wallet: walletAddress, contacts: getWalletContacts(walletAddress), blockedAddresses, approvedAddresses: approvedRecipients.entries.map(entry => entry.address), requireApprovedRecipient: approvedRecipients.policy.requireApproval, mode: 'bridge', chainName: destinationChain.name,
    history: records.map((r) => ({ direction: 'sent' as const, from: walletAddress, to: r.recipient, amount: r.amount })),
    tokenContracts: destinationChain.assets.filter((a) => a.currency !== NATIVE).map((a) => ({ symbol: a.symbol, address: a.currency })),
  }) : null, [validRecipient, recipient, walletAddress, records, destinationChain, blockedAddresses, approvedRecipients]);
  const recipientBlocked = isBlockedRecipient(recipientCheck);
  const recipientNeedsAck = (recipientCheck?.level === 'danger' || recipientCheck?.level === 'warn') && !recipientBlocked;
  const [recipientAck, setRecipientAck] = useState(false);
  useEffect(() => setRecipientAck(false), [recipient, destinationChainId]);

  function createFreshDestinationWallet() {
    try {
      const privateKey = generatePrivateKey();
      const address = privateKeyToAccount(privateKey).address;
      setFreshWallet({ address, privateKey });
      setFreshWalletError('');
      setCopiedPrivateKey(false);
    } catch {
      setFreshWalletError('Could not create a wallet in this browser. Check that secure browser randomness is available and try again.');
    }
  }

  async function copyFreshPrivateKey() {
    if (!freshWallet) return;
    try {
      await navigator.clipboard.writeText(freshWallet.privateKey);
      setCopiedPrivateKey(true);
    } catch {
      setFreshWalletError('Clipboard access was blocked. Select and copy the private key manually.');
    }
  }

  useEffect(() => {
    setRecords(loadBridgeRecords(walletAddress));
    const changed = (event: Event) => {
      const owner = (event as CustomEvent<{ wallet?: string }>).detail?.wallet;
      if (!owner || owner === walletAddress.toLowerCase()) setRecords(loadBridgeRecords(walletAddress));
    };
    window.addEventListener(bridgeTrackingChangedEvent, changed);
    window.addEventListener('storage', changed);
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(timer); window.removeEventListener(bridgeTrackingChangedEvent, changed); window.removeEventListener('storage', changed); };
  }, [walletAddress]);

  useEffect(() => {
    const requestedAsset = search.destinationChainId === destinationChainId ? search.destinationSymbol : undefined;
    setDestinationSymbol(destinationChain.assets.some((asset) => asset.symbol === requestedAsset) ? requestedAsset! : 'ETH');
    setQuote(null);
  }, [destinationChainId]);

  useEffect(() => {
    setSourceSymbol(search.sourceAsset === 'USDG' ? 'USDG' : 'ETH');
    setDestinationChainId(search.destinationChainId ?? 8453);
    setDestinationSymbol(search.destinationSymbol ?? 'ETH');
    setRecipient(search.recipient ?? '');
    setAmount(search.amount ?? '');
  }, [search.sourceAsset, search.destinationChainId, search.destinationSymbol, search.recipient, search.amount]);

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
    saveBridgeRecords(walletAddress, next);
  };

  const refreshRecord = async (record: BridgeRecord) => {
    if (['action_required', 'rejected'].includes(record.status.toLowerCase())) return;
    const result = await getBridgeStatus(record.requestId);
    const status = result.status;
    const relayStatus = status.status.toLowerCase();
    const noDeposit = !record.sourceHash && !status.inTxHashes.length && !['success', 'completed', 'failure', 'failed', 'refund', 'refunded'].includes(relayStatus);
    const updated: BridgeRecord = {
      ...record,
      status: noDeposit ? 'check_required' : status.status,
      error: noDeposit ? record.error || 'No source deposit is linked to this request. Check wallet activity before trying again.' : record.error,
      destinationHashes: status.outTxHashes,
      updatedAt: status.updatedAt || undefined,
    };
    if (!isBridgeStatusFinal(record.status) && isBridgeStatusFinal(updated.status)) notifyBridgeOutcome(walletAddress, updated, privacy);
    const next = loadBridgeRecords(walletAddress).map((item) => item.requestId === record.requestId ? updated : item);
    persistRecords(next);
  };

  const refreshAll = async () => {
    if (!records.length || refreshing) return;
    setRefreshing(true);
    await Promise.allSettled(records.filter((record) => !isBridgeStatusFinal(record.status)).map(refreshRecord));
    setRefreshing(false);
  };

  useEffect(() => {
    const timer = setInterval(() => { void refreshAll(); }, 20_000);
    return () => clearInterval(timer);
  }, [records, refreshing]);

  async function submitBridge() {
    if (!quote || quoteExpired || busy || !amountRaw || !validRecipient || recipientBlocked || (recipientNeedsAck && !recipientAck)) return;
    const key = getStoredDeviceKey();
    if (!key) { setError('Unlock your device key before bridging.'); return; }
    if (balance == null || amountRaw > balance) { setError(`Your ${sourceSymbol} balance is too low for this transfer.`); return; }
    if (policyCap == null || amountRaw > policyCap) { setError('This amount exceeds your remaining co-signer allowance for this asset. Check your per-transaction and daily limits in Security.'); return; }
    const sameQuote = quote.input.ownerAddress.toLowerCase() === walletAddress.toLowerCase() &&
      quote.input.recipient.toLowerCase() === recipient.trim().toLowerCase() && quote.input.amount === amountRaw.toString() &&
      quote.input.originCurrency.toLowerCase() === source.currency.toLowerCase() &&
      quote.input.destinationChainId === destinationChainId && quote.input.destinationCurrency.toLowerCase() === destination.currency.toLowerCase();
    if (!sameQuote) { setError('This quote no longer matches your selections. Request a fresh quote.'); return; }

    setError('');
    const address = getAddress(walletAddress) as Address;
    let trackingRecord: BridgeRecord = {
      requestId: quote.requestId,
      chainId: destinationChainId,
      chainName: destinationChain.name,
      explorer: destinationChain.explorer,
      sourceSymbol,
      amount,
      outputSymbol: destination.symbol,
      outputAmount: outputSummary(quote.amountOut, quote.outputDecimals, quote.outputSymbol),
      recipient: recipient.trim(),
      status: 'preparing',
      destinationHashes: [],
      createdAt: new Date().toISOString(),
    };
    const saveTracking = () => persistRecords([trackingRecord, ...loadBridgeRecords(walletAddress).filter((item) => item.requestId !== quote.requestId)]);
    saveTracking();
    let sourceHash: string | undefined;
    try {
      for (const tx of quote.steps) {
        if (Date.now() >= quote.expiresAt) throw new Error('The quote expired. Request a fresh quote before continuing.');
        setBusy(tx.id === 'approve' ? 'Approving source token…' : 'Submitting bridge deposit…');
        trackingRecord = { ...trackingRecord, status: tx.id === 'deposit' ? 'submitting' : 'approving' };
        saveTracking();
        const hash = await executeWalletCall(address, key as Hex, getAddress(tx.to), BigInt(tx.value), tx.data as Hex);
        if (tx.id === 'approve') {
          trackingRecord = { ...trackingRecord, approvalHash: hash };
          saveTracking();
        } else if (tx.id === 'deposit') {
          sourceHash = hash;
          trackingRecord = { ...trackingRecord, sourceHash, status: 'submitted', error: undefined };
          saveTracking();
        }
      }
      setBusy('Tracking delivery…');
      await refreshRecord(trackingRecord).catch(() => undefined);
      void cache.invalidateQueries({ queryKey: ['holdings'] });
      void cache.invalidateQueries({ queryKey: ['transactions'] });
      setStep(1);
      setRecipient('');
      setAmount('');
      setQuote(null);
      setCompletion({ title: 'Bridge submitted', description: `Your source transaction is confirmed. Relay is processing delivery to ${destinationChain.name}.`, ...(sourceHash ? { href: `https://robinhoodchain.blockscout.com/tx/${sourceHash}`, linkLabel: 'View source transaction' } : {}) });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Bridge submission failed.';
      const policyDenied = /policy denied|daily.{0,30}limit|per.transaction.{0,30}limit|spending limit/i.test(message);
      trackingRecord = {
        ...trackingRecord,
        status: policyDenied && !sourceHash ? 'action_required' : 'check_required',
        error: message,
        ...(sourceHash ? { sourceHash } : {}),
      };
      saveTracking();
      setError(`${message}${trackingRecord.approvalHash && !sourceHash ? ' The approval transaction succeeded, but the bridge deposit did not. Check the Bridge activity entry before retrying.' : ' Check wallet activity before trying again.'}`);
    } finally {
      setBusy('');
    }
  }

  const formattedBalance = balance == null ? '—' : Number(formatUnits(balance, source.decimals)).toLocaleString(undefined, { maximumFractionDigits: 6 });
  const formattedPolicyCap = policyCap == null ? '—' : Number(formatUnits(policyCap, source.decimals)).toLocaleString(undefined, { maximumFractionDigits: 6 });
  const fees = quote ? feeSummary(quote.fees) : [];
  const reviewCalls = quote?.steps.map((tx) => ({ target: getAddress(tx.to), value: BigInt(tx.value), data: tx.data as Hex })) ?? [];

  return <>
    <PageTitle title="Bridge" description="Move ETH or USDG from Robinhood Chain to Base, Polygon, Ethereum, or BNB Chain." />
    <div className="wallet-bridge-layout">
      <section className="wallet-panel wallet-bridge-card">
        <div className="wallet-bridge-steps" aria-label="Bridge steps">
          {[1, 2, 3].map((item) => <span key={item} className={step >= item ? 'active' : ''}>{step > item ? <Check size={13} /> : item}</span>)}
        </div>
        {step === 1 && <>
          <h2>Choose what to bridge</h2>
          <p className="wallet-bridge-intro">Select ETH or USDG held in your Veilora account on Robinhood Chain.</p>
          <div className="wallet-swap-box">
            <div className="wallet-swap-caption"><span>You send</span><span>Balance: <Private>{formattedBalance}</Private> {sourceSymbol}</span></div>
            <div className="wallet-swap-input"><input aria-label="Bridge amount" placeholder="0.00" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
              <button type="button" className="wallet-token-button" aria-label="Choose source asset" onClick={() => setPicker('source')}><TokenIcon token={sourceToken} size={24}/>{sourceSymbol}<ChevronDown size={14}/></button>
            </div>
            <div className="wallet-percentages">{[25, 50, 75, 100].map((part) => <button key={part} disabled={policyCap == null || !!busy} onClick={() => policyCap != null && setAmount(formatUnits(policyCap * BigInt(part) / 100n, source.decimals))}>{part === 100 ? `Max $<Private>{formattedPolicyCap}</Private>` : `${part}%`}</button>)}</div>
          </div>
          <p className="wallet-bridge-limit">Available balance: <Private>{formattedBalance}</Private> {sourceSymbol}. Max under your per-transaction and remaining daily limits: <Private>{formattedPolicyCap}</Private> {sourceSymbol}. Change these limits in Security.</p>
          <button className="wallet-primary-button mt-5" disabled={!amountRaw || balance == null || policyCap == null || !!busy || amountRaw > policyCap} onClick={() => setStep(2)}>Choose destination <ArrowRight size={17} /></button>
        </>}
        {step === 2 && <>
          <div className="wallet-bridge-heading"><button className="wallet-icon-button" aria-label="Back" onClick={() => setStep(1)}><ArrowLeft size={17} /></button><div><h2>Where should it arrive?</h2><p className="wallet-bridge-intro">Enter an address that can receive the selected asset.</p></div></div>
          <label className="wallet-bridge-field"><span>Destination network</span><select className="wallet-select" value={destinationChainId} onChange={(event) => setDestinationChainId(Number(event.target.value))}>{DESTINATIONS.map((chain) => <option key={chain.chainId} value={chain.chainId}>{chain.name}</option>)}</select></label>
          <div className="wallet-bridge-field"><span>Receive asset</span><button type="button" className="wallet-token-button wallet-bridge-token-choice" aria-label="Choose destination asset" onClick={() => setPicker('destination')}><TokenIcon token={destinationTokens.find((token) => token.symbol === destinationSymbol)!} size={25}/>{destinationSymbol}<ChevronDown size={14}/></button></div>
          <label className="wallet-bridge-field"><span>Destination address</span><input className="wallet-bridge-address" value={recipient} onChange={(event) => setRecipient(event.target.value.trim())} placeholder="0x…" autoComplete="off" spellCheck={false} aria-invalid={!!recipient && !validRecipient} /></label>
          <div className="mt-3"><ContactBook wallet={walletAddress} address={recipient} onSelect={setRecipient} /></div>
          <div className="mt-3">
            <button type="button" className="wallet-bridge-fresh-button" onClick={createFreshDestinationWallet}><KeyRound size={14}/> Create a fresh destination wallet</button>
            <p className="mt-2 text-[10px] leading-5 text-muted-foreground">Generated in this browser. Its private key is shown once and is never saved by Veilora.</p>
            {freshWalletError && !freshWallet && <p role="alert" className="wallet-error mt-2">{freshWalletError}</p>}
          </div>
          {recipient && !validRecipient && <p className="wallet-error">Enter a valid EVM address. Funds go to this exact address on {destinationChain.name}.</p>}
          {validRecipient && <div className="mt-3"><RecipientCheck recipient={recipient.trim()} assessment={recipientCheck} loading={false}/></div>}
          <p className="wallet-bridge-custody"><ShieldCheck size={16} /> Destination funds go to the address you provide and are controlled by that address on {destinationChain.name}.</p>
          <button className="wallet-primary-button mt-5" disabled={!validRecipient || recipientBlocked || !!busy} onClick={() => setStep(3)}>{recipientBlocked ? 'Choose a different address' : <>Review route <ArrowRight size={17} /></>}</button>
        </>}
        {step === 3 && <>
          <div className="wallet-bridge-heading"><button className="wallet-icon-button" aria-label="Back" disabled={!!busy} onClick={() => setStep(2)}><ArrowLeft size={17} /></button><div><h2>Review your route</h2><p className="wallet-bridge-intro">Relay will find the route and settle the selected asset.</p></div></div>
          <div className="wallet-bridge-route"><div><TokenIcon token={sourceToken} size={34} /><span><small>From Robinhood Chain</small><strong>{amount || '0'} {sourceSymbol}</strong></span></div><ArrowRight size={18} /><div><span className="wallet-bridge-chain-icon">{destinationChain.name.slice(0, 1)}</span><span><small>To {destinationChain.name}</small><strong>{quote ? outputSummary(quote.amountOut, quote.outputDecimals, quote.outputSymbol) : `— ${destinationSymbol}`}</strong></span></div></div>
          <div className="wallet-bridge-recipient"><span>Destination address</span><code title={recipient}>{shortAddress(recipient)}</code></div>
          <RecipientCheck recipient={recipient.trim()} assessment={recipientCheck} loading={false} showAddress/>
          {recipientNeedsAck && <label className="recipient-ack"><input type="checkbox" checked={recipientAck} onChange={(e) => setRecipientAck(e.target.checked)}/><span>I checked every character of this address, and I control it on {destinationChain.name}.</span></label>}
          {quoting && <div className="wallet-bridge-loading"><Loader2 size={17} className="animate-spin" /> Finding the best available route…</div>}
          {!quoting && quote && <div className="wallet-bridge-quote">
            <div><span>You receive at least</span><strong>{outputSummary(quote.minimumAmountOut, quote.outputDecimals, quote.outputSymbol)}</strong></div>
            <div><span>Estimated fees</span><strong>{fees.length ? fees.join(' + ') : 'Included in quote'}</strong></div>
            <div><span>Estimated time</span><strong>{quote.timeEstimate ? `${Math.ceil(quote.timeEstimate / 60)} min` : 'Varies by route'}</strong></div>
            <div><span>Quote validity</span><strong>{quoteExpired ? 'Expired' : `${Math.max(0, Math.ceil((quote.expiresAt - now) / 1000))} sec`}</strong></div>
          </div>}
          <TransactionCheck items={[
            { label: 'Wallet balance', detail: balance == null ? 'Balance unavailable' : amountRaw != null && amountRaw <= balance ? `${amount} ${sourceSymbol} is available` : `Not enough ${sourceSymbol} for this bridge`, status: balance == null ? (holdings.isLoading ? 'checking' : 'attention') : amountRaw != null && amountRaw <= balance ? 'ready' : 'attention' },
            { label: 'Per-transaction limit', detail: transactionLimit == null ? (spendingPolicy.isLoading ? 'Checking your limit' : 'Limit unavailable') : `${Number(formatUnits(transactionLimit, source.decimals)).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${sourceSymbol} maximum`, status: transactionLimit == null ? (spendingPolicy.isLoading ? 'checking' : 'attention') : amountRaw != null && amountRaw <= transactionLimit ? 'ready' : 'attention' },
            { label: 'Daily limit remaining', detail: dailyRemaining == null ? (spendingPolicy.isLoading ? 'Checking today’s limit' : 'Limit unavailable') : `${Number(formatUnits(dailyRemaining, source.decimals)).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${sourceSymbol} remains today`, status: dailyRemaining == null ? (spendingPolicy.isLoading ? 'checking' : 'attention') : amountRaw != null && amountRaw <= dailyRemaining ? 'ready' : 'attention' },
            { label: 'Relay route', detail: !quote ? (quoting ? 'Finding a route' : 'Route unavailable') : quoteExpired ? 'Quote expired' : `${destinationChain.name} route is live`, status: !quote || quoteExpired ? 'attention' : 'ready' },
            { label: 'Destination', detail: !validRecipient ? 'Enter a valid destination address' : recipientBlocked ? 'This address cannot be used' : recipientNeedsAck && !recipientAck ? 'Confirm you checked the address' : `Address is ready for ${destinationChain.name}`, status: !validRecipient || recipientBlocked || recipientNeedsAck && !recipientAck ? 'attention' : 'ready' },
          ]} footnote="Relay’s quote uses current route and fee data. Destination settlement can take time and is not guaranteed until Relay reports completion. Co-signer limits are checked again when you submit." />
          <SignPreview wallet={walletAddress} calls={reviewCalls} title="Veily’s transaction review" facts={[
            { label: 'You send', value: <><Private>{amount}</Private> {sourceSymbol} from Robinhood Chain</> },
            { label: 'Destination', value: <>{destinationChain.name} {destination.symbol} to {shortAddress(recipient.trim())}</> },
            { label: 'Estimated minimum received', value: quote ? <Private>{outputSummary(quote.minimumAmountOut, quote.outputDecimals, quote.outputSymbol)}</Private> : 'Unavailable' },
            { label: 'Estimated fees', value: fees.length ? fees.join(' + ') : quote ? 'Included in Relay quote' : 'Unavailable' },
            { label: 'Per-transaction limit', value: transactionLimit != null ? <><Private>{Number(formatUnits(transactionLimit, source.decimals)).toLocaleString(undefined, { maximumFractionDigits: 6 })}</Private> {sourceSymbol}</> : 'Unavailable' },
            { label: 'Daily allowance remaining', value: dailyRemaining != null ? <><Private>{Number(formatUnits(dailyRemaining, source.decimals)).toLocaleString(undefined, { maximumFractionDigits: 6 })}</Private> {sourceSymbol}</> : 'Unavailable' },
            { label: 'Route validity', value: quote ? quoteExpired ? 'Expired' : `${Math.max(0, Math.ceil((quote.expiresAt - now) / 1000))} seconds remaining` : 'Unavailable' },
            { label: 'Source simulation', value: 'Not run in this review. Relay supplies the route; Veilora’s co-signer rechecks policy when you submit.' },
          ]} />
          {error && <p role="alert" className="wallet-error mt-4">{error}</p>}
          {quoteExpired ? <button className="wallet-primary-button mt-5" onClick={() => setQuoteRefresh((value) => value + 1)}>Get a new quote <RefreshCw size={16} /></button> :
            <button className="wallet-primary-button mt-5" disabled={!quote || quoting || !!busy || quoteExpired || balance == null || amountRaw == null || amountRaw > balance || policyCap == null || amountRaw > policyCap || recipientBlocked || (recipientNeedsAck && !recipientAck)} onClick={() => void submitBridge()}>{busy ? <><Loader2 size={17} className="animate-spin" />{busy}</> : quoting ? 'Finding route…' : !quote ? 'Route unavailable' : amountRaw != null && policyCap != null && amountRaw > policyCap ? 'Over co-signer allowance' : 'Confirm bridge'}</button>}
          <p className="wallet-bridge-note"><ShieldCheck size={15} /> Source transaction is authorized by your Veilora threshold account. The destination address is outside Veilora unless it is itself a deployed Veilora account.</p>
        </>}
      </section>
      <aside className="wallet-bridge-aside"><span><ArrowDown size={21} /></span><h3>Cross-chain, with a clear destination.</h3><p>Relay routes ETH or USDG from Robinhood Chain to Base, Polygon, Ethereum, or BNB Chain. BNB Chain destinations include ETH, BNB, USDC, and USDT.</p><small><Clock3 size={15} /> Network delivery can take several minutes. You can track the Relay status below.</small><small><ShieldCheck size={15} /> You review the destination address and minimum receive amount before signing.</small></aside>
    </div>
    <section className="wallet-bridge-history">
      <div className="wallet-section-heading"><h2>Bridge activity</h2><button className="wallet-icon-button" onClick={() => void refreshAll()} disabled={refreshing || !records.length} aria-label="Refresh bridge status"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /></button></div>
      {!records.length ? <div className="wallet-panel wallet-bridge-empty"><span>↗</span><div><strong>No bridge activity yet</strong><p>Your recent cross-chain transfers will appear here.</p></div></div> : <div className="wallet-panel wallet-bridge-records">{records.map((record) => { const normalized = record.status.toLowerCase(); const statusClass = ['success', 'completed'].includes(normalized) ? 'confirmed' : ['failure', 'failed', 'refund', 'refunded', 'action_required', 'rejected'].includes(normalized) ? 'failed' : 'pending'; const statusLabel = normalized === 'action_required' ? 'Blocked by co-signer' : normalized === 'check_required' ? 'Check wallet activity' : record.status; return <article key={record.requestId} className="wallet-bridge-record"><div className="wallet-bridge-record-icon"><ArrowUpRight size={18} /></div><div className="wallet-bridge-record-main"><strong>{record.amount} {record.sourceSymbol} <ArrowRight size={13} /> {record.chainName} {record.outputSymbol}</strong><small>To {shortAddress(record.recipient)} · {record.outputAmount}</small>{record.error && <small className="wallet-error">{record.error}</small>}</div><span className={`wallet-status ${statusClass}`}>{statusLabel}</span><div className="wallet-bridge-record-links">{record.approvalHash && <a href={`https://robinhoodchain.blockscout.com/tx/${record.approvalHash}`} target="_blank" rel="noreferrer">Approval <ExternalLink size={13} /></a>}{record.sourceHash && <a href={`https://robinhoodchain.blockscout.com/tx/${record.sourceHash}`} target="_blank" rel="noreferrer">Source <ExternalLink size={13} /></a>}{record.destinationHashes.map((hash) => <a key={hash} href={`${record.explorer}/tx/${hash}`} target="_blank" rel="noreferrer">Destination <ExternalLink size={13} /></a>)}<button onClick={() => void refreshRecord(record)}>Refresh status</button></div></article>;})}</div>}
    </section>
    <TokenPicker open={picker === 'source'} onClose={() => setPicker(null)} onPick={(token) => { setSourceSymbol(token.symbol as 'ETH' | 'USDG'); setAmount(''); }} tokens={sourceTokens} description="Assets on Robinhood Chain" />
    <TokenPicker open={picker === 'destination'} onClose={() => setPicker(null)} onPick={(token) => setDestinationSymbol(token.symbol)} tokens={destinationTokens} description={`Assets available on ${destinationChain.name}`} />
    <Dialog open={!!freshWallet} onOpenChange={(open) => { if (!open) setFreshWallet(null); }}>
      <DialogContent className="wallet-dialog wallet-fresh-key-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save your fresh wallet key</DialogTitle>
          <DialogDescription>This key controls the destination wallet. Veilora does not store or recover it. Anyone who gets it can take the wallet’s funds.</DialogDescription>
        </DialogHeader>
        {freshWallet && <>
          <div className="space-y-2 rounded-xl bg-muted p-3">
            <span className="block text-[10px] text-muted-foreground">Wallet address</span>
            <code className="block break-all text-xs">{freshWallet.address}</code>
          </div>
          <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
            <span className="block text-[10px] font-medium text-amber-700 dark:text-amber-300">Private key · shown once</span>
            <code className="fresh-wallet-key block select-all break-all font-mono">{freshWallet.privateKey}</code>
          </div>
          {freshWalletError && <p role="alert" className="wallet-error">{freshWalletError}</p>}
          <button type="button" className="fresh-wallet-action fresh-wallet-copy" onClick={() => void copyFreshPrivateKey()}><Copy size={15}/>{copiedPrivateKey ? 'Copied private key' : 'Copy private key'}</button>
          <button type="button" className="wallet-primary-button fresh-wallet-action-primary" onClick={() => { setRecipient(freshWallet.address); setFreshWallet(null); setFreshWalletError(''); }}>I’ve saved the private key, use this address</button>
          <button type="button" className="fresh-wallet-action fresh-wallet-discard" onClick={() => { setFreshWallet(null); setFreshWalletError(''); }}>Discard this wallet</button>
        </>}
      </DialogContent>
    </Dialog>
    <CompletionDialog notice={completion} onClose={() => setCompletion(null)} />
  </>;
}
