import { useSyncExternalStore } from 'react';

/**
 * Hide when away: while the wallet is unlocked, cover it whenever the tab is
 * hidden or the window loses focus, so balances don't show in tab previews,
 * the app switcher or a screen share that switches windows. On by default;
 * saved on this device only.
 */
const KEY = 'veilora:hide-when-away';
const listeners = new Set<() => void>();

function read(): boolean {
 try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}
let enabled = read();

export function setHideWhenAway(on: boolean) {
 enabled = on;
 try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* storage unavailable: applies for this session */ }
 listeners.forEach(l => l());
}

export function useHideWhenAway(): boolean {
 return useSyncExternalStore(l => { listeners.add(l); return () => { listeners.delete(l); }; }, () => enabled, () => true);
}

/** Whether the page currently counts as "away": hidden, or open but not focused. */
export const isAway = (doc: { visibilityState: string; hasFocus: () => boolean }) => doc.visibilityState === 'hidden' || !doc.hasFocus();
