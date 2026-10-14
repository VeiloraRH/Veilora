import { describe, expect, test } from 'bun:test';
import { openDeviceKey, sealDeviceKey } from '../src/lib/passkeyUnlock';

const key = `0x${'ab'.repeat(32)}`;
const prf = (byte: number) => new Uint8Array(32).fill(byte).buffer as ArrayBuffer;

describe('passkey unlock sealing', () => {
  test('the same passkey secret opens the sealed device key', async () => {
    const record = await sealDeviceKey(key, prf(7), 'cred-id', new Uint8Array(32).fill(1));
    expect(record.ciphertext).not.toContain('abab');
    expect(await openDeviceKey(record, prf(7))).toBe(key);
  });

  test('a different passkey secret cannot open it', async () => {
    const record = await sealDeviceKey(key, prf(7), 'cred-id', new Uint8Array(32).fill(1));
    await expect(openDeviceKey(record, prf(8))).rejects.toThrow('could not unlock');
  });

  test('every seal uses fresh salt and nonce', async () => {
    const a = await sealDeviceKey(key, prf(7), 'cred-id', new Uint8Array(32).fill(1));
    const b = await sealDeviceKey(key, prf(7), 'cred-id', new Uint8Array(32).fill(1));
    expect(a.iv).not.toBe(b.iv);
    expect(a.hkdfSalt).not.toBe(b.hkdfSalt);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });
});
