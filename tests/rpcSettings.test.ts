import { afterAll, afterEach, describe, expect, test } from 'bun:test';
import { getRpcOverride, resolveRpcEndpoint, RPC_OVERRIDE_KEY, saveRpcOverride, clearRpcOverride, verifyRpcEndpoint } from '../src/lib/rpcSettings';

const originalFetch = globalThis.fetch;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
} });

afterEach(() => {
  globalThis.fetch = originalFetch;
  storage.clear();
});

describe('device RPC preference', () => {
  test('uses the gateway until an override is saved, and can clear it', () => {
    expect(resolveRpcEndpoint('https://gateway.example/rpc')).toBe('https://gateway.example/rpc');
    saveRpcOverride('https://node.example/key');
    expect(getRpcOverride()).toBe('https://node.example/key');
    expect(resolveRpcEndpoint('https://gateway.example/rpc')).toBe('https://node.example/key');
    clearRpcOverride();
    expect(getRpcOverride()).toBe('');
  });

  test('accepts a reachable Robinhood Chain endpoint and returns its normalized URL', async () => {
    globalThis.fetch = async (_input, init) => {
      expect(JSON.parse(String(init?.body))).toMatchObject({ method: 'eth_chainId', params: [] });
      return Response.json({ jsonrpc: '2.0', id: 1, result: '0x1237' });
    };
    await expect(verifyRpcEndpoint('https://node.example/rpc')).resolves.toBe('https://node.example/rpc');
  });

  test('rejects wrong-chain endpoints and insecure remote HTTP', async () => {
    globalThis.fetch = async () => Response.json({ jsonrpc: '2.0', id: 1, result: '0x1' });
    await expect(verifyRpcEndpoint('https://node.example/rpc')).rejects.toThrow('chain ID 4663');
    await expect(verifyRpcEndpoint('http://node.example/rpc')).rejects.toThrow('Use an HTTPS RPC endpoint');
  });

  test('rejects endpoints whose provider call fails', async () => {
    globalThis.fetch = async () => Response.json({ jsonrpc: '2.0', id: 1, error: { message: 'provider disabled' } });
    await expect(verifyRpcEndpoint('https://node.example/rpc')).rejects.toThrow('provider disabled');
    expect(RPC_OVERRIDE_KEY).toBe('veilora:rpc:url');
  });
});

afterAll(() => {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});
