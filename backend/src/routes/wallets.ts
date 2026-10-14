import { Router, type Request, type Response } from "express";
import { createHmac } from "node:crypto";
import { getAddress, isAddress, isHex, recoverMessageAddress } from "viem";
import { query } from "../db/index";
import {
  CHAIN_ID,
  FACTORY_ADDRESS,
  publicClient,
  relayerAccount,
  relayerClient,
} from "../config";
import { veiloraFactoryAbi, veiloraAccountAbi } from "../abi";
import {
  generateShardKey,
  encryptSecret,
  decryptSecret,
  generateApiKey,
  hashApiKey,
  computeExecutionDigest,
  signUserOpHash,
  concatSignatures,
} from "../crypto";
import { buildBlockscoutHistoryUrl } from "../blockscout";
import { getFreezeState, freezeWallet, unfreezeWallet } from "../freeze";
import { enforceExecutionPolicy } from "../txPolicy";

export const walletsRouter = Router();

/** Which user-held shard signed a security action, if either. */
function securitySigner(signer: string, row: { shard_a_address: string; shard_c_address: string }): "device" | "recovery" | null {
  const s = signer.toLowerCase();
  if (s === String(row.shard_a_address).toLowerCase()) return "device";
  if (s === String(row.shard_c_address).toLowerCase()) return "recovery";
  return null;
}

const ADDRESS_LOOKUP_ATTEMPTS = 3;
const ADDRESS_LOOKUP_DELAYS_MS = [250, 750];
const DAILY_SPONSORED_DEPLOYMENT_LIMIT = Math.max(1, Number(process.env.RELAYER_DAILY_DEPLOYMENT_LIMIT) || 10);
const REGISTRATION_LIMIT_PER_IP = 100;

function hashRegistrationIp(ip: string): string {
  const key = process.env.SHARD_B_ENCRYPTION_KEY || process.env.CO_SIGNER_SHARD_B_SECRET;
  if (!key || Buffer.byteLength(key, "utf8") < 32) {
    throw new Error("Registration rate limiting requires the configured backend encryption secret");
  }
  const derivedKey = createHmac("sha256", key).update("veilora:registration-rate-limit:v1").digest();
  return createHmac("sha256", derivedKey).update(ip).digest("hex");
}

async function consumeRegistrationAttempt(ip: string): Promise<boolean> {
  const ipHash = hashRegistrationIp(ip);
  const result = await query(
    `INSERT INTO wallet_registration_rate_limits (ip_hash, window_started_at, request_count)
     VALUES ($1, now(), 1)
     ON CONFLICT (ip_hash) DO UPDATE SET
       window_started_at = CASE
         WHEN wallet_registration_rate_limits.window_started_at <= now() - interval '1 hour' THEN now()
         ELSE wallet_registration_rate_limits.window_started_at
       END,
       request_count = CASE
         WHEN wallet_registration_rate_limits.window_started_at <= now() - interval '1 hour' THEN 1
         ELSE wallet_registration_rate_limits.request_count + 1
       END,
       updated_at = now()
     WHERE wallet_registration_rate_limits.window_started_at <= now() - interval '1 hour'
        OR wallet_registration_rate_limits.request_count < $2
     RETURNING request_count`,
    [ipHash, REGISTRATION_LIMIT_PER_IP],
  );
  // Opportunistically remove expired hashes so the table does not grow forever.
  await query("DELETE FROM wallet_registration_rate_limits WHERE window_started_at < now() - interval '2 hours'");
  return result.rows.length > 0;
}

async function readCounterfactualAddress(
  factoryAddress: `0x${string}`,
  shardA: `0x${string}`,
  shardB: `0x${string}`,
  shardC: `0x${string}`,
  salt: bigint,
): Promise<`0x${string}`> {
  let lastError: unknown;
  for (let attempt = 0; attempt < ADDRESS_LOOKUP_ATTEMPTS; attempt += 1) {
    try {
      return await publicClient.readContract({
        address: factoryAddress,
        abi: veiloraFactoryAbi,
        functionName: "getAddress",
        args: [shardA, shardB, shardC, salt],
      });
    } catch (error) {
      lastError = error;
      if (attempt < ADDRESS_LOOKUP_ATTEMPTS - 1) {
        await new Promise((resolve) => setTimeout(resolve, ADDRESS_LOOKUP_DELAYS_MS[attempt]));
      }
    }
  }

  throw new Error(
    `Could not retrieve the smart account address from Robinhood Chain after ${ADDRESS_LOOKUP_ATTEMPTS} attempts: ${lastError instanceof Error ? lastError.message : "RPC request failed"}`,
  );
}

/**
 * POST /v1/wallets
 * Registers or computes a deterministic 2-of-3 threshold wallet.
 */
walletsRouter.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    if (!await consumeRegistrationAttempt(req.ip || req.socket.remoteAddress || "unknown")) {
      res.status(429).json({ error: "Wallet registration rate limit reached; try again later" });
      return;
    }
    let shardA = req.body.shardAAddress as `0x${string}` | undefined;
    let shardC = req.body.shardCAddress as `0x${string}` | undefined;
    if (!shardA || !isAddress(shardA) || !shardC || !isAddress(shardC)) {
      res.status(400).json({ error: "Client-generated Shard A and Shard C public addresses are required" });
      return;
    }
    const salt = BigInt(req.body.salt || 0);
    shardA = getAddress(shardA);
    shardC = getAddress(shardC);
    const { requestId, timestamp, shardASignature } = req.body;
    if (typeof requestId !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(requestId) ||
        !Number.isSafeInteger(timestamp) || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300 ||
        !shardASignature || !isHex(shardASignature) || shardASignature.length !== 132) {
      res.status(400).json({ error: "A fresh Shard A registration signature and request ID are required" });
      return;
    }
    const registrationMessage = `Veilora wallet registration\nshardA:${shardA}\nshardC:${shardC}\nsalt:${salt}\ndeploy:${req.body.deployOnCreate === true}\ntimestamp:${timestamp}\nrequest:${requestId}`;
    const registrationSigner = await recoverMessageAddress({ message: registrationMessage, signature: shardASignature });
    if (registrationSigner.toLowerCase() !== shardA.toLowerCase()) {
      res.status(403).json({ error: "Registration signature does not match Shard A" });
      return;
    }
    const duplicateRequest = await query(
      "SELECT address FROM wallets WHERE registration_request_id = $1",
      [requestId],
    );
    if (duplicateRequest.rows.length) {
      res.status(409).json({ error: "This wallet registration request has already been used" });
      return;
    }

    // Generate Shard B (Backend Co-Signer Shard)
    const shardB = generateShardKey();
    const encryptedShardB = encryptSecret(shardB.privateKey);

    // Do not register or deploy unless the factory returns the authoritative address.
    let counterfactualAddress: `0x${string}`;
    try {
      counterfactualAddress = await readCounterfactualAddress(
        FACTORY_ADDRESS,
        shardA,
        shardB.address,
        shardC,
        salt,
      );
    } catch (error) {
      res.status(503).json({
        error: error instanceof Error ? error.message : "Could not retrieve the smart account address from Robinhood Chain",
      });
      return;
    }

    let isDeployed = false;
    if (req.body.deployOnCreate === true) {
      if (!relayerClient || !relayerAccount) {
        res.status(503).json({ error: "Account deployment is unavailable: the backend gas payer is not configured" });
        return;
      }

      const reservation = await query(
        `INSERT INTO relayer_deployment_budget (utc_day, deployment_count)
         VALUES ((now() AT TIME ZONE 'UTC')::date, 1)
         ON CONFLICT (utc_day) DO UPDATE
           SET deployment_count = relayer_deployment_budget.deployment_count + 1
           WHERE relayer_deployment_budget.deployment_count < $1
         RETURNING deployment_count`,
        [DAILY_SPONSORED_DEPLOYMENT_LIMIT],
      );
      if (!reservation.rows.length) {
        res.status(429).json({ error: "Daily sponsored wallet deployment limit reached" });
        return;
      }

      try {
        const code = await publicClient.getCode({ address: counterfactualAddress });
        isDeployed = Boolean(code && code !== "0x");
        if (!isDeployed) {
          const deployHash = await relayerClient.writeContract({
            address: FACTORY_ADDRESS,
            abi: veiloraFactoryAbi,
            functionName: "createAccount",
            args: [shardA, shardB.address, shardC, salt],
          });
          const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
          if (receipt.status !== "success") {
            throw new Error(`Account deployment transaction reverted (${deployHash})`);
          }
          const deployedCode = await publicClient.getCode({ address: counterfactualAddress });
          isDeployed = Boolean(deployedCode && deployedCode !== "0x");
          if (!isDeployed) throw new Error("Deployment transaction succeeded but the account has no on-chain code");
        }
      } catch (error) {
        res.status(502).json({
          error: error instanceof Error ? `Could not deploy the smart account: ${error.message}` : "Could not deploy the smart account",
        });
        return;
      }
    }

    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);

    await query(
      `INSERT INTO wallets (
        address, factory_address, salt, chain_id, shard_a_address, shard_b_address, shard_b_encrypted,
        shard_c_address, api_key_hash, threshold, totp_secret_encrypted, registration_request_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 2, $11, $12)
      ON CONFLICT (address) DO UPDATE SET
        shard_a_address = EXCLUDED.shard_a_address,
        shard_b_address = EXCLUDED.shard_b_address,
        shard_b_encrypted = EXCLUDED.shard_b_encrypted,
        shard_c_address = EXCLUDED.shard_c_address,
        factory_address = EXCLUDED.factory_address,
        salt = EXCLUDED.salt,
        api_key_hash = EXCLUDED.api_key_hash,
        updated_at = now()`,
      [
        counterfactualAddress.toLowerCase(),
        FACTORY_ADDRESS.toLowerCase(),
        salt.toString(),
        CHAIN_ID,
        shardA.toLowerCase(),
        shardB.address.toLowerCase(),
        encryptedShardB,
        shardC.toLowerCase(),
        apiKeyHash,
        req.body.totpSecret ? encryptSecret(req.body.totpSecret) : null,
        requestId,
      ]
    );

    res.status(201).json({
      address: counterfactualAddress,
      chainId: CHAIN_ID,
      factoryAddress: FACTORY_ADDRESS,
      shardA,
      shardB: shardB.address,
      shardC,
      threshold: 2,
      salt: salt.toString(),
      apiKey,
      isDeployed,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to create threshold wallet" });
  }
});

/**
 * DELETE /v1/wallets/:address
 * Permanently removes Veilora-held data for a wallet after proof of Shard A ownership.
 */
walletsRouter.delete("/:address", async (req: Request, res: Response): Promise<void> => {
  try {
    const rawAddress = String(req.params.address);
    if (!isAddress(rawAddress)) {
      res.status(400).json({ error: "A valid smart account address is required" });
      return;
    }
    const address = getAddress(rawAddress);
    const signature = req.body.shardASignature as `0x${string}` | undefined;
    const timestamp = Number(req.body.timestamp);
    if (!signature || !isHex(signature) || signature.length !== 132) {
      res.status(400).json({ error: "A valid Shard A deletion signature is required" });
      return;
    }
    if (!Number.isSafeInteger(timestamp) || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) {
      res.status(400).json({ error: "A fresh deletion authorization is required" });
      return;
    }

    const rows = await query(
      "SELECT address, shard_a_address FROM wallets WHERE address = $1",
      [address.toLowerCase()],
    );
    if (!rows.rows.length) {
      res.status(404).json({ error: "Wallet not found" });
      return;
    }

    const deletionMessage = `Veilora account data deletion request\nwallet:${address}\ntimestamp:${timestamp}`;
    const signer = await recoverMessageAddress({ message: deletionMessage, signature });
    if (signer.toLowerCase() !== String(rows.rows[0].shard_a_address).toLowerCase()) {
      res.status(403).json({ error: "Deletion signature does not match this wallet's Shard A" });
      return;
    }

    const used = await query(
      "INSERT INTO wallet_rule_authorizations (signature, wallet_address) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING signature",
      [signature.toLowerCase(), address.toLowerCase()],
    );
    if (!used.rows.length) { res.status(409).json({ error: "This deletion authorization has already been used" }); return; }

    await query("DELETE FROM wallets WHERE address = $1", [address.toLowerCase()]);
    // Wallet audit records are linked with ON DELETE CASCADE.
    res.json({ deleted: true, walletAddress: address });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete wallet data" });
  }
});

/**
 * GET /v1/wallets/:address
 * Returns public metadata, shard configuration, and freeze state.
 */
walletsRouter.get("/:address", async (req: Request, res: Response): Promise<void> => {
  try {
    const address = String(req.params.address).toLowerCase();
    const rows = await query(`SELECT * FROM wallets WHERE address = $1`, [address]);

    if (rows.rows.length === 0) {
      res.status(404).json({ error: "Wallet not found" });
      return;
    }

    const wallet = rows.rows[0];
    const freezeState = await getFreezeState(address);

    let isDeployed = false;
    let onChainNonce = "0";

    try {
      const code = await publicClient.getCode({ address: getAddress(address) });
      isDeployed = Boolean(code && code !== "0x");
      if (isDeployed) {
        const nonce = await publicClient.readContract({
          address: getAddress(address),
          abi: veiloraAccountAbi,
          functionName: "nonce",
        });
        onChainNonce = nonce.toString();
      }
    } catch {
      // Fallback
    }

    res.json({
      address: getAddress(wallet.address),
      chainId: wallet.chain_id,
      shardA: getAddress(wallet.shard_a_address),
      factoryAddress: getAddress(wallet.factory_address || FACTORY_ADDRESS),
      shardB: getAddress(wallet.shard_b_address),
      shardC: getAddress(wallet.shard_c_address),
      threshold: wallet.threshold,
      isFrozen: freezeState.frozen,
      frozenUntil: freezeState.frozenUntil,
      // Freeze reasons can include private user context; expose them only on the signed quorum endpoint.
      freezeReason: null,
      freezeInitiatedBy: freezeState.initiatedBy,
      isDeployed,
      nonce: onChainNonce,
      createdAt: wallet.created_at,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch wallet" });
  }
});

/**
 * POST /v1/wallets/:address/cosign
 * Evaluates execution policies and generates Shard B ECDSA signature.
 */
walletsRouter.post("/:address/cosign", async (req: Request, res: Response): Promise<void> => {
  const address = String(req.params.address).toLowerCase();

  try {
    const rows = await query(`SELECT * FROM wallets WHERE address = $1`, [address]);
    if (rows.rows.length === 0) {
      res.status(404).json({ error: "Wallet not found" });
      return;
    }

    const wallet = rows.rows[0];
    const freezeState = await getFreezeState(address);

    // 1. Panic Freeze check: Co-signer strictly refuses to sign if frozen
    if (freezeState.frozen) {
      await query(
        `INSERT INTO cosign_audit (wallet_address, user_op_hash, status, metadata)
         VALUES ($1, $2, 'REJECTED_FROZEN', $3)`,
        [
          address,
          req.body.digest || req.body.userOpHash || "0x0000000000000000000000000000000000000000000000000000000000000000",
          JSON.stringify({ reason: freezeState.reason, frozenUntil: freezeState.frozenUntil }),
        ]
      );

      res.status(403).json({
        error: "Wallet is currently frozen",
        reason: freezeState.reason,
        frozenUntil: freezeState.frozenUntil,
      });
      return;
    }

    // Only sign a complete, owner-authorized execution. Arbitrary caller-supplied
    // digests and ERC-4337 hashes are intentionally not accepted.
    const { target: rawTarget, value = "0", data = "0x", nonce: rawNonce, deadline: rawDeadline, shardASignature } = req.body;
    if (!isAddress(rawTarget || "") || rawNonce === undefined || rawDeadline === undefined ||
        !/^(0|[1-9]\d*)$/.test(String(value)) || !/^(0|[1-9]\d*)$/.test(String(rawNonce)) ||
        !/^(0|[1-9]\d*)$/.test(String(rawDeadline)) || !isHex(data)) {
      res.status(400).json({ error: "Valid target, value, calldata, nonce and deadline are required" });
      return;
    }
    if (!shardASignature || !isHex(shardASignature) || shardASignature.length !== 132) {
      res.status(400).json({ error: "A valid Shard A execution signature is required" });
      return;
    }
    const target = getAddress(rawTarget);
    const nonce = BigInt(rawNonce);
    const deadline = BigInt(rawDeadline);
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (deadline <= now || deadline > now + 300n) {
      res.status(400).json({ error: "Execution deadline must be within the next five minutes" });
      return;
    }
    // The deployed account enforces the authoritative nonce during execution.
    // This endpoint has no caller-supplied digest path; Shard A must authorize
    // this exact payload, and the short deadline bounds stale approvals.
    const digest = computeExecutionDigest(
      target,
      BigInt(value),
      data as `0x${string}`,
      nonce,
      deadline,
      BigInt(wallet.chain_id || CHAIN_ID),
    );
    const recoveredShardA = await recoverMessageAddress({ message: { raw: digest }, signature: shardASignature });
    if (recoveredShardA.toLowerCase() !== String(wallet.shard_a_address).toLowerCase()) {
      res.status(403).json({ error: "Execution signature does not match this wallet's Shard A" });
      return;
    }
    try {
      await enforceExecutionPolicy(getAddress(address), target, BigInt(value), data as `0x${string}`);
    } catch (policyError) {
      await query(
        `INSERT INTO cosign_audit (wallet_address, user_op_hash, status, metadata)
         VALUES ($1, $2, 'REJECTED_POLICY', $3)`,
        [address, digest, JSON.stringify({ reason: policyError instanceof Error ? policyError.message : "Policy denied" })],
      );
      res.status(403).json({ error: policyError instanceof Error ? policyError.message : "Transaction denied by co-signer policy" });
      return;
    }

    // 3. Decrypt Shard B private key & sign RFC 6979
    const shardBPrivateKey = decryptSecret(wallet.shard_b_encrypted) as `0x${string}`;
    const { signature: shardBSignature, signer } = await signUserOpHash(shardBPrivateKey, digest);

    // 4. Optionally combine with client Shard A signature if supplied
    let combinedSignatures: `0x${string}` | undefined = undefined;
    combinedSignatures = concatSignatures(shardASignature as `0x${string}`, shardBSignature);

    // 5. Immutable Co-Sign Audit Trail
    await query(
      `INSERT INTO cosign_audit (wallet_address, user_op_hash, status, shard_b_signature, metadata)
       VALUES ($1, $2, 'APPROVED', $3, $4)`,
      [
        address,
        digest,
        shardBSignature,
        JSON.stringify({
          signer,
          target,
          nonce: nonce.toString(),
          timestamp: new Date().toISOString(),
        }),
      ]
    );

    res.json({
      status: "APPROVED",
      walletAddress: getAddress(wallet.address),
      digest,
      shardBSignature,
      shardBAddress: getAddress(wallet.shard_b_address),
      combinedSignatures,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to co-sign transaction" });
  }
});

/**
 * POST /v1/wallets/:address/freeze
 * Instant Panic Freeze trigger.
 */
walletsRouter.post("/:address/freeze", async (req: Request, res: Response): Promise<void> => {
  try {
    const address = String(req.params.address).toLowerCase();
    const hours = Number(req.body.hours);
    const reason = String(req.body.reason || "Emergency user freeze");
    const timestamp = Number(req.body.timestamp);
    const signature = req.body.shardASignature as `0x${string}` | undefined;
    if (!Number.isInteger(hours) || hours < 1 || hours > 168 || reason.length > 128 || /[\r\n]/.test(reason) ||
        !Number.isSafeInteger(timestamp) || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300 ||
        !signature || !isHex(signature) || signature.length !== 132 || !isAddress(address)) {
      res.status(400).json({ error: "A fresh, valid Shard A freeze authorization is required" });
      return;
    }
    const rows = await query("SELECT shard_a_address, shard_c_address FROM wallets WHERE address = $1", [address]);
    if (!rows.rows.length) { res.status(404).json({ error: "Wallet not found" }); return; }
    const message = `Veilora account security action\nwallet:${getAddress(address)}\naction:freeze\nhours:${hours}\nreason:${reason}\ntimestamp:${timestamp}`;
    const initiatedBy = securitySigner(await recoverMessageAddress({ message, signature }), rows.rows[0]);
    if (!initiatedBy) {
      res.status(403).json({ error: "Freeze authorization must come from this wallet's device key (Shard A) or recovery key (Shard C)" });
      return;
    }
    const current = await getFreezeState(address);
    if (current.initiatedBy === "recovery" && initiatedBy !== "recovery") {
      res.status(409).json({ error: "A recovery-key freeze is active. Only the recovery key can change it." });
      return;
    }

    const state = await freezeWallet(address, hours, reason, initiatedBy);
    res.json(state);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to freeze wallet" });
  }
});

/**
 * POST /v1/wallets/:address/unfreeze
 * Unfreezes wallet.
 */
walletsRouter.post("/:address/unfreeze", async (req: Request, res: Response): Promise<void> => {
  try {
    const address = String(req.params.address).toLowerCase();
    const timestamp = Number(req.body.timestamp);
    const signature = req.body.shardASignature as `0x${string}` | undefined;
    if (!Number.isSafeInteger(timestamp) || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300 ||
        !signature || !isHex(signature) || signature.length !== 132 || !isAddress(address)) {
      res.status(400).json({ error: "A fresh, valid Shard A unfreeze authorization is required" });
      return;
    }
    const rows = await query("SELECT shard_a_address, shard_c_address FROM wallets WHERE address = $1", [address]);
    if (!rows.rows.length) { res.status(404).json({ error: "Wallet not found" }); return; }
    const message = `Veilora account security action\nwallet:${getAddress(address)}\naction:unfreeze\nhours:0\nreason:\ntimestamp:${timestamp}`;
    const signedBy = securitySigner(await recoverMessageAddress({ message, signature }), rows.rows[0]);
    if (signedBy !== "recovery") {
      res.status(403).json({ error: "Unfreezing requires your recovery key (Shard C), so a stolen device key cannot lift a freeze" });
      return;
    }
    const state = await unfreezeWallet(address);
    res.json(state);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to unfreeze wallet" });
  }
});

/**
 * GET /v1/wallets/:address/audit
 * Query immutable co-signing audit log.
 */
walletsRouter.get("/:address/audit", async (req: Request, res: Response): Promise<void> => {
  try {
    const address = String(req.params.address).toLowerCase();
    if (!isAddress(address)) { res.status(400).json({ error: "A valid smart account address is required" }); return; }
    const timestamp = Number(req.header("x-veilora-timestamp"));
    const signature = req.header("x-veilora-signature");
    if (!Number.isSafeInteger(timestamp) || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300 || !signature || !isHex(signature) || signature.length !== 132) {
      res.status(401).json({ error: "A fresh Shard A signature is required to view this audit log" }); return;
    }
    const owner = await query<{ shard_a_address: string }>("SELECT shard_a_address FROM wallets WHERE address = $1", [address]);
    if (!owner.rows.length) { res.status(404).json({ error: "Wallet not found" }); return; }
    const message = `Veilora wallet audit access\nwallet:${getAddress(address)}\ntimestamp:${timestamp}`;
    const signer = await recoverMessageAddress({ message, signature: signature as `0x${string}` });
    if (signer.toLowerCase() !== owner.rows[0].shard_a_address.toLowerCase()) { res.status(403).json({ error: "Signature does not match this wallet's Shard A" }); return; }
    const result = await query(
      `SELECT id, user_op_hash, status, shard_b_signature, metadata, created_at
       FROM cosign_audit
       WHERE wallet_address = $1
       ORDER BY id DESC LIMIT 50`,
      [address]
    );

    res.json({
      walletAddress: getAddress(address),
      records: result.rows,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch audit log" });
  }
});

/** Paginated, complete on-chain history from the configured chain indexer. */
walletsRouter.get("/:address/transactions", async (req: Request, res: Response): Promise<void> => {
  try {
    const address = String(req.params.address);
    const kind = String(req.query.kind || "transactions");
    if (!isAddress(address) || !["transactions", "token-transfers", "internal-transactions"].includes(kind)) {
      res.status(400).json({ error: "Invalid wallet or history type" }); return;
    }
    const url = buildBlockscoutHistoryUrl(getAddress(address), kind as "transactions" | "token-transfers" | "internal-transactions");
    if (req.query.cursor) {
      let cursor: unknown;
      try { cursor = JSON.parse(String(req.query.cursor)); } catch { res.status(400).json({error:"Invalid history cursor"}); return; }
      if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) {res.status(400).json({error:"Invalid history cursor"}); return;}
      for (const [key, value] of Object.entries(cursor)) {
        if (!/^[a-z_]+$/.test(key) || ["apikey", "type"].includes(key) || !["string", "number", "boolean"].includes(typeof value)) {res.status(400).json({error:"Invalid history cursor"}); return;}
        url.searchParams.set(key, String(value));
      }
    }
    const response = await fetch(url, {headers:{Accept:"application/json"},signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error("History provider unavailable");
    const result = await response.json() as {items?: unknown[];next_page_params?: unknown};
    if (!Array.isArray(result.items)) throw new Error("Invalid history response");
    res.json({items:result.items,next_page_params:result.next_page_params ?? null});
  } catch {
    res.status(502).json({error:"The chain explorer is temporarily unavailable. Your transactions are still on-chain. Please retry shortly."});
  }
});
