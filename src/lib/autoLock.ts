import { useSyncExternalStore } from 'react';

/**
 * Auto-lock: after a period without activity, or after the tab has been in
 * the background, the device key is wiped from memory and the passphrase is
 * needed again. Settings are saved on this device only.
 */
export type AutoLockSettings = { idleMinutes: number; lockWhenHidden: boolean };
export type LockReason = 'idle' | 'hidden' | 'manual';

export const IDLE_CHOICES = [5, 15, 30, 60, 0] as const; // 0 = never
export const HIDDEN_GRACE_MS = 60_000;
const KEY = 'veilora:auto-lock';
const DEFAULTS: AutoLockSettings = { idleMinutes: 15, lockWhenHidden: false };
const listeners = new Set<() => void>();

function read(): AutoLockSettings {
 try {
  const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
  const idle = Number(raw?.idleMinutes);
  return {
   idleMinutes: (IDLE_CHOICES as readonly number[]).includes(idle) ? idle : DEFAULTS.idleMinutes,
   lockWhenHidden: typeof raw?.lockWhenHidden === 'boolean' ? raw.lockWhenHidden : DEFAULTS.lockWhenHidden,
  };
 } catch { return DEFAULTS; }
}
let current = read();

export function getAutoLockSettings(): AutoLockSettings { return current; }

export function saveAutoLockSettings(next: Partial<AutoLockSettings>) {
 current = { ...current, ...next };
 try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* storage unavailable: applies for this session */ }
 listeners.forEach(l => l());
}

export function useAutoLockSettings(): AutoLockSettings {
 return useSyncExternalStore(l => { listeners.add(l); return () => { listeners.delete(l); }; }, () => current, () => DEFAULTS);
}

/** Whether to lock now, given the last activity and how long the tab has been hidden. */
export function lockDue(settings: AutoLockSettings, now: number, lastActivity: number, hiddenSince: number | null): LockReason | null {
 if (settings.lockWhenHidden && hiddenSince !== null && now - hiddenSince >= HIDDEN_GRACE_MS) return 'hidden';
 if (settings.idleMinutes > 0 && now - lastActivity >= settings.idleMinutes * 60_000) return 'idle';
 return null;
}

export function lockMessage(reason: LockReason | null, settings: AutoLockSettings): string | null {
 if (reason === 'idle') return `Locked after ${settings.idleMinutes} minutes without activity.`;
 if (reason === 'hidden') return 'Locked because Veilora was in the background.';
 if (reason === 'manual') return 'You locked your wallet.';
 return null;
}
