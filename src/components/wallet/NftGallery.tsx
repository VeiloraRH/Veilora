import { useState } from 'react';
import { ExternalLink, Image, Loader2, RefreshCw, Send, Sparkles } from 'lucide-react';
import { useWalletNfts } from '@/lib/walletQueries';
import type { WalletNft } from '@/lib/nftHoldings';
import { shortAddress } from '@/components/wallet/WalletUI';
import { EXPLORER } from '@/lib/walletChain';
import { SendNftModal } from '@/components/wallet/SendNftModal';

function NftCard({ nft, onSend }: { nft: WalletNft; onSend: () => void }) {
  const quantity = (() => { try { return BigInt(nft.amount); } catch { return 1n; } })();
  return <article className="wallet-panel overflow-hidden">
    <div className="relative aspect-square bg-muted/60">
      <div className="absolute inset-0 grid place-items-center text-muted-foreground"><Image size={28}/></div>
      {nft.imageUrl&&<img src={nft.imageUrl} alt={nft.name} loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover" onError={event=>{event.currentTarget.style.display='none';}}/>}
      <span className="absolute right-3 top-3 rounded-full bg-black/70 px-2.5 py-1 font-mono text-[10px] text-white">#{nft.tokenId}</span>
    </div>
    <div className="space-y-2 p-4">
      <p className="truncate text-[10px] text-muted-foreground" title={nft.collectionName}>{nft.collectionName}</p>
      <h3 className="truncate text-sm font-medium" title={nft.name}>{nft.name}</h3>
      {nft.description&&<p className="line-clamp-2 min-h-8 text-xs leading-4 text-muted-foreground">{nft.description}</p>}
      <div className="flex items-center justify-between gap-2 border-t pt-3 text-[10px] text-muted-foreground">
        <span>{nft.tokenType}{nft.tokenType==='ERC-1155'&&quantity>1n?` · ${quantity.toString()} held`:''}</span>
        <a className="inline-flex items-center gap-1 hover:text-foreground" href={`${EXPLORER}/token/${nft.contractAddress}?a=${encodeURIComponent(nft.tokenId)}`} target="_blank" rel="noreferrer" title={`View ${shortAddress(nft.contractAddress)} on Blockscout`}>Contract<ExternalLink size={11}/></a>
      </div>
      <button className="wallet-soft-button w-full justify-center" onClick={onSend}><Send size={13}/>Send</button>
    </div>
  </article>;
}

export function NftGallery({ query }: { query: string }) {
  const nfts = useWalletNfts();
  const [sending, setSending] = useState<WalletNft | null>(null);
  const [sent, setSent] = useState('');
  const items = nfts.data?.pages.flatMap(page => page.items) ?? [];
  const normalizedQuery = query.trim().toLowerCase();
  const visible = items.filter(item => !normalizedQuery || `${item.name} ${item.collectionName} ${item.tokenId} ${item.contractAddress}`.toLowerCase().includes(normalizedQuery));

  return <section className="space-y-4" aria-label="Collectibles">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-sm font-medium">Collectibles</h2><p className="mt-1 text-xs text-muted-foreground">NFTs indexed for your Robinhood Chain account.</p></div>
      <button className="wallet-icon-button" aria-label="Refresh collectibles" disabled={nfts.isFetching} onClick={()=>void nfts.refetch()}><RefreshCw size={16} className={nfts.isFetching?'animate-spin':''}/></button>
    </div>
    {items.some(item=>item.imageUrl)&&<p className="text-[11px] leading-5 text-muted-foreground">Collectible artwork loads from the image host listed in its public metadata.</p>}
    {sent&&<p role="status" className="rounded-xl bg-emerald-500/5 p-3 text-xs text-emerald-600">{sent}</p>}
    {nfts.error&&<div className="wallet-error flex items-center justify-between gap-3" role="alert"><span>{nfts.error.message}</span><button className="wallet-soft-button shrink-0" onClick={()=>void nfts.refetch()}>Retry</button></div>}
    {nfts.isPending?<div className="wallet-panel flex min-h-52 items-center justify-center gap-2 text-xs text-muted-foreground"><Loader2 size={16} className="animate-spin"/>Loading collectibles…</div>
      :visible.length>0?<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map(nft=><NftCard key={nft.id} nft={nft} onSend={()=>{setSent('');setSending(nft);}}/>)}</div>
      :<div className="wallet-panel wallet-empty"><span className="wallet-empty-icon"><Sparkles size={24}/></span><h3>{normalizedQuery?'No matching collectibles':'No collectibles found'}</h3><p>{normalizedQuery?'Try another collection name or token ID.':'When Blockscout indexes NFTs owned by this account, they will appear here.'}</p></div>}
    {nfts.hasNextPage&&<div className="flex justify-center"><button className="wallet-soft-button" disabled={nfts.isFetchingNextPage} onClick={()=>void nfts.fetchNextPage()}>{nfts.isFetchingNextPage?<><Loader2 size={14} className="animate-spin"/>Loading…</>:'Load more'}</button></div>}
    <p className="wallet-count">{visible.length} collectible{visible.length===1?'':'s'} shown · Robinhood Chain</p>
    <SendNftModal nft={sending} onClose={()=>setSending(null)} onSent={details=>{setSent(details);void nfts.refetch();}}/>
  </section>;
}
