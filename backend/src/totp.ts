import { createHmac, randomBytes } from "node:crypto";

/** RFC 6238 time-based one-time codes (SHA-1, 6 digits, 30 seconds), as used by authenticator apps. */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_PERIOD_SECONDS = 30;

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(text: string): Buffer {
  const clean = text.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error("Invalid base32 secret");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export const generateTotpSecret = () => base32Encode(randomBytes(20));
export const totpStep = (nowMs = Date.now()) => Math.floor(nowMs / 1000 / TOTP_PERIOD_SECONDS);

export function totpCode(secret: string, step: number, digits = 6): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 15;
  const binary = ((hmac[offset] & 127) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, "0");
}

/** The matching step within one period either side of now, or null. Steps at or before `lastStep` were already used. */
export function verifyTotp(secret: string, code: string, lastStep: number | null, nowMs = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const now = totpStep(nowMs);
  for (const step of [now, now - 1, now + 1]) {
    if (lastStep != null && step <= lastStep) continue;
    if (totpCode(secret, step) === code) return step;
  }
  return null;
}

export function otpauthUri(secret: string, wallet: string): string {
  const label = encodeURIComponent(`Veilora:${wallet.slice(0, 6)}…${wallet.slice(-4)}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=Veilora&algorithm=SHA1&digits=6&period=${TOTP_PERIOD_SECONDS}`;
}
