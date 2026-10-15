import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, CircleAlert, ExternalLink, FileKey2, Loader2, LockKeyhole, Send, ShieldAlert, Wallet } from 'lucide-react';
import { createWalletClient, custom, formatUnits, getAddress, isAddress, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getRpcOverride } from '@/lib/rpcSettings';
import { Logo } from '@/components/ui';
import { WALLET_TOKENS } from '@/lib/tokens';
import {
  EXIT_CHAIN,
  EXIT_RPC_DEFAULT,
  parseBackupFile,
  parseExitAmount,
  prepareExitTransaction,
  readExitBalance,
  readOnchainOwners,
  unlockImportedShardA,
  unlockLocalShardA,
  validateExitInputs,
} from '@/lib/standaloneExit';
import type { DeviceKeyBackup } from '@/lib/recovery';

export const Route = createFileRoute('/exit')({ component: ExitPage });

type InjectedProvider = { request(args: { method: string; params?: unknown[] | object }): Promise<unknown> };
declare global { interface Window { ethereum?: InjectedProvider } }

function ExitPage() {
  const localWallet = (() => { try { return localStorage.getItem('veilora:wallet_address') ?? ''; } catch { return ''; } })();
  const localVersion = (() => { try { return localStorage.getItem(`veilora:account-version:${localWallet.toLowerCase()}`); } catch { return null; } })();
  const [walletInput, setWalletInput] = useState(localWallet);
  const [rpcUrl, setRpcUrl] = useState(() => getRpcOverride() || EXIT_RPC_DEFAULT);
  const [accountVersion, setAccountVersion] = useState<'1' | '2' | ''>(localVersion === '1' || localVersion === '2' ? localVersion : '');
  const [keySource, setKeySource] = useState<'device' | 'backup'>('device');
  const [backup, setBackup] = useState<DeviceKeyBackup | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [shardCInput, setShardCInput] = useState('');
  const [shardAKey, setShardAKey] = useState<Hex | null>(null);
  const [shardCKey, setShardCKey] = useState<Hex | null>(null);
  const [wallet, setWallet] = useState<Address | null>(null);
  const [owners, setOwners] = useState<{ shardA: Address; shardC: Address } | null>(null);
  const [recipient, setRecipient] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('USDG');
  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState<bigint | null>(null);
  const [call, setCall] = useState<{ recipient: Address; amount: bigint; amountLabel: string; token: typeof WALLET_TOKENS[number] } | null>(null);
  const [gasAddress, setGasAddress] = useState<Address | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selectedToken = useMemo(() => WALLET_TOKENS.find(token => token.symbol === tokenSymbol)!, [tokenSymbol]);
  const clearSecrets = () => { setPassphrase(''); setShardCInput(''); setShardAKey(null); setShardCKey(null); setCall(null); };
  useEffect(() => () => { setShardAKey(null); setShardCKey(null); }, []);

  useEffect(() => {
    let cancelled = false;
    setBalance(null);
    if (!wallet) return;
    void readExitBalance(rpcUrl, wallet, tokenSymbol).then(value => { if (!cancelled) setBalance(value); }).catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Could not read this balance.'); });
    return () => { cancelled = true; };
  }, [wallet, rpcUrl, tokenSymbol]);

  async function importBackup(file?: File) {
    setBackup(null); setError(''); setOwners(null); setShardAKey(null); setShardCKey(null); setCall(null);
    if (!file) return;
    try { setBackup(parseBackupFile(await file.text())); setKeySource('backup'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not read this backup file.'); }
  }

  async function unlockAndVerify() {
    setBusy(true); setError(''); setNotice('');
    try {
      if (!isAddress(walletInput.trim())) throw new Error('Enter a valid Veilora smart-account address.');
      const parsed = validateExitInputs(walletInput.trim(), walletInput.trim());
      const read = await readOnchainOwners(rpcUrl.trim(), parsed.wallet);
      const a = shardAKey ?? (keySource === 'backup'
        ? backup ? await unlockImportedShardA(backup, passphrase, parsed.wallet) : (() => { throw new Error('Choose your encrypted device-key backup file.'); })()
        : await unlockLocalShardA(passphrase, parsed.wallet));
      if (!shardCKey && !/^0x[0-9a-fA-F]{64}$/.test(shardCInput.trim())) throw new Error('Enter the 32-byte Shard C private key from your recovery record.');
      const c = shardCKey ?? shardCInput.trim() as Hex;
      const aAddress = privateKeyToAccount(a).address;
      const cAddress = privateKeyToAccount(c).address;
      if (aAddress.toLowerCase() !== read.shardA.toLowerCase()) throw new Error('Shard A does not match this account’s on-chain device key.');
      if (cAddress.toLowerCase() !== read.shardC.toLowerCase()) throw new Error('Shard C does not match this account’s on-chain recovery key.');
      setWallet(parsed.wallet); setOwners({ shardA: read.shardA, shardC: read.shardC }); setShardAKey(a); setShardCKey(c);
      setPassphrase(''); setShardCInput('');
      setNotice('Both keys match this account. Your keys remain in this page’s memory.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not verify the account keys.'); }
    finally { setBusy(false); }
  }

  async function reviewTransfer() {
    setBusy(true); setError(''); setNotice('');
    try {
      if (!wallet || !shardAKey || !shardCKey) throw new Error('Unlock and verify both keys first.');
      if (!accountVersion) throw new Error('Select the account version that matches this deployed wallet.');
      const parsed = validateExitInputs(wallet, recipient.trim());
      const rawAmount = parseExitAmount(amount, selectedToken.decimals);
      const read = await readOnchainOwners(rpcUrl.trim(), parsed.wallet);
      if (privateKeyToAccount(shardAKey).address.toLowerCase() !== read.shardA.toLowerCase() || privateKeyToAccount(shardCKey).address.toLowerCase() !== read.shardC.toLowerCase()) throw new Error('The account’s on-chain shard keys changed. Verify the keys again before transferring.');
      const currentBalance = await readExitBalance(rpcUrl.trim(), parsed.wallet, tokenSymbol);
      if (rawAmount > currentBalance) throw new Error(`Insufficient ${selectedToken.symbol} balance.`);
      setCall({ recipient: parsed.recipient, amount: rawAmount, amountLabel: amount, token: selectedToken });
      setNotice('Review the transfer details. Shard A and Shard C will sign only after you click Send recovery transaction.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not prepare this transfer.'); }
    finally { setBusy(false); }
  }

  async function sendTransfer() {
    if (!wallet || !call) return;
    const injected = window.ethereum;
    if (!injected) { setError('Install or open an EVM wallet extension to pay network gas. Veilora does not sponsor this recovery transaction.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      if (!shardAKey || !shardCKey) throw new Error('Unlock and verify both account keys before sending.');
      if (!accountVersion) throw new Error('Select the account version that matches this deployed wallet.');
      const client = createWalletClient({ chain: EXIT_CHAIN, transport: custom(injected as never) });
      const [account] = await client.requestAddresses();
      if (!account) throw new Error('No gas-paying wallet is connected.');
      try { await client.switchChain({ id: 4663 }); }
      catch (switchError) {
        const code = typeof switchError === 'object' && switchError !== null && 'code' in switchError ? (switchError as { code?: unknown }).code : undefined;
        if (code !== 4902) throw switchError;
        await injected.request({ method: 'wallet_addEthereumChain', params: [{ chainId: '0x1237', chainName: 'Robinhood Chain', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: [rpcUrl], blockExplorerUrls: ['https://robinhoodchain.blockscout.com'] }] });
        await client.switchChain({ id: 4663 });
      }
      setGasAddress(getAddress(account));
      const prepared = await prepareExitTransaction({ rpcUrl: rpcUrl.trim(), wallet, accountVersion: Number(accountVersion) as 1 | 2, shardAKey, shardCKey, tokenSymbol: call.token.symbol, recipient: call.recipient, amount: call.amount });
      const hash = await client.sendTransaction({ account, to: wallet, data: prepared.callData, value: 0n, chain: EXIT_CHAIN });
      setNotice(`Transaction submitted: ${hash}`); clearSecrets();
    } catch (err) { setError(err instanceof Error ? err.message : 'The transaction was not submitted.'); }
    finally { setBusy(false); }
  }

  function useMax() {
    if (balance === null) return;
    const reserve = selectedToken.native ? 0n : 0n;
    setAmount(formatUnits(balance - reserve, selectedToken.decimals).replace(/\.0+$/, ''));
  }

  return <main className="min-h-screen bg-[#f8f9fc] px-4 py-8 text-slate-900 dark:bg-[#070c18] dark:text-cream sm:px-6 sm:py-12">
    <div className="mx-auto max-w-3xl">
      <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-950 dark:text-mist dark:hover:text-white"><ArrowLeft size={16}/> Veilora home</Link>
      <header className="mb-8 flex items-center justify-between gap-4"><Logo size={36}/><span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-200">Independent exit tool</span></header>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Move assets with your own keys.</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-mist">A client-only recovery path for deployed Veilora accounts. It reads the account directly from Robinhood Chain and prepares a 2-of-3 transaction signed by Shard A and Shard C. No Veilora API or relayer is used.</p>

      <div className="mt-7 grid gap-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm leading-6 text-amber-950 dark:border-amber-300/20 dark:bg-amber-300/5 dark:text-amber-100 sm:grid-cols-2">
        <div className="flex gap-3"><ShieldAlert className="mt-0.5 shrink-0" size={18}/><p><strong>Both keys are required.</strong> You need the device key (Shard A) and recovery key (Shard C). Shard C alone cannot authorize a transfer while the co-signer is unavailable.</p></div>
        <div className="flex gap-3"><Wallet className="mt-0.5 shrink-0" size={18}/><p><strong>You pay network gas.</strong> Connect an EVM wallet holding ETH on Robinhood Chain. Never enter that wallet’s private key here.</p></div>
      </div>

      <section className="mt-6 space-y-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-ink-700 dark:bg-ink-900 sm:p-7">
        <div className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f0ac5e]/20 text-sm font-semibold">1</span><div className="min-w-0 flex-1"><h2 className="font-semibold">Verify account and keys</h2><p className="mt-1 text-sm text-slate-600 dark:text-mist">Keys are checked against the account’s on-chain shard addresses before signing.</p></div></div>
        <label className="block space-y-2 text-sm font-medium"><span>Veilora smart-account address</span><input className={field} autoComplete="off" spellCheck={false} placeholder="0x…" value={walletInput} onChange={event => { setWalletInput(event.target.value); setWallet(null); setOwners(null); clearSecrets(); }}/></label>
        <label className="block space-y-2 text-sm font-medium"><span>Robinhood Chain RPC</span><input className={`${field} font-mono text-xs`} autoComplete="url" spellCheck={false} value={rpcUrl} onChange={event => {setRpcUrl(event.target.value);setOwners(null);setCall(null);}}/><span className="block text-xs font-normal leading-5 text-slate-500 dark:text-mist">Default is Robinhood’s public RPC. The RPC provider can see public account and balance reads. If the endpoint is unreachable from your browser, use an HTTPS RPC that allows browser requests.</span></label>
        <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">Account architecture</legend><div className="grid grid-cols-2 gap-2">{(['1','2'] as const).map(version=><button key={version} type="button" onClick={()=>{setAccountVersion(version);setCall(null);}} className={`rounded-xl border px-4 py-3 text-left text-sm ${accountVersion===version?'border-[#e7a64e] bg-[#fff8ed] dark:bg-amber-300/10':'border-slate-200 dark:border-ink-700'}`}><strong>Account V{version}</strong><span className="mt-1 block text-xs text-slate-500 dark:text-mist">{version==='1'?'Legacy account':'New account'}</span></button>)}</div><p className="text-xs text-slate-500 dark:text-mist">The version must match the account’s deployed contract. Existing browser metadata is not proof; if unsure, check the account’s creation record before signing.</p></fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><div className="flex items-center justify-between"><label className="text-sm font-medium" htmlFor="shard-a-pass">Shard A device key</label><div className="flex gap-1"><button type="button" onClick={()=>{setKeySource('device');setOwners(null);clearSecrets();}} className={`rounded-md px-2 py-1 text-xs ${keySource==='device'?'bg-slate-100 dark:bg-ink-700':''}`}>This device</button><button type="button" onClick={()=>{setKeySource('backup');setOwners(null);clearSecrets();}} className={`rounded-md px-2 py-1 text-xs ${keySource==='backup'?'bg-slate-100 dark:bg-ink-700':''}`}>Backup file</button></div></div>
            {keySource==='backup'&&<label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 p-3 text-sm dark:border-ink-700"><FileKey2 size={16}/><span>{backup?'Encrypted backup loaded':'Choose encrypted backup JSON'}</span><input className="sr-only" type="file" accept="application/json,.json" onChange={event=>void importBackup(event.target.files?.[0])}/></label>}
            <input id="shard-a-pass" className={field} type="password" autoComplete="new-password" placeholder="Device-key passphrase" value={passphrase} onChange={event=>{setPassphrase(event.target.value);setOwners(null);setShardAKey(null);setShardCKey(null);setCall(null);}}/><p className="text-xs text-slate-500 dark:text-mist">{keySource==='device'?'Unlocks the encrypted Shard A saved in this browser.':'Decrypts the selected Veilora device-key backup in memory.'}</p>
          </div>
          <label className="space-y-2 text-sm font-medium"><span>Shard C recovery private key</span><input className={`${field} font-mono`} type="password" autoComplete="off" spellCheck={false} placeholder="0x…" value={shardCInput} onChange={event=>{setShardCInput(event.target.value.trim());setOwners(null);setShardAKey(null);setShardCKey(null);setCall(null);}}/><span className="block text-xs font-normal text-slate-500 dark:text-mist">Entered only in this page; never stored or sent to an API.</span></label>
        </div>
        {owners&&<div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200"><Check className="mr-2 inline" size={16}/>Both key addresses match the account on-chain.</div>}
        <button type="button" className={primaryButton} disabled={busy||!walletInput||(!shardAKey&&!passphrase)||(!shardCKey&&!shardCInput)||(keySource==='backup'&&!shardAKey&&!backup)} onClick={()=>void unlockAndVerify()}>{busy?<><Loader2 size={16} className="animate-spin"/>Checking keys…</>:<><LockKeyhole size={16}/>{shardAKey&&shardCKey?'Recheck keys on-chain':'Verify keys on-chain'}</>}</button>
      </section>

      <section className={`mt-5 space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-ink-700 dark:bg-ink-900 sm:p-7 ${!owners?'opacity-60':''}`}>
        <div className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f0ac5e]/20 text-sm font-semibold">2</span><div><h2 className="font-semibold">Choose a transfer</h2><p className="mt-1 text-sm text-slate-600 dark:text-mist">One asset transfer per transaction.</p></div></div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-2 text-sm font-medium"><span>Asset</span><select className={field} value={tokenSymbol} onChange={event=>{setTokenSymbol(event.target.value);setAmount('');setCall(null);}}>{WALLET_TOKENS.map(token=><option key={token.symbol} value={token.symbol}>{token.symbol} · {token.name}</option>)}</select></label><div className="space-y-2"><label className="text-sm font-medium" htmlFor="exit-amount">Amount</label><div className="flex gap-2"><input id="exit-amount" className={field} inputMode="decimal" placeholder="0.00" value={amount} onChange={event=>{setAmount(event.target.value);setCall(null);}}/><button type="button" className={secondaryButton} onClick={useMax} disabled={balance===null}>MAX</button></div><p className="text-xs text-slate-500 dark:text-mist">Available: {balance===null?'Loading…':`${formatUnits(balance,selectedToken.decimals)} ${selectedToken.symbol}`}</p></div></div>
        <label className="block space-y-2 text-sm font-medium"><span>Destination address</span><input className={`${field} font-mono`} autoComplete="off" spellCheck={false} placeholder="0x…" value={recipient} onChange={event=>{setRecipient(event.target.value);setCall(null);}}/></label>
        <button type="button" className={primaryButton} disabled={!owners||!accountVersion||busy||!recipient||!amount} onClick={()=>void reviewTransfer()}>{busy?<><Loader2 size={16} className="animate-spin"/>Preparing review…</>:<><Send size={16}/>Review transfer</>}</button>
      </section>

      {call&&wallet&&<section className="mt-5 space-y-4 rounded-3xl border border-[#e7a64e]/50 bg-white p-5 shadow-sm dark:bg-ink-900 sm:p-7"><div><h2 className="font-semibold">Review and send</h2><p className="mt-1 text-sm text-slate-600 dark:text-mist">The smart account will execute this transfer after your gas wallet submits the transaction and pays network fees.</p></div><dl className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm dark:bg-ink-800"><div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-mist">Amount</dt><dd className="font-medium">{call.amountLabel} {call.token.symbol}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-mist">From</dt><dd className="font-mono">{wallet.slice(0,8)}…{wallet.slice(-6)}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-mist">To</dt><dd className="font-mono">{call.recipient.slice(0,8)}…{call.recipient.slice(-6)}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-mist">Gas</dt><dd>Paid by your connected wallet</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-mist">Account</dt><dd>V{accountVersion}</dd></div></dl><button type="button" className={primaryButton} disabled={busy} onClick={()=>void sendTransfer()}>{busy?<><Loader2 size={16} className="animate-spin"/>Sending…</>:<><Wallet size={16}/>{gasAddress?'Send recovery transaction':'Connect gas wallet and send'}</>}</button><p className="text-xs leading-5 text-slate-500 dark:text-mist">Your two key signatures are created only after you choose Send. The transaction is irreversible. Confirm the account, asset, amount, and destination before approving the gas payment.</p></section>}

      {(error||notice)&&<div className={`mt-5 flex items-start gap-2 rounded-2xl p-4 text-sm leading-6 ${error?'bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200':'bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200'}`} role={error?'alert':'status'}>{error?<CircleAlert className="mt-1 shrink-0" size={17}/>:<Check className="mt-1 shrink-0" size={17}/>}<span className="min-w-0 break-words">{notice||error}{notice.includes('0x')&&<a className="ml-2 inline-flex items-center gap-1 underline" target="_blank" rel="noreferrer" href={`https://robinhoodchain.blockscout.com/tx/${notice.match(/0x[a-fA-F0-9]{64}/)?.[0]}`}>View transaction <ExternalLink size={12}/></a>}</span></div>}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-mist"><span>Keys are cleared after a successful send. Close this page to clear them at any time.</span><button type="button" className="underline" onClick={()=>{clearSecrets();setWallet(null);setOwners(null);setNotice('');}}>Clear keys and start over</button></div>
      <p className="mt-3 text-center text-xs text-slate-500 dark:text-mist"><Link to="/recover" className="underline">Need to freeze or replace a key?</Link></p>
    </div>
  </main>;
}

const field = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-[#e7a64e] focus:ring-2 focus:ring-[#f0ac5e]/20 dark:border-ink-700 dark:bg-ink-800 dark:text-cream';
const primaryButton = 'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#f0ac5e] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#e7a64e] disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButton = 'rounded-xl border border-slate-200 px-3 text-xs font-semibold dark:border-ink-700';
