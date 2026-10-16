import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { ArrowUpRight, ExternalLink, RefreshCw, Search, Star } from 'lucide-react';
import { Private } from '@/components/wallet/Private';
import { PageTitle, TokenIcon, shortAddress } from '@/components/wallet/WalletUI';
import { amountText, EXPLORER } from '@/lib/walletChain';
import { useHoldings } from '@/lib/walletQueries';
import { WALLET_TOKENS } from '@/lib/tokens';

const WATCHLIST_KEY = 'veilora:market:watchlist';
const categories = ['All', 'Crypto', 'Stocks', 'ETFs', 'Watchlist'] as const;

function readWatchlist(): string[] {
  try {
    const value = localStorage.getItem(WATCHLIST_KEY);
    const parsed: unknown = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export const Route = createFileRoute('/app/market')({
  validateSearch: (search: Record<string, unknown>) => ({ q: typeof search.q === 'string' ? search.q : '' }),
  component: MarketScreen,
});

function MarketScreen() {
  const { q } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [category, setCategory] = useState<(typeof categories)[number]>('All');
  const [watchlist, setWatchlist] = useState<string[]>(readWatchlist);
  const holdings = useHoldings();

  function toggleWatchlist(symbol: string) {
    setWatchlist(current => {
      const next = current.includes(symbol) ? current.filter(item => item !== symbol) : [...current, symbol];
      try {
        localStorage.setItem(WATCHLIST_KEY, JSON.stringify(next));
      } catch {
        // Keep the current session usable when browser storage is unavailable.
      }
      return next;
    });
  }

  const tokens = WALLET_TOKENS.filter(token => {
    const matchesCategory = category === 'Watchlist'
      ? watchlist.includes(token.symbol)
      : category === 'All'
        || (category === 'Crypto' && !token.stock)
        || (category === 'Stocks' && token.stock && token.category !== 'etf')
        || (category === 'ETFs' && token.category === 'etf');
    return matchesCategory && `${token.symbol} ${token.name} ${token.address}`.toLowerCase().includes(q.toLowerCase());
  });

  return <>
    <PageTitle
      title="Market"
      description="Discover assets on Robinhood Chain."
      action={<button className="wallet-icon-button" aria-label="Refresh balances" onClick={() => void holdings.refetch()}><RefreshCw size={18} className={holdings.isFetching ? 'animate-spin' : ''} /></button>}
    />
    <div className="wallet-toolbar">
      <div className="wallet-tabs" aria-label="Asset category">
        {categories.map(item => <button key={item} className={item === category ? 'active' : ''} onClick={() => setCategory(item)} aria-pressed={item === category}>{item}{item === 'Watchlist' && watchlist.length > 0 ? ` · ${watchlist.length}` : ''}</button>)}
      </div>
      <div className="wallet-search"><Search size={17} /><input aria-label="Filter market" placeholder="Search by name, symbol or address" value={q} onChange={event => void navigate({ search: { q: event.target.value }, replace: true })} /></div>
    </div>
    {holdings.error && <p className="wallet-error" role="alert">Balances could not be loaded. Asset listings are still available.</p>}
    <div className="wallet-panel wallet-table-scroll">
      <table className="wallet-table">
        <thead><tr><th>Asset</th><th>Type</th><th>Your balance</th><th>Contract</th><th aria-label="Watchlist" /><th /></tr></thead>
        <tbody>{tokens.map(token => {
          const holding = holdings.data?.find(item => item.token.symbol === token.symbol);
          const saved = watchlist.includes(token.symbol);
          return <tr key={token.symbol}>
            <td><div className="wallet-cell"><TokenIcon token={token} /><div><strong>{token.symbol}</strong><small>{token.name}</small></div></div></td>
            <td>{token.native ? 'Native' : token.symbol === 'USDG' ? 'Stablecoin' : token.category === 'etf' ? 'Tokenized ETF' : 'Tokenized stock'}</td>
            <td><Private>{holding?.raw != null ? amountText(holding.raw, token.decimals) : '—'}</Private> <span className="text-xs opacity-50">{token.symbol}</span></td>
            <td>{token.native ? <span className="wallet-token-address">Native asset</span> : <a className="wallet-token-address inline-flex items-center gap-2" href={`${EXPLORER}/address/${token.address}`} target="_blank" rel="noreferrer">{shortAddress(token.address)}<ExternalLink size={12} /></a>}</td>
            <td><button className="wallet-icon-button" aria-label={`${saved ? 'Remove' : 'Add'} ${token.symbol} ${saved ? 'from' : 'to'} watchlist`} aria-pressed={saved} title={saved ? 'Remove from watchlist' : 'Add to watchlist'} onClick={() => toggleWatchlist(token.symbol)}><Star size={16} fill={saved ? 'currentColor' : 'none'} className={saved ? 'text-[#bb762e]' : ''} /></button></td>
            <td><Link className="wallet-soft-button" to="/app/swap" search={{ buy: token.symbol }}>Swap<ArrowUpRight size={14} /></Link></td>
          </tr>;
        })}</tbody>
      </table>
      {!tokens.length && <div className="wallet-empty"><Search /><h3>{category === 'Watchlist' && !watchlist.length ? 'Your watchlist is ready' : 'No matching assets'}</h3><p>{category === 'Watchlist' && !watchlist.length ? 'Star an asset to keep it close at hand. Your watchlist stays on this device.' : 'Try another name or token symbol.'}</p></div>}
    </div>
    <p className="wallet-count">{tokens.length} assets · Robinhood Chain · Balances in token units{category === 'Watchlist' ? ' · Watchlist saved on this device' : ''}</p>
  </>;
}
