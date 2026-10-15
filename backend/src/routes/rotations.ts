import { Router, type Request, type Response } from "express";
import { encodeFunctionData, getAddress, isAddress, isHex, parseAbi, recoverMessageAddress, zeroAddress } from "viem";
import { CHAIN_ID, publicClient } from "../config";
import { veiloraAccountAbi } from "../abi";
import { computeExecutionDigest, computeExecutionDigestV2, concatSignatures, decryptSecret, signUserOpHash } from "../crypto";
import { query } from "../db/index";
import { getFreezeState } from "../freeze";
import { recordAlert } from "../alerts/store";

/**
 * Key rotation, mounted at /v1/wallets/:address/rotations.
 *
 * The account already accepts rotateShardA / rotateShardC from any two of its
 * three keys. Veilora's co-signer only signs a rotation that the owner
 * requested and that has waited out a delay, so a single stolen key cannot
 * quietly replace the other one:
 *
 * - kind "device": replace a lost device key (Shard A). Requested and
 *   finished with the recovery key (Shard C).
 * - kind "recovery": replace a lost recovery key (Shard C). Requested and
 *   finished with the device key (Shard A).
 *
 * Either personal key can cancel a pending rotation during the wait.
 */
export const rotationsRouter = Router({ mergeParams: true });

export type RotationKind = "device" | "recovery";
const WINDOW_SECONDS = 300;
const READY_WINDOW_DAYS = 7;
const rotationAbi = parseAbi(["function rotateShardA(address newShardA)", "function rotateShardC(address newShardC)"]);

export const rotationDelaySeconds = () => Math.max(0, Number(process.env.ROTATION_DELAY_SECONDS ?? 172_800));
export const rotationRequestMessage = (wallet: string, kind: RotationKind, newAddress: string, ts: number) =>
  `Veilora key rotation\naction:request\nwallet:${getAddress(wallet)}\nkind:${kind}\nnew:${getAddress(newAddress)}\ntimestamp:${ts}`;
export const rotationCancelMessage = (wallet: string, id: string, ts: number) =>
  `Veilora key rotation\naction:cancel\nwallet:${getAddress(wallet)}\nrotation:${id}\ntimestamp:${ts}`;
export const rotationCall = (kind: RotationKind, newAddress: string) =>
  encodeFunctionData({ abi: rotationAbi, functionName: kind === "device" ? "rotateShardA" : "rotateShardC", args: [getAddress(newAddress)] });

/** Overridable in tests. */
export const rotationChain = {
  isDeployed: async (address: `0x${string}`) => { const code = await publicClient.getCode({ address }); return Boolean(code && code !== "0x"); },
  shards: async (address: `0x${string}`) => {
    const [a, c] = await Promise.all([
      publicClient.readContract({ address, abi: veiloraAccountAbi, functionName: "shardA" }),
      publicClient.readContract({ address, abi: veiloraAccountAbi, functionName: "shardC" }),
    ]);
    return { shardA: String(a), shardC: String(c) };
  },
};

class HttpError extends Error { constructor(readonly status: number, message: string) { super(message); } }

type WalletRow = { address: string; shard_a_address: string; shard_b_address: string; shard_b_encrypted: string; shard_c_address: string; account_version: number; chain_id: number };
async function walletOf(req: Request): Promise<WalletRow> {
  const raw = String(req.params.address);
  if (!isAddress(raw)) throw new HttpError(400, "A valid smart account address is required");
  const rows = await query<WalletRow>("SELECT address, shard_a_address, shard_b_address, shard_b_encrypted, shard_c_address, account_version, chain_id FROM wallets WHERE address = $1", [raw.toLowerCase()]);
  if (!rows.rows.length) throw new HttpError(404, "Wallet not found");
  return rows.rows[0];
}
function fresh(timestamp: unknown) {
  const ts = Number(timestamp);
  if (!Number.isSafeInteger(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > WINDOW_SECONDS) throw new HttpError(400, "A fresh signature is required");
  return ts;
}
function sig(value: unknown): `0x${string}` {
  if (typeof value !== "string" || !isHex(value) || value.length !== 132) throw new HttpError(400, "A valid signature is required");
  return value;
}
/** Which personal key signed, if either. */
async function signerOf(wallet: WalletRow, message: string | { raw: `0x${string}` }, signature: `0x${string}`): Promise<"device" | "recovery" | null> {
  const s = (await recoverMessageAddress({ message, signature })).toLowerCase();
  if (s === wallet.shard_a_address.toLowerCase()) return "device";
  if (s === wallet.shard_c_address.toLowerCase()) return "recovery";
  return null;
}
const requiredSigner = (kind: RotationKind) => (kind === "device" ? "recovery" : "device");
const keyName = (kind: RotationKind) => (kind === "device" ? "device key" : "recovery key");
function fail(res: Response, error: unknown, fallback: string) {
  if (error instanceof HttpError) { res.status(error.status).json({ error: error.message }); return; }
  res.status(500).json({ error: error instanceof Error ? error.message : fallback });
}

function present(r: any) {
  const now = Date.now();
  const status = r.status === "pending" && new Date(r.expires_at).getTime() <= now ? "expired" : r.status;
  return {
    id: String(r.id), kind: r.kind as RotationKind, newAddress: getAddress(r.new_address), status,
    ready: status === "pending" && new Date(r.matures_at).getTime() <= now,
    maturesAt: r.matures_at, expiresAt: r.expires_at, cancelledBy: r.cancelled_by, txHash: r.tx_hash, createdAt: r.created_at, resolvedAt: r.resolved_at,
  };
}

async function expireStale(wallet: string) {
  await query("UPDATE wallet_key_rotations SET status = 'expired', resolved_at = now() WHERE wallet_address = $1 AND status = 'pending' AND expires_at <= now()", [wallet]);
}

/** GET / — rotations for this account. Public: rotations change the public key set. */
rotationsRouter.get("/", async (req, res) => {
  try {
    const wallet = await walletOf(req);
    await expireStale(wallet.address);
    const rows = await query("SELECT * FROM wallet_key_rotations WHERE wallet_address = $1 ORDER BY id DESC LIMIT 20", [wallet.address]);
    res.json({ delaySeconds: rotationDelaySeconds(), rotations: rows.rows.map(present) });
  } catch (error) { fail(res, error, "Failed to load key rotations"); }
});

/** POST / — request a rotation: { kind, newAddress, timestamp, signature }. */
rotationsRouter.post("/", async (req, res) => {
  try {
    const wallet = await walletOf(req);
    const kind = req.body?.kind as RotationKind;
    if (kind !== "device" && kind !== "recovery") throw new HttpError(400, "kind must be device or recovery");
    const newAddress = String(req.body?.newAddress ?? "");
    if (!isAddress(newAddress) || newAddress.toLowerCase() === zeroAddress) throw new HttpError(400, "A valid new key address is required");
    if ([wallet.shard_a_address, wallet.shard_b_address, wallet.shard_c_address].some((s) => s.toLowerCase() === newAddress.toLowerCase())) {
      throw new HttpError(400, "The new key must be different from all three current keys");
    }
    const ts = fresh(req.body?.timestamp);
    const signature = sig(req.body?.signature);
    const signer = await signerOf(wallet, rotationRequestMessage(wallet.address, kind, newAddress, ts), signature);
    if (signer !== requiredSigner(kind)) {
      throw new HttpError(403, kind === "device" ? "Replacing the device key must be requested with your recovery key" : "Replacing the recovery key must be requested with your device key");
    }
    if (!(await rotationChain.isDeployed(getAddress(wallet.address)))) throw new HttpError(409, "Your account must be deployed on Robinhood Chain before a key can be replaced. It deploys with its first transaction.");
    await expireStale(wallet.address);
    const delay = rotationDelaySeconds();
    const maturesAt = new Date(Date.now() + delay * 1000);
    const expiresAt = new Date(maturesAt.getTime() + READY_WINDOW_DAYS * 86_400_000);
    let created;
    try {
      created = await query(
        `INSERT INTO wallet_key_rotations (wallet_address, kind, new_address, request_signature, matures_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [wallet.address, kind, newAddress.toLowerCase(), signature.toLowerCase(), maturesAt, expiresAt],
      );
    } catch (error: any) {
      if (error?.code === "23505") throw new HttpError(409, `A ${keyName(kind)} replacement is already pending, or this request was already used`);
      throw error;
    }
    const hours = Math.round(delay / 3600);
    await recordAlert(wallet.address, {
      type: "security", severity: "danger",
      title: `${kind === "device" ? "Device key" : "Recovery key"} replacement requested`,
      body: `It can finish after ${hours} hours. If you didn't ask for this, cancel it in Quorum & recovery with your ${kind === "device" ? "device key or recovery key" : "recovery key or device key"}.`,
      ref: `rotation:request:${created.rows[0].id}`, data: { rotationId: String(created.rows[0].id), kind },
    });
    res.status(201).json(present(created.rows[0]));
  } catch (error) { fail(res, error, "Failed to request key rotation"); }
});

/** POST /:id/cancel — either personal key can cancel a pending rotation. */
rotationsRouter.post("/:id/cancel", async (req, res) => {
  try {
    const wallet = await walletOf(req);
    const id = String(req.params.id);
    if (!/^\d{1,18}$/.test(id)) throw new HttpError(400, "A rotation ID is required");
    const ts = fresh(req.body?.timestamp);
    const signer = await signerOf(wallet, rotationCancelMessage(wallet.address, id, ts), sig(req.body?.signature));
    if (!signer) throw new HttpError(403, "Cancelling needs your device key or recovery key");
    const updated = await query(
      "UPDATE wallet_key_rotations SET status = 'cancelled', cancelled_by = $3, resolved_at = now() WHERE id = $1 AND wallet_address = $2 AND status = 'pending' RETURNING *",
      [id, wallet.address, signer],
    );
    if (!updated.rows.length) throw new HttpError(409, "This rotation is no longer pending");
    await recordAlert(wallet.address, { type: "security", severity: "warn", title: "Key replacement cancelled", body: `A pending ${keyName(updated.rows[0].kind)} replacement was cancelled with your ${keyName(signer === "device" ? "device" : "recovery" as RotationKind)}.`, ref: `rotation:cancel:${id}` });
    res.json(present(updated.rows[0]));
  } catch (error) { fail(res, error, "Failed to cancel key rotation"); }
});

/**
 * POST /:id/cosign — { nonce, deadline, signature }. The signature is the
 * required personal key's signature over the exact rotation execution. Returns
 * the combined signatures for the relayer.
 */
rotationsRouter.post("/:id/cosign", async (req, res) => {
  try {
    const wallet = await walletOf(req);
    const id = String(req.params.id);
    if (!/^\d{1,18}$/.test(id)) throw new HttpError(400, "A rotation ID is required");
    await expireStale(wallet.address);
    const rows = await query("SELECT * FROM wallet_key_rotations WHERE id = $1 AND wallet_address = $2", [id, wallet.address]);
    const rotation = rows.rows[0];
    if (!rotation || rotation.status !== "pending") throw new HttpError(409, "This rotation is not pending");
    if (new Date(rotation.matures_at).getTime() > Date.now()) throw new HttpError(425, `This rotation can finish after ${new Date(rotation.matures_at).toISOString()}`);
    const kind = rotation.kind as RotationKind;

    const { nonce: rawNonce, deadline: rawDeadline } = req.body ?? {};
    if (!/^(0|[1-9]\d*)$/.test(String(rawNonce)) || !/^(0|[1-9]\d*)$/.test(String(rawDeadline))) throw new HttpError(400, "A nonce and deadline are required");
    const nonce = BigInt(rawNonce);
    const deadline = BigInt(rawDeadline);
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (deadline <= now || deadline > now + 300n) throw new HttpError(400, "Execution deadline must be within the next five minutes");

    const target = getAddress(wallet.address);
    const data = rotationCall(kind, rotation.new_address);
    const digest = Number(wallet.account_version) === 2
      ? computeExecutionDigestV2(target, target, 0n, data, nonce, deadline, BigInt(wallet.chain_id || CHAIN_ID))
      : computeExecutionDigest(target, 0n, data, nonce, deadline, BigInt(wallet.chain_id || CHAIN_ID));
    const userSignature = sig(req.body?.signature);
    const signer = await signerOf(wallet, { raw: digest }, userSignature);
    if (signer !== requiredSigner(kind)) throw new HttpError(403, `Finish this rotation with your ${kind === "device" ? "recovery key" : "device key"}`);

    // Lost-device path: after freezing with the recovery key, the recovery key
    // can still replace the device key. A freeze set with the device key (the
    // owner suspects the recovery key) blocks every rotation.
    const freeze = await getFreezeState(wallet.address);
    const allowWhileFrozen = kind === "device" && freeze.initiatedBy === "recovery";
    if (freeze.frozen && !allowWhileFrozen) {
      throw new HttpError(403, freeze.initiatedBy === "device"
        ? "Your account was frozen with your device key, which blocks key replacement. Lift the freeze with your device key first."
        : "Wallet is frozen. Lift the freeze before replacing the recovery key.");
    }

    const shardBKey = decryptSecret(wallet.shard_b_encrypted) as `0x${string}`;
    const { signature: shardBSignature, signer: shardB } = await signUserOpHash(shardBKey, digest);
    await query(
      `INSERT INTO cosign_audit (wallet_address, user_op_hash, status, shard_b_signature, metadata) VALUES ($1, $2, 'APPROVED', $3, $4)`,
      [wallet.address, digest, shardBSignature, JSON.stringify({ signer: shardB, target, nonce: nonce.toString(), rotationId: id, kind, signerShard: kind === "device" ? "C" : "A", allowWhileFrozen, timestamp: new Date().toISOString() })],
    );
    res.json({ target, value: "0", data, nonce: nonce.toString(), deadline: deadline.toString(), digest, combinedSignatures: concatSignatures(userSignature, shardBSignature) });
  } catch (error) { fail(res, error, "Failed to co-sign key rotation"); }
});

/** POST /:id/complete — { txHash }. Confirms on-chain that the new key is live and records it. */
rotationsRouter.post("/:id/complete", async (req, res) => {
  try {
    const wallet = await walletOf(req);
    const id = String(req.params.id);
    if (!/^\d{1,18}$/.test(id)) throw new HttpError(400, "A rotation ID is required");
    const txHash = typeof req.body?.txHash === "string" && /^0x[0-9a-fA-F]{64}$/.test(req.body.txHash) ? req.body.txHash.toLowerCase() : null;
    const rows = await query("SELECT * FROM wallet_key_rotations WHERE id = $1 AND wallet_address = $2", [id, wallet.address]);
    const rotation = rows.rows[0];
    if (!rotation) throw new HttpError(404, "Rotation not found");
    if (rotation.status === "completed") { res.json(present(rotation)); return; }
    if (rotation.status !== "pending") throw new HttpError(409, "This rotation is not pending");
    const shards = await rotationChain.shards(getAddress(wallet.address));
    const live = rotation.kind === "device" ? shards.shardA : shards.shardC;
    if (live.toLowerCase() !== rotation.new_address.toLowerCase()) throw new HttpError(409, "The new key is not active on-chain yet. Submit the rotation transaction first.");
    const column = rotation.kind === "device" ? "shard_a_address" : "shard_c_address";
    await query(
      `UPDATE wallets SET initial_shard_a_address = COALESCE(initial_shard_a_address, shard_a_address),
         initial_shard_c_address = COALESCE(initial_shard_c_address, shard_c_address),
         ${column} = $2, updated_at = now() WHERE address = $1`,
      [wallet.address, rotation.new_address.toLowerCase()],
    );
    const done = await query("UPDATE wallet_key_rotations SET status = 'completed', tx_hash = $2, resolved_at = now() WHERE id = $1 RETURNING *", [id, txHash]);
    await recordAlert(wallet.address, {
      type: "security", severity: "danger", title: `${rotation.kind === "device" ? "Device key" : "Recovery key"} replaced`,
      body: `Your account now uses a new ${keyName(rotation.kind)}. The old one can no longer sign. If you didn't do this, freeze your account right away.`,
      ref: `rotation:complete:${id}`, data: { rotationId: id, txHash },
    });
    res.json(present(done.rows[0]));
  } catch (error) { fail(res, error, "Failed to complete key rotation"); }
});
