/**
 * Passkey unlock: Face ID, Touch ID or Windows Hello unlocks the device key
 * instead of the passphrase.
 *
 * The passkey's PRF extension returns a secret that only that passkey, after
 * biometric or PIN verification, can produce. It is stretched with HKDF into an
 * AES-GCM key that encrypts a second copy of the device key in this browser.
 * The secret never leaves the authenticator unverified, and nothing is sent to
 * Veilora. The passphrase-encrypted copy stays as the fallback.
 */
const STORE = (wallet: string) => `veilora:passkey-unlock:${wallet.toLowerCase()}`;
const INFO = new TextEncoder().encode('veilora:device-key:passkey:v1');

export type PasskeyRecord = { v: 1; credentialId: string; prfSalt: string; hkdfSalt: string; iv: string; ciphertext: string; createdAt: string };

const b64 = (bytes: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (text: string) => Uint8Array.from(atob(text), c => c.charCodeAt(0));
const buf = (bytes: Uint8Array) => new Uint8Array(bytes).buffer as ArrayBuffer;

/** HKDF-SHA256 over the PRF output, into a non-extractable AES-GCM key. */
async function wrappingKey(prfOutput: ArrayBuffer, hkdfSalt: Uint8Array): Promise<CryptoKey> {
 const material = await crypto.subtle.importKey('raw', prfOutput, 'HKDF', false, ['deriveKey']);
 return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: buf(hkdfSalt), info: buf(INFO) }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function sealDeviceKey(privateKey: string, prfOutput: ArrayBuffer, credentialId: string, prfSalt: Uint8Array): Promise<PasskeyRecord> {
 const hkdfSalt = crypto.getRandomValues(new Uint8Array(32));
 const iv = crypto.getRandomValues(new Uint8Array(12));
 const key = await wrappingKey(prfOutput, hkdfSalt);
 const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: buf(iv) }, key, new TextEncoder().encode(privateKey));
 return { v: 1, credentialId, prfSalt: b64(prfSalt), hkdfSalt: b64(hkdfSalt), iv: b64(iv), ciphertext: b64(ciphertext), createdAt: new Date().toISOString() };
}

export async function openDeviceKey(record: PasskeyRecord, prfOutput: ArrayBuffer): Promise<string> {
 const key = await wrappingKey(prfOutput, unb64(record.hkdfSalt));
 try {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf(unb64(record.iv)) }, key, buf(unb64(record.ciphertext)));
  return new TextDecoder().decode(plain);
 } catch {
  throw new Error('This passkey could not unlock your device key. Unlock with your passphrase and set up Face ID / Touch ID again.');
 }
}

export function getPasskeyRecord(wallet: string): PasskeyRecord | null {
 try {
  const r = JSON.parse(localStorage.getItem(STORE(wallet)) || 'null');
  return r && r.v === 1 && typeof r.credentialId === 'string' && typeof r.ciphertext === 'string' ? r : null;
 } catch { return null; }
}
export function removePasskeyRecord(wallet: string) {
 try { localStorage.removeItem(STORE(wallet)); } catch { /* storage unavailable */ }
}

/** Platform authenticator with user verification is available. PRF support is only known after creating a passkey. */
export async function passkeyUnlockAvailable(): Promise<boolean> {
 if (typeof window === 'undefined' || !window.PublicKeyCredential || !window.isSecureContext) return false;
 try { return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); } catch { return false; }
}

type PrfResults = { prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } } };

async function evaluatePrf(credentialId: string, prfSalt: Uint8Array): Promise<ArrayBuffer> {
 const assertion = await navigator.credentials.get({ publicKey: {
  challenge: crypto.getRandomValues(new Uint8Array(32)),
  allowCredentials: [{ type: 'public-key', id: buf(unb64(credentialId)) }],
  userVerification: 'required',
  timeout: 60_000,
  extensions: { prf: { eval: { first: buf(prfSalt) } } } as AuthenticationExtensionsClientInputs,
 } }) as PublicKeyCredential | null;
 const out = (assertion?.getClientExtensionResults() as PrfResults | undefined)?.prf?.results?.first;
 if (!out) throw new Error('This browser or passkey does not support unlocking with Face ID / Touch ID. Keep using your passphrase.');
 return out;
}

/** Create a passkey for this wallet and seal the (already unlocked) device key with it. */
export async function enrollPasskey(wallet: string, privateKey: string): Promise<PasskeyRecord> {
 const prfSalt = crypto.getRandomValues(new Uint8Array(32));
 const credential = await navigator.credentials.create({ publicKey: {
  challenge: crypto.getRandomValues(new Uint8Array(32)),
  rp: { name: 'Veilora' },
  user: { id: crypto.getRandomValues(new Uint8Array(16)), name: `Veilora ${wallet.slice(0, 6)}…${wallet.slice(-4)}`, displayName: 'Veilora device key' },
  pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
  authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'preferred', userVerification: 'required' },
  timeout: 60_000,
  extensions: { prf: { eval: { first: buf(prfSalt) } } } as AuthenticationExtensionsClientInputs,
 } }) as PublicKeyCredential | null;
 if (!credential) throw new Error('No passkey was created.');
 const ext = credential.getClientExtensionResults() as PrfResults;
 if (ext.prf?.enabled === false) throw new Error('This browser or passkey does not support unlocking with Face ID / Touch ID. Keep using your passphrase.');
 const credentialId = b64(credential.rawId);
 // Some browsers only return the PRF secret on sign-in, so always read it back once.
 const output = ext.prf?.results?.first ?? await evaluatePrf(credentialId, prfSalt);
 const record = await sealDeviceKey(privateKey, output, credentialId, prfSalt);
 if (await openDeviceKey(record, output) !== privateKey) throw new Error('Passkey setup could not be verified.');
 localStorage.setItem(STORE(wallet), JSON.stringify(record));
 return record;
}

/** Ask for Face ID / Touch ID and return the device key. */
export async function unlockWithPasskey(wallet: string): Promise<string> {
 const record = getPasskeyRecord(wallet);
 if (!record) throw new Error('Face ID / Touch ID unlock is not set up in this browser.');
 return openDeviceKey(record, await evaluatePrf(record.credentialId, unb64(record.prfSalt)));
}
