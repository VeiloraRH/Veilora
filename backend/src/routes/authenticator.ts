import { Router, type Request, type Response } from "express";
import { getAddress, isAddress, isHex, recoverMessageAddress, type Hex } from "viem";
import { decryptSecret, encryptSecret } from "../crypto";
import { query } from "../db/index";
import { freezeWallet, getFreezeState, isLockedOut, recordFailedAttempt, resetAttempts } from "../freeze";
import { recordAlert } from "../alerts/store";
import { generateTotpSecret, otpauthUri, verifyTotp } from "../totp";

/**
 * Authenticator app codes. Setting one up or removing it needs the device key;
 * removing also needs a current code, so a stolen device key cannot quietly
 * switch it off. A code alone can only freeze the wallet: unfreezing still
 * needs the recovery key (see POST /v1/wallets/:address/unfreeze).
 */
export const authenticatorRouter = Router({ mergeParams: true });

const fail = (status: number, message: string) => Object.assign(new Error(message), { status });
function send(res: Response, error: unknown) {
  const e = error as Error & { status?: number };
  res.status(e.status || 500).json({ error: e.status ? e.message : "Authenticator request failed" });
}
const fresh = (value: unknown): number => {
  const timestamp = Number(value);
  if (!Number.isSafeInteger(timestamp) || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) throw fail(400, "A fresh Shard A authorization is required");
  return timestamp;
};
const signature = (value: unknown): Hex => {
  if (typeof value !== "string" || !isHex(value) || value.length !== 132) throw fail(400, "A valid Shard A signature is required");
  return value;
};

type WalletRow = { address: string; shard_a_address: string; totp_secret_encrypted: string | null; totp_pending_encrypted: string | null; totp_enabled_at: Date | null; totp_last_step: string | null };
async function load(req: Request): Promise<WalletRow> {
  const address = String(req.params.address);
  if (!isAddress(address)) throw fail(400, "A valid smart account address is required");
  const result = await query<WalletRow>("SELECT address, shard_a_address, totp_secret_encrypted, totp_pending_encrypted, totp_enabled_at, totp_last_step FROM wallets WHERE address = $1", [address.toLowerCase()]);
  if (!result.rows.length) throw fail(404, "Wallet not found");
  return result.rows[0];
}
async function deviceSigned(wallet: WalletRow, message: string, sig: Hex) {
  if ((await recoverMessageAddress({ message, signature: sig })).toLowerCase() !== wallet.shard_a_address.toLowerCase()) throw fail(403, "Signature does not match this wallet's device key");
}
const enabled = (wallet: WalletRow) => !!wallet.totp_enabled_at && !!wallet.totp_secret_encrypted;

export const authenticatorMessage = (action: "status" | "setup" | "confirm" | "remove", wallet: string, timestamp: number, code = "") =>
  `Veilora authenticator ${action}\nwallet:${getAddress(wallet)}${code ? `\ncode:${code}` : ""}\ntimestamp:${timestamp}`;

/** Check a code against a secret, counting wrong codes and refusing a code that was already used. */
async function useCode(wallet: WalletRow, secretEncrypted: string, code: unknown): Promise<number> {
  if (isLockedOut(wallet.address)) throw fail(429, "Too many wrong codes. Try again in 15 minutes, or use your recovery key.");
  const step = typeof code === "string" ? verifyTotp(decryptSecret(secretEncrypted), code, null) : null;
  if (step == null) { recordFailedAttempt(wallet.address); throw fail(403, "That code is not valid. Use the current code from your authenticator app."); }
  // The conditional update makes each code single-use, even for two requests at once.
  const claimed = await query("UPDATE wallets SET totp_last_step = $2 WHERE address = $1 AND (totp_last_step IS NULL OR totp_last_step < $2) RETURNING address", [wallet.address, step]);
  if (!claimed.rows.length) { recordFailedAttempt(wallet.address); throw fail(403, "That code was already used. Wait for the next one."); }
  resetAttempts(wallet.address);
  return step;
}

authenticatorRouter.get("/", async (req, res) => {
  try {
    const wallet = await load(req);
    await deviceSigned(wallet, authenticatorMessage("status", wallet.address, fresh(req.header("x-veilora-timestamp"))), signature(req.header("x-veilora-signature")));
    res.json({ enabled: enabled(wallet), enabledAt: wallet.totp_enabled_at?.toISOString() ?? null });
  } catch (error) { send(res, error); }
});

authenticatorRouter.post("/setup", async (req, res) => {
  try {
    const wallet = await load(req);
    await deviceSigned(wallet, authenticatorMessage("setup", wallet.address, fresh(req.body?.timestamp)), signature(req.body?.shardASignature));
    if (enabled(wallet)) throw fail(409, "An authenticator is already set up. Remove it first to replace it.");
    const secret = generateTotpSecret();
    await query("UPDATE wallets SET totp_pending_encrypted = $2 WHERE address = $1", [wallet.address, encryptSecret(secret)]);
    res.json({ secret, uri: otpauthUri(secret, getAddress(wallet.address)) });
  } catch (error) { send(res, error); }
});

authenticatorRouter.post("/confirm", async (req, res) => {
  try {
    const wallet = await load(req);
    const code = String(req.body?.code ?? "");
    await deviceSigned(wallet, authenticatorMessage("confirm", wallet.address, fresh(req.body?.timestamp), code), signature(req.body?.shardASignature));
    if (!wallet.totp_pending_encrypted) throw fail(400, "Start the authenticator setup again.");
    await useCode(wallet, wallet.totp_pending_encrypted, code);
    await query("UPDATE wallets SET totp_secret_encrypted = totp_pending_encrypted, totp_pending_encrypted = NULL, totp_enabled_at = now() WHERE address = $1", [wallet.address]);
    await recordAlert(wallet.address, { type: "security", severity: "info", title: "Authenticator app added", body: "A code from it can now freeze your account from any device. Unfreezing still needs your recovery key.", ref: `security:authenticator:on:${Date.now()}` });
    res.json({ enabled: true });
  } catch (error) { send(res, error); }
});

authenticatorRouter.post("/remove", async (req, res) => {
  try {
    const wallet = await load(req);
    const code = String(req.body?.code ?? "");
    await deviceSigned(wallet, authenticatorMessage("remove", wallet.address, fresh(req.body?.timestamp), code), signature(req.body?.shardASignature));
    if (!enabled(wallet)) throw fail(400, "No authenticator is set up.");
    await useCode(wallet, wallet.totp_secret_encrypted!, code);
    await query("UPDATE wallets SET totp_secret_encrypted = NULL, totp_pending_encrypted = NULL, totp_enabled_at = NULL WHERE address = $1", [wallet.address]);
    await recordAlert(wallet.address, { type: "security", severity: "warn", title: "Authenticator app removed", body: "Codes from it can no longer freeze your account. If you didn't do this, freeze your account with your recovery key.", ref: `security:authenticator:off:${Date.now()}` });
    res.json({ enabled: false });
  } catch (error) { send(res, error); }
});

/** Public: freeze with a current code, no device needed. */
authenticatorRouter.post("/freeze", async (req, res) => {
  try {
    const wallet = await load(req);
    const hours = Number(req.body?.hours ?? 72);
    if (![24, 72, 168].includes(hours)) throw fail(400, "Choose 24, 72 or 168 hours");
    if (!enabled(wallet)) throw fail(400, "No authenticator app is set up for this account. Use the recovery key instead.");
    const current = await getFreezeState(wallet.address);
    if (current.initiatedBy === "recovery") throw fail(409, "A recovery-key freeze is already active. Only the recovery key can change it.");
    await useCode(wallet, wallet.totp_secret_encrypted!, req.body?.code);
    const state = await freezeWallet(wallet.address, hours, "Frozen with authenticator code", "device");
    await recordAlert(wallet.address, { type: "security", severity: "danger", title: "Account frozen with your authenticator code", body: `Veilora's co-signer won't sign anything for ${hours} hours. Unfreezing needs your recovery key. If you didn't do this, check Quorum & recovery now.`, ref: `security:freeze:totp:${Date.now()}`, data: { hours, initiatedBy: "authenticator" } });
    res.json(state);
  } catch (error) { send(res, error); }
});
