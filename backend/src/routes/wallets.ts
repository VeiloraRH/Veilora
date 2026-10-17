import { Router, type Request, type Response } from "express";
import { createHmac } from "node:crypto";
import { getAddress, isAddress, isHex, recoverMessageAddress } from "viem";
import { query } from "../db/index";
import {
  CHAIN_ID,
  LEGACY_FACTORY_ADDRESS,
  V2_FACTORY_ADDRESS,
  publicClient,
  relayerAccount,
  relayerClient,
} from "../config";
import { veiloraFactoryAbi, veiloraFactoryV2Abi, veiloraAccountAbi } from "../abi";
import {
  generateShardKey,
  encryptSecret,
  decryptSecret,
  generateApiKey,
  hashApiKey,
  computeExecutionDigest,
  computeExecutionDigestV2,
  signUserOpHash,
  concatSignatures,
} from "../crypto";
import { buildBlockscoutHistoryUrl, buildBlockscoutNftsUrl } from "../blockscout";
import { getFreezeState, freezeWallet, unfreezeWallet } from "../freeze";
import { enforceExecutionPolicy } from "../txPolicy";
import { recordAlert } from "../alerts/store";
import { safeFeeOverrides } from "../feePolicy";

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
        abi: veiloraFactoryV2Abi,
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

async function deployV2Account(
  address: `0x${string}`,
  shardA: `0x${string}`,
  shardB: `0x${string}`,
  shardC: `0x${string}`,
  salt: bigint,
): Promise<boolean> {
  if (!relayerClient || !relayerAccount) throw new Error("Account deployment is unavailable: the backend gas payer is not configured");
  const code = await publicClient.getCode({ address });
  if (code && code !== "0x") return true;
  const reservation = await query(
    `INSERT INTO relayer_deployment_budget (utc_day, deployment_count)
     VALUES ((now() AT TIME ZONE 'UTC')::date, 1)
     ON CONFLICT (utc_day) DO UPDATE
       SET deployment_count = relayer_deployment_budget.deployment_count + 1
       WHERE relayer_deployment_budget.deployment_count < $1
     RETURNING deployment_count`,
    [DAILY_SPONSORED_DEPLOYMENT_LIMIT],
  );
  if (!reservation.rows.length) throw new Error("Daily sponsored wallet deployment limit reached");
  const block = await publicClient.getBlock({ blockTag: "latest" });
  const estimate = await publicClient.estimateFeesPerGas().catch(async () => ({ gasPrice: await publicClient.getGasPrice() }));
  const { reservePrice: _reservePrice, ...feeFields } = safeFeeOverrides(block.baseFeePerGas, estimate);
  const hash = await relayerClient.writeContract({
    address: V2_FACTORY_ADDRESS,
    abi: veiloraFactoryV2Abi,
    functionName: "createAccount",
    args: [shardA, shardB, shardC, salt],
    ...feeFields,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`Account deployment transaction reverted (${hash})`);
  const deployedCode = await publicClient.getCode({ address });
  if (!deployedCode || deployedCode === "0x") throw new Error("Deployment succeeded but the account has no on-chain code");
  return true;
}

/**
 * POST /v1/wallets
 * Registers or computes a deterministic 2-of-3 threshold wallet.
 */
walletsRouter.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    if (!V2_FACTORY_ADDRESS) {
      res.status(503).json({ error: "Veilora V2 account creation is being prepared. Please try again shortly." });
      return;
    }
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
    const accountVersion = Number(req.body.accountVersion);
    if (accountVersion !== 2) {
      res.status(400).json({ error: "New accounts must use the current Veilora V2 account version" });
      return;
    }
    if (typeof requestId !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(requestId) ||
        !Number.isSafeInteger(timestamp) || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300 ||
        !shardASignature || !isHex(shardASignature) || shardASignature.length !== 132) {
      res.status(400).json({ error: "A fresh Shard A registration signature and request ID are required" });
      return;
    }
    const registrationMessage = `Veilora wallet registration\nversion:${accountVersion}\nshardA:${shardA}\nshardC:${shardC}\nsalt:${salt}\ndeploy:${req.body.deployOnCreate === true}\ntimestamp:${timestamp}\nrequest:${requestId}`;
    const registrationSigner = await recoverMessageAddress({ message: registrationMessage, signature: shardASignature });
    if (registrationSigner.toLowerCase() !== shardA.toLowerCase()) {
      res.status(403).json({ error: "Registration signature does not match Shard A" });
      return;
    }
    const duplicateRequest = await query<{
      address: string; factory_address: string; account_version: number; salt: string;
      shard_a_address: string; shard_b_address: string; shard_b_encrypted: string; shard_c_address: string;
    }>(
      "SELECT address,factory_address,account_version,salt,shard_a_address,shard_b_address,shard_b_encrypted,shard_c_address FROM wallets WHERE registration_request_id = $1",
      [requestId],
    );
    if (duplicateRequest.rows.length) {
      const existing = duplicateRequest.rows[0];
      if (existing.shard_a_address.toLowerCase() !== shardA.toLowerCase() ||
          existing.shard_c_address.toLowerCase() !== shardC.toLowerCase() ||
          existing.salt !== salt.toString() || Number(existing.account_version) !== 2) {
        res.status(409).json({ error: "This wallet registration request does not match its original account" });
        return;
      }
      const apiKey = generateApiKey();
      await query("UPDATE wallets SET api_key_hash=$2,updated_at=now() WHERE address=$1", [existing.address, hashApiKey(apiKey)]);
      let isDeployed = false;
      if (req.body.deployOnCreate === true) {
        isDeployed = await deployV2Account(getAddress(existing.address), shardA, getAddress(existing.shard_b_address), shardC, salt);
      } else {
        const code = await publicClient.getCode({ address: getAddress(existing.address) });
        isDeployed = Boolean(code && code !== "0x");
      }
      res.status(200).json({ address: getAddress(existing.address), chainId: CHAIN_ID, factoryAddress: getAddress(existing.factory_address), accountVersion: 2, shardA: getAddress(existing.shard_a_address), shardB: getAddress(existing.shard_b_address), shardC: getAddress(existing.shard_c_address), threshold: 2, salt: existing.salt, apiKey, isDeployed });
      return;
    }

    // Generate Shard B (Backend Co-Signer Shard)
    const shardB = generateShardKey();
    const encryptedShardB = encryptSecret(shardB.privateKey);

    // Do not register or deploy unless the factory returns the authoritative address.
    let counterfactualAddress: `0x${string}`;
    try {
      counterfactualAddress = await readCounterfactualAddress(
        V2_FACTORY_ADDRESS,
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

    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);

    await query(
      `INSERT INTO wallets (
        address, factory_address, account_version, salt, chain_id, shard_a_address, shard_b_address, shard_b_encrypted,
        shard_c_address, api_key_hash, threshold, totp_secret_encrypted, registration_request_id,
        initial_shard_a_address, initial_shard_c_address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 2, $11, $12, $6, $9)
      ON CONFLICT (address) DO UPDATE SET
        shard_a_address = EXCLUDED.shard_a_address,
        shard_b_address = EXCLUDED.shard_b_address,
        shard_b_encrypted = EXCLUDED.shard_b_encrypted,
        shard_c_address = EXCLUDED.shard_c_address,
        initial_shard_a_address = EXCLUDED.initial_shard_a_address,
        initial_shard_c_address = EXCLUDED.initial_shard_c_address,
        factory_address = EXCLUDED.factory_address,
        account_version = EXCLUDED.account_version,
        salt = EXCLUDED.salt,
        api_key_hash = EXCLUDED.api_key_hash,
        updated_at = now()`,
      [
        counterfactualAddress.toLowerCase(),
        V2_FACTORY_ADDRESS.toLowerCase(),
        accountVersion,
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

    let isDeployed = false;
    if (req.body.deployOnCreate === true) {
      try {
        isDeployed = await deployV2Account(counterfactualAddress, shardA, shardB.address, shardC, salt);
      } catch (error) {
        res.status(502).json({ error: error instanceof Error ? `Could not deploy the smart account: ${error.message}` : "Could not deploy the smart account" });
        return;
      }
    }

    res.status(201).json({
      address: counterfactualAddress,
      chainId: CHAIN_ID,
      factoryAddress: V2_FACTORY_ADDRESS,
      accountVersion,
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
    let syncedShardA = wallet.shard_a_address;
    let syncedShardC = wallet.shard_c_address;

    try {
      const code = await publicClient.getCode({ address: getAddress(address) });
      isDeployed = Boolean(code && code !== "0x");
      if (isDeployed) {
        const [nonce, chainShardA, chainShardB, chainShardC] = await Promise.all([
          publicClient.readContract({ address: getAddress(address), abi: veiloraAccountAbi, functionName: "nonce" }),
          publicClient.readContract({ address: getAddress(address), abi: veiloraAccountAbi, functionName: "shardA" }),
          publicClient.readContract({ address: getAddress(address), abi: veiloraAccountAbi, functionName: "shardB" }),
          publicClient.readContract({ address: getAddress(address), abi: veiloraAccountAbi, functionName: "shardC" }),
        ]);
        onChainNonce = nonce.toString();
        // Trust rotation state only if the backend-held shard still matches.
        // This keeps metadata aligned after a user rotates either personal key.
        if (chainShardB.toLowerCase() === String(wallet.shard_b_address).toLowerCase()) {
          syncedShardA = chainShardA;
          syncedShardC = chainShardC;
          if (syncedShardA.toLowerCase() !== String(wallet.shard_a_address).toLowerCase() || syncedShardC.toLowerCase() !== String(wallet.shard_c_address).toLowerCase()) {
            await query(
              `UPDATE wallets SET initial_shard_a_address=COALESCE(initial_shard_a_address,shard_a_address),
                 initial_shard_c_address=COALESCE(initial_shard_c_address,shard_c_address),
                 shard_a_address=$2,shard_c_address=$3,updated_at=now() WHERE address=$1`,
              [address, syncedShardA.toLowerCase(), syncedShardC.toLowerCase()],
            );
          }
        }
      }
    } catch {
      // Fallback
    }

    res.json({
      address: getAddress(wallet.address),
      chainId: wallet.chain_id,
      shardA: getAddress(syncedShardA),
      factoryAddress: getAddress(wallet.factory_address || LEGACY_FACTORY_ADDRESS),
      accountVersion: Number(wallet.account_version) === 2 ? 2 : 1,
      shardB: getAddress(wallet.shard_b_address),
      shardC: getAddress(syncedShardC),
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
      await recordAlert(address, { type: "security", severity: "warn", title: "Signing refused: account frozen", body: "Veilora's co-signer refused a transaction because your account is frozen. If that wasn't you trying to send, keep the freeze on.", ref: `security:refused-frozen:${Date.now()}` });

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
    const digest = Number(wallet.account_version) === 2
      ? computeExecutionDigestV2(getAddress(wallet.address), target, BigInt(value), data as `0x${string}`, nonce, deadline, BigInt(wallet.chain_id || CHAIN_ID))
      : computeExecutionDigest(target, BigInt(value), data as `0x${string}`, nonce, deadline, BigInt(wallet.chain_id || CHAIN_ID));
    const recoveredShardA = await recoverMessageAddress({ message: { raw: digest }, signature: shardASignature });
    if (recoveredShardA.toLowerCase() !== String(wallet.shard_a_address).toLowerCase()) {
      res.status(403).json({ error: "Execution signature does not match this wallet's Shard A" });
      return;
    }
    try {
      await enforceExecutionPolicy(getAddress(address), target, BigInt(value), data as `0x${string}`, digest, deadline);
    } catch (policyError) {
      await query(
        `INSERT INTO cosign_audit (wallet_address, user_op_hash, status, metadata)
         VALUES ($1, $2, 'REJECTED_POLICY', $3)`,
        [address, digest, JSON.stringify({ reason: policyError instanceof Error ? policyError.message : "Policy denied" })],
      );
      await recordAlert(address, { type: "security", severity: "warn", title: "Co-signer refused a transaction", body: (policyError instanceof Error ? policyError.message : "Transaction denied by co-signer policy").replace(/^Shard B policy denied:?\s*/, "Reason: "), ref: `security:refused:${digest}` });
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
    await recordAlert(address, { type: "security", severity: "danger", title: initiatedBy === "recovery" ? "Account frozen with your recovery key" : "Account frozen", body: `Veilora's co-signer won't sign anything for ${hours} hours${initiatedBy === "recovery" ? ", and only your recovery key can lift it" : ""}. If you didn't do this, check Quorum & recovery now.`, ref: `security:freeze:${timestamp}`, data: { hours, initiatedBy } });
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
    await recordAlert(address, { type: "security", severity: "warn", title: "Account unfrozen", body: `Your account was unfrozen with your ${signedBy === "recovery" ? "recovery key" : "device key"}. If you didn't do this, freeze it again with your recovery key.`, ref: `security:unfreeze:${timestamp}` });
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

/** Read-only NFT holdings from the configured Blockscout indexer. */
walletsRouter.get("/:address/nfts", async (req: Request, res: Response): Promise<void> => {
  try {
    const address = String(req.params.address);
    if (!isAddress(address)) { res.status(400).json({ error: "Invalid wallet address" }); return; }
    const url = buildBlockscoutNftsUrl(getAddress(address));
    if (req.query.cursor) {
      const serialized = String(req.query.cursor);
      if (serialized.length > 2048) { res.status(400).json({ error: "Invalid NFT cursor" }); return; }
      let cursor: unknown;
      try { cursor = JSON.parse(serialized); } catch { res.status(400).json({ error: "Invalid NFT cursor" }); return; }
      if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) { res.status(400).json({ error: "Invalid NFT cursor" }); return; }
      for (const [key, value] of Object.entries(cursor)) {
        if (!/^[a-z_]+$/.test(key) || ["apikey", "type"].includes(key) || !["string", "number", "boolean"].includes(typeof value)) {
          res.status(400).json({ error: "Invalid NFT cursor" }); return;
        }
        url.searchParams.set(key, String(value));
      }
    }
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("NFT provider unavailable");
    const result = await response.json() as { items?: unknown[]; next_page_params?: unknown };
    if (!Array.isArray(result.items)) throw new Error("Invalid NFT response");
    res.json({ items: result.items, next_page_params: result.next_page_params ?? null });
  } catch {
    res.status(502).json({ error: "Collectibles are temporarily unavailable. Please try again shortly." });
  }
});
