import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowRight, ArrowUpRight, Command, Search, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui';
import { WALLET_TOKENS } from '@/lib/tokens';

const destinations = [
  { label: 'Dashboard', detail: 'Your balance and recent activity', terms: 'home wallet overview', to: '/app' },
  { label: 'Market', detail: 'Browse supported assets', terms: 'tokens assets prices', to: '/app/market' },
  { label: 'Swap', detail: 'Exchange supported assets', terms: 'trade exchange', to: '/app/swap' },
  { label: 'Bridge', detail: 'Move assets across chains', terms: 'cross chain transfer', to: '/app/bridge' },
  { label: 'Activity', detail: 'Search your transaction history', terms: 'history transactions transfers', to: '/app/activity' },
  { label: 'Wallet Rules', detail: 'Manage your automatic wallet rules', terms: 'automation rules', to: '/app/rules' },
  { label: 'Settings', detail: 'Manage your Veilora preferences', terms: 'preferences configuration', to: '/app/settings' },
  { label: 'Security', detail: 'Review quorum and recovery status', terms: 'keys shard recovery quorum', to: '/app/security' },
  { label: 'Token approvals', detail: 'Review and revoke spending approvals', terms: 'allowance revoke permissions', to: '/app/approvals' },
  { label: 'Watched addresses', detail: 'View wallets you follow', terms: 'watch tracking address', to: '/app/watch' },
] as const;

type SearchResult =
  | { type: 'destination'; label: string; detail: string; to: (typeof destinations)[number]['to'] }
  | { type: 'asset'; label: string; detail: string; symbol: string };

export function UniversalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const normalized = query.trim().toLowerCase();

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(true);
      }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const results = useMemo<SearchResult[]>(() => {
    const destinationResults = destinations
      .filter(item => !normalized || `${item.label} ${item.detail} ${item.terms}`.toLowerCase().includes(normalized))
      .map(item => ({ type: 'destination' as const, label: item.label, detail: item.detail, to: item.to }));
    const assetResults = WALLET_TOKENS
      .filter(token => normalized && `${token.symbol} ${token.name} ${token.address}`.toLowerCase().includes(normalized))
      .slice(0, 6)
      .map(token => ({ type: 'asset' as const, label: token.symbol, detail: token.name, symbol: token.symbol }));
    return [...assetResults, ...destinationResults].slice(0, 9);
  }, [normalized]);

  function choose(result: SearchResult) {
    onOpenChange(false);
    if (result.type === 'asset') void navigate({ to: '/app/market', search: { q: result.symbol } });
    else if (result.to === '/app') void navigate({ to: '/app' });
    else if (result.to === '/app/market') void navigate({ to: '/app/market', search: { q: '' } });
    else if (result.to === '/app/swap') void navigate({ to: '/app/swap', search: { buy: 'NVDA' } });
    else if (result.to === '/app/bridge') void navigate({ to: '/app/bridge' });
    else if (result.to === '/app/activity') void navigate({ to: '/app/activity' });
    else if (result.to === '/app/rules') void navigate({ to: '/app/rules' });
    else if (result.to === '/app/settings') void navigate({ to: '/app/settings' });
    else if (result.to === '/app/security') void navigate({ to: '/app/security' });
    else if (result.to === '/app/approvals') void navigate({ to: '/app/approvals' });
    else void navigate({ to: '/app/watch', search: { address: '' } });
  }

  function askVeily() {
    const prompt = query.trim();
    if (!prompt) return;
    onOpenChange(false);
    window.dispatchEvent(new CustomEvent('veilora:veily-prompt', { detail: { prompt } }));
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="wallet-dialog universal-search-dialog sm:max-w-xl">
      <DialogTitle className="sr-only">Universal Search</DialogTitle>
      <DialogDescription className="sr-only">Search Veilora pages and supported assets, or ask Veily about something else.</DialogDescription>
      <div className="universal-search-input"><Search size={19} /><input autoFocus aria-label="Universal Search" placeholder="Search Veilora" value={query} onChange={event => setQuery(event.target.value)} /><kbd>ESC</kbd></div>
      <div className="universal-search-results" aria-live="polite">
        {!normalized && <p className="universal-search-hint">Find a page or asset</p>}
        {results.map(result => <button key={`${result.type}-${result.label}`} className="universal-search-result" onClick={() => choose(result)}>
          <span className="universal-search-result-icon">{result.type === 'asset' ? result.label.slice(0, 2) : <ArrowUpRight size={16} />}</span>
          <span className="universal-search-result-copy"><strong>{result.label}</strong><small>{result.detail}</small></span>
          <ArrowRight size={15} className="universal-search-result-arrow" />
        </button>)}
        {normalized && results.length === 0 && <p className="universal-search-empty">No pages or assets match “{query.trim()}”.</p>}
      </div>
      {normalized && <button className="universal-search-veily" onClick={askVeily}><span className="universal-search-veily-icon"><Sparkles size={17} /></span><span><strong>Ask Veily</strong><small>Search didn’t find it? Continue with “{query.trim()}”</small></span><ArrowRight size={15} /></button>}
      <div className="universal-search-footer"><span><Command size={13} /> K to search anytime</span><span>Search stays on this device until you choose Ask Veily</span></div>
    </DialogContent>
  </Dialog>;
}
