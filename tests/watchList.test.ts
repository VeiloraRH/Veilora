import { describe, expect, test } from 'bun:test';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
} });

const owner = '0xeFE2268BcC784301A939DAaee7393ab81af4CC53';
const other = '0x2222222222222222222222222222222222222222';

describe('watch-only addresses', () => {
  test('adds, refuses duplicates, own wallet and bad input, renames and removes', async () => {
    const w = await import('../src/lib/watchList');
    expect(w.addWatched(owner, 'Treasury', other)).toBeNull();
    expect(w.getWatchList(owner)).toHaveLength(1);
    expect(w.getWatchList(owner)[0].name).toBe('Treasury');
    expect(w.addWatched(owner, 'Again', other.toUpperCase().replace('0X', '0x'))).toContain('already watching');
    expect(w.addWatched(owner, 'Me', owner)).toContain('your own wallet');
    expect(w.addWatched(owner, 'Bad', '0x1234')).toContain('valid');
    const id = w.getWatchList(owner)[0].id;
    w.renameWatched(owner, id, 'Cold storage');
    expect(w.getWatchList(owner)[0].name).toBe('Cold storage');
    expect(JSON.parse(storage.get(`veilora:watch:${owner.toLowerCase()}`)!)[0].name).toBe('Cold storage');
    w.removeWatched(owner, id);
    expect(w.getWatchList(owner)).toHaveLength(0);
  });
});
