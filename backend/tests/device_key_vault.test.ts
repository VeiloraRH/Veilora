import { expect, test } from "bun:test";
import { decryptDeviceKey, encryptDeviceKey } from "../../src/lib/deviceKeyVault";

const shardA = `0x${"a".repeat(64)}`;
const passphrase = "correct horse battery staple";

test("device key encryption round-trips without storing plaintext", async () => {
  const encrypted = await encryptDeviceKey(shardA, passphrase);

  expect(encrypted).not.toContain(shardA);
  expect(JSON.parse(encrypted)).toMatchObject({
    version: 1,
    kdf: "PBKDF2-SHA-256",
    cipher: "AES-256-GCM",
  });
  expect(await decryptDeviceKey(encrypted, passphrase)).toBe(shardA);
});
test("device key decryption rejects an incorrect passphrase", async () => {
  const encrypted = await encryptDeviceKey(shardA, passphrase);

  await expect(decryptDeviceKey(encrypted, "a different passphrase")).rejects.toThrow("Could not unlock");
});

test("device key decryption rejects modified ciphertext", async () => {
  const encrypted = await encryptDeviceKey(shardA, passphrase);
  const record = JSON.parse(encrypted);
  const bytes = Uint8Array.from(atob(record.ciphertext), (character) => character.charCodeAt(0));
  bytes[0] ^= 1;
  record.ciphertext = btoa(String.fromCharCode(...bytes));

  await expect(decryptDeviceKey(JSON.stringify(record), passphrase)).rejects.toThrow("Could not unlock");
});
