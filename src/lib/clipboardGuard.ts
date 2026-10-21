import { getAddress, isAddress } from 'viem';
import { looksAlike } from './recipientCheck';

/**
 * Paste protection. Clipboard malware swaps a copied address for a look-alike
 * it controls, and copied text can carry invisible characters. Veilora
 * remembers addresses copied with its own buttons (in memory only, for 30
 * minutes) and checks what is pasted into a recipient field against them.
 */
const REMEMBER_MS = 30 * 60_000;
const copied: { address: string; at: number }[] = [];
// Zero-width, bidirectional-control and soft-hyphen characters that render as nothing.
const HIDDEN = /[­​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

export function rememberCopied(text: string, now = Date.now()) {
 const value = text.trim();
 if (!isAddress(value)) return;
 copied.unshift({ address: value.toLowerCase(), at: now });
 copied.splice(10);
}

/** Copy an address and remember it for paste checks. */
export async function copyAddress(address: string) {
 await navigator.clipboard.writeText(address);
 rememberCopied(address);
}

export type PasteCheck = { value: string; removedHidden: boolean; mismatch: string | null };

export function checkPaste(raw: string, now = Date.now()): PasteCheck {
 const withoutHidden = raw.replace(HIDDEN, '');
 const value = withoutHidden.trim();
 const removedHidden = withoutHidden.length !== raw.length;
 let mismatch: string | null = null;
 if (isAddress(value)) {
  const recent = copied.filter(c => now - c.at <= REMEMBER_MS);
  const exact = recent.some(c => c.address === value.toLowerCase());
  const lookalike = recent.find(c => looksAlike(c.address, value, 3));
  if (!exact && lookalike) {
   const a = getAddress(lookalike.address);
   mismatch = `This pasted address is not the one you copied in Veilora (${a.slice(0, 6)}…${a.slice(-4)}), but it starts and ends the same way. Your clipboard may have been changed by malware. Do not send until you have checked the address with its source.`;
  }
 }
 return { value, removedHidden, mismatch };
}

/** Test helper: forget everything remembered. */
export function forgetCopied() { copied.splice(0); }
