import { useSyncExternalStore } from 'react';

/**
 * Privacy mode: hide balances and amounts across the wallet, for screen
 * shares, screenshots and using the app in public. Saved on this device only.
 */
const KEY = 'veilora:privacy-mode';
const listeners = new Set<() => void>();

function read(): boolean {
 try { return localStorage.getItem(KEY) === 'on'; } catch { return false; }
}
let enabled = read();

function apply() {
 if (typeof document !== 'undefined') document.documentElement.dataset.privacy = enabled ? 'on' : 'off';
}
apply();

export function setPrivacyMode(on: boolean) {
 enabled = on;
 try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* storage unavailable: still applies for this session */ }
 apply();
 listeners.forEach(l => l());
}
export const togglePrivacyMode = () => setPrivacyMode(!enabled);

function subscribe(listener: () => void) {
 listeners.add(listener);
 // Keep other open tabs in step.
 const onStorage = (e: StorageEvent) => { if (e.key === KEY) { enabled = read(); apply(); listener(); } };
 window.addEventListener('storage', onStorage);
 return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage); };
}

export function usePrivacyMode(): boolean {
 return useSyncExternalStore(subscribe, () => enabled, () => false);
}
