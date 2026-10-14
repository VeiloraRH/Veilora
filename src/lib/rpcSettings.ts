export const RPC_OVERRIDE_KEY = 'veilora:rpc:url';

export function getRpcOverride(): string {
  try { return localStorage.getItem(RPC_OVERRIDE_KEY)?.trim() || ''; }
  catch { return ''; }
}

export function resolveRpcEndpoint(gateway: string): string {
  return getRpcOverride() || gateway;
}

export function saveRpcOverride(value: string) {
  localStorage.setItem(RPC_OVERRIDE_KEY, value.trim());
}

export function clearRpcOverride() {
  localStorage.removeItem(RPC_OVERRIDE_KEY);
}

export async function verifyRpcEndpoint(value: string): Promise<string> {
  const clean = value.trim();
  let url: URL;
  try { url = new URL(clean); }
  catch { throw new Error('Enter a complete RPC URL, including https://.'); }
  const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && localHost)) {
    throw new Error('Use an HTTPS RPC endpoint. HTTP is only allowed for localhost.');
  }
  if (url.username || url.password || url.hash) throw new Error('Put provider credentials in the URL path or query string, not in its username, password, or fragment.');

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new Error('Could not reach this RPC from your browser. Check the URL and confirm the provider allows browser requests (CORS).');
  }
  if (!response.ok) throw new Error(`The RPC returned HTTP ${response.status}.`);
  const body = await response.json().catch(() => null) as { result?: string; error?: { message?: string } } | null;
  if (body?.error) throw new Error(body.error.message || 'The RPC rejected the chain ID check.');
  if (body?.result?.toLowerCase() !== '0x1237') throw new Error('This endpoint did not report Robinhood Chain (chain ID 4663).');
  return url.toString();
}
