const ENCRYPTION_VERSION = 1;
const PBKDF2_ITERATIONS = 310_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return new Uint8Array(bytes).buffer as ArrayBuffer;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: asArrayBuffer(salt), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export function validateDevicePassphrase(passphrase: string): string | null {
  if (passphrase.length < 12) return "Use a passphrase with at least 12 characters.";
  return null;
}

export async function encryptDeviceKey(privateKey: string, passphrase: string): Promise<string> {
  const error = validateDevicePassphrase(passphrase);
  if (error) throw new Error(error);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(privateKey));
  return JSON.stringify({
    version: ENCRYPTION_VERSION,
    kdf: "PBKDF2-SHA-256",
    iterations: PBKDF2_ITERATIONS,
    cipher: "AES-256-GCM",
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  });
}

export async function decryptDeviceKey(payload: string, passphrase: string): Promise<string> {
  try {
    const record = JSON.parse(payload) as {
      version?: number;
      kdf?: string;
      iterations?: number;
      cipher?: string;
      salt?: string;
      iv?: string;
      ciphertext?: string;
    };
    if (
      record.version !== ENCRYPTION_VERSION || record.kdf !== "PBKDF2-SHA-256" ||
      record.iterations !== PBKDF2_ITERATIONS || record.cipher !== "AES-256-GCM" ||
      !record.salt || !record.iv || !record.ciphertext
    ) throw new Error("Invalid encrypted key record");
    const key = await deriveKey(passphrase, fromBase64(record.salt));
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: asArrayBuffer(fromBase64(record.iv)) },
      key,
      asArrayBuffer(fromBase64(record.ciphertext)),
    );
    return decoder.decode(plaintext);
  } catch {
    throw new Error("Could not unlock the device key. Check your passphrase and try again.");
  }
}

