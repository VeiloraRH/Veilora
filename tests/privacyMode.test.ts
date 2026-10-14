import { describe, expect, test } from 'bun:test';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
} });
const dataset: Record<string, string> = {};
Object.defineProperty(globalThis, 'document', { configurable: true, value: { documentElement: { dataset } } });

describe('privacy mode', () => {
  test('is off by default, persists on this device, and marks the page', async () => {
    const mode = await import('../src/lib/privacyMode');
    expect(storage.get('veilora:privacy-mode')).toBeUndefined();
    expect(dataset.privacy).toBe('off');
    mode.setPrivacyMode(true);
    expect(storage.get('veilora:privacy-mode')).toBe('on');
    expect(dataset.privacy).toBe('on');
    mode.togglePrivacyMode();
    expect(storage.get('veilora:privacy-mode')).toBe('off');
    expect(dataset.privacy).toBe('off');
  });
});
