import { describe, expect, test } from 'bun:test';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
} });

describe('auto-lock', () => {
  test('locks after the idle window, and never when set to never', async () => {
    const { lockDue } = await import('../src/lib/autoLock');
    const t0 = 1_000_000;
    const fifteen = { idleMinutes: 15, lockWhenHidden: false };
    expect(lockDue(fifteen, t0 + 14 * 60_000, t0, null)).toBeNull();
    expect(lockDue(fifteen, t0 + 15 * 60_000, t0, null)).toBe('idle');
    expect(lockDue({ idleMinutes: 0, lockWhenHidden: false }, t0 + 86_400_000, t0, null)).toBeNull();
  });

  test('locks a backgrounded tab after the grace period only when enabled', async () => {
    const { lockDue, HIDDEN_GRACE_MS } = await import('../src/lib/autoLock');
    const now = 5_000_000;
    expect(lockDue({ idleMinutes: 0, lockWhenHidden: true }, now, now, now - HIDDEN_GRACE_MS + 1)).toBeNull();
    expect(lockDue({ idleMinutes: 0, lockWhenHidden: true }, now, now, now - HIDDEN_GRACE_MS)).toBe('hidden');
    expect(lockDue({ idleMinutes: 0, lockWhenHidden: false }, now, now, now - 10 * HIDDEN_GRACE_MS)).toBeNull();
  });

  test('defaults to 15 minutes, saves choices, and ignores invalid stored values', async () => {
    const mod = await import('../src/lib/autoLock');
    expect(mod.getAutoLockSettings()).toEqual({ idleMinutes: 15, lockWhenHidden: false });
    mod.saveAutoLockSettings({ idleMinutes: 5, lockWhenHidden: true });
    expect(JSON.parse(storage.get('veilora:auto-lock')!)).toEqual({ idleMinutes: 5, lockWhenHidden: true });
    expect(mod.lockMessage('idle', mod.getAutoLockSettings())).toBe('Locked after 5 minutes without activity.');
  });
});
