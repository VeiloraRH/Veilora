import { describe, expect, test } from 'bun:test';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
} });

describe('hide when away', () => {
  test('is on by default and remembers being turned off', async () => {
    const mod = await import('../src/lib/awayCover');
    mod.setHideWhenAway(false);
    expect(storage.get('veilora:hide-when-away')).toBe('off');
    mod.setHideWhenAway(true);
    expect(storage.get('veilora:hide-when-away')).toBe('on');
  });

  test('counts a hidden tab or an unfocused window as away', async () => {
    const { isAway } = await import('../src/lib/awayCover');
    expect(isAway({ visibilityState: 'hidden', hasFocus: () => true })).toBe(true);
    expect(isAway({ visibilityState: 'visible', hasFocus: () => false })).toBe(true);
    expect(isAway({ visibilityState: 'visible', hasFocus: () => true })).toBe(false);
  });
});
