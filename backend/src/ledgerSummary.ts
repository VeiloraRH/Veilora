import { formatUnits, getAddress, isAddress } from "viem";

/**
 * Totals for Veily's ledger_summary tool: what this wallet sent and received
 * per asset over a period, and who it sent to most. Built from the explorer's
 * latest pages of native and ERC-20 transfers. Addresses only — contact names
 * live on the user's device and are added there.
 */
type ExplorerTransfer = {
  timestamp?: string; status?: string; result?: string;
  from?: { hash?: string } | null; to?: { hash?: string } | null;
  value?: string; total?: { value?: string; decimals?: string } | null; token?: { symbol?: string; decimals?: string } | null;
};
type Movement = { asset: string; decimals: number; raw: bigint; from: string; to: string; at: number };

function movements(wallet: string, transactions: ExplorerTransfer[], tokenTransfers: ExplorerTransfer[]): Movement[] {
  const out: Movement[] = [];
  const add = (item: ExplorerTransfer, asset: string, decimals: number, raw: string | undefined) => {
    const from = item.from?.hash; const to = item.to?.hash; const at = Date.parse(item.timestamp ?? "");
    if (!from || !to || !isAddress(from) || !isAddress(to) || !raw || !/^\d+$/.test(raw) || Number.isNaN(at)) return;
    if (item.status === "error" || item.result === "error") return;
    const value = BigInt(raw);
    if (value === 0n || (from.toLowerCase() !== wallet && to.toLowerCase() !== wallet)) return;
    out.push({ asset, decimals, raw: value, from: from.toLowerCase(), to: to.toLowerCase(), at });
  };
  for (const tx of transactions) add(tx, "ETH", 18, tx.value);
  for (const t of tokenTransfers) add(t, t.token?.symbol || "token", Number(t.total?.decimals ?? t.token?.decimals ?? 18), t.total?.value);
  return out;
}

export function summarizeLedger(walletAddress: string, transactions: ExplorerTransfer[], tokenTransfers: ExplorerTransfer[], days: number, now = Date.now(), counterparty?: string) {
  const wallet = walletAddress.toLowerCase();
  const since = now - days * 86_400_000;
  const inWindow = movements(wallet, transactions, tokenTransfers).filter((m) => m.at >= since && m.at <= now);
  const totals = new Map<string, { decimals: number; sent: bigint; received: bigint; transfers: number }>();
  const recipients = new Map<string, { address: string; asset: string; decimals: number; sent: bigint; transfers: number }>();
  for (const m of inWindow) {
    const t = totals.get(m.asset) ?? { decimals: m.decimals, sent: 0n, received: 0n, transfers: 0 };
    t.transfers += 1;
    if (m.from === wallet) {
      t.sent += m.raw;
      const key = `${m.to}:${m.asset}`;
      const r = recipients.get(key) ?? { address: getAddress(m.to), asset: m.asset, decimals: m.decimals, sent: 0n, transfers: 0 };
      r.sent += m.raw; r.transfers += 1; recipients.set(key, r);
    } else t.received += m.raw;
    totals.set(m.asset, t);
  }
  const other = counterparty && isAddress(counterparty) ? counterparty.toLowerCase() : null;
  const withCounterparty = other ? (() => {
    const sent = new Map<string, { decimals: number; raw: bigint; transfers: number }>();
    const received = new Map<string, { decimals: number; raw: bigint; transfers: number }>();
    let last: number | null = null;
    for (const m of inWindow) {
      const bucket = m.from === wallet && m.to === other ? sent : m.from === other && m.to === wallet ? received : null;
      if (!bucket) continue;
      const t = bucket.get(m.asset) ?? { decimals: m.decimals, raw: 0n, transfers: 0 };
      t.raw += m.raw; t.transfers += 1; bucket.set(m.asset, t);
      last = last == null || m.at > last ? m.at : last;
    }
    const list = (map: typeof sent) => [...map].map(([asset, t]) => ({ asset, amount: formatUnits(t.raw, t.decimals), transfers: t.transfers }));
    return { address: getAddress(other), sent: list(sent), received: list(received), lastTransfer: last == null ? null : new Date(last).toISOString() };
  })() : undefined;
  const oldest = transactions.length || tokenTransfers.length ? Math.min(...[...transactions, ...tokenTransfers].map((i) => Date.parse(i.timestamp ?? "")).filter((n) => !Number.isNaN(n))) : null;
  return {
    periodDays: days,
    since: new Date(since).toISOString(),
    totals: [...totals].map(([asset, t]) => ({ asset, sent: formatUnits(t.sent, t.decimals), received: formatUnits(t.received, t.decimals), transfers: t.transfers })),
    topRecipients: [...recipients.values()].sort((a, b) => b.transfers - a.transfers || (b.sent > a.sent ? 1 : -1)).slice(0, 5)
      .map((r) => ({ address: r.address, asset: r.asset, sent: formatUnits(r.sent, r.decimals), transfers: r.transfers })),
    coverage: oldest != null && oldest > since
      ? `Only history back to ${new Date(oldest).toISOString().slice(0, 10)} was available, so totals may be incomplete for the full period.`
      : "Covers the full period from the explorer's latest transfers.",
    ...(withCounterparty ? { withCounterparty } : {}),
    source: "Robinhood Chain Blockscout",
  };
}
