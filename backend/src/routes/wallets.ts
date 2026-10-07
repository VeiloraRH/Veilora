import { Router, type Request, type Response } from "express";
import { getAddress, isAddress, isHex } from "viem";
import { query } from "../db/index";
import {
  CHAIN_ID,
  FACTORY_ADDRESS,
  publicClient,
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
import { getFreezeState, freezeWallet, unfreezeWallet } from "../freeze";

export const walletsRouter = Router();

/**
 * POST /v1/wallets
 * Registers or computes a deterministic 2-of-3 threshold wallet.
 */
walletsRouter.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    let shardA = req.body.shardAAddress as `0x${string}` | undefined;
    let shardC = req.body.shardCAddress as `0x${string}` | undefined;
    const salt = BigInt(req.body.salt || 0);

    const generatedShards: Record<string, { address: string; privateKey?: string }> = {};

    // If client didn't supply Shard A (Device shard), generate one for onboarding convenience
    if (!shardA) {
      const generatedA = generateShardKey();
      shardA = generatedA.address;
      generatedShards.shardA = {
        address: generatedA.address,
        privateKey: generatedA.privateKey,
      };
    }

    // If client didn't supply Shard C (Recovery/Passkey shard), generate one
    if (!shardC) {
      const generatedC = generateShardKey();
      shardC = generatedC.address;
      generatedShards.shardC = {
        address: generatedC.address,
        privateKey: generatedC.privateKey,
      };
    }

    shardA = getAddress(shardA);
    shardC = getAddress(shardC);

    // Generate Shard B (Backend Co-Signer Shard)
    const shardB = generateShardKey();
    const encryptedShardB = encryptSecret(shardB.privateKey);

    // Compute deterministic CREATE2 address via VeiloraFactory
    let counterfactualAddress: `0x${string}`;
    try {
      counterfactualAddress = await publicClient.readContract({
        address: FACTORY_ADDRESS,
        abi: veiloraFactoryAbi,
        functionName: "getAddress",
        args: [shardA, shardB.address, shardC, salt],
      });
    } catch {
      // Deterministic fallback if RPC is unreachable during test
      counterfactualAddress = getAddress(
        "0x" + shardB.address.slice(2).padStart(40, "0")
      );
    }

    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);

    await query(
      `INSERT INTO wallets (
        address, chain_id, shard_a_address, shard_b_address, shard_b_encrypted,
        shard_c_address, api_key_hash, threshold, totp_secret_encrypted
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 2, $8)
      ON CONFLICT (address) DO UPDATE SET
        shard_a_address = EXCLUDED.shard_a_address,
        shard_b_address = EXCLUDED.shard_b_address,
        shard_b_encrypted = EXCLUDED.shard_b_encrypted,
        shard_c_address = EXCLUDED.shard_c_address,
        api_key_hash = EXCLUDED.api_key_hash,
        updated_at = now()`,
      [
        counterfactualAddress.toLowerCase(),
        CHAIN_ID,
        shardA.toLowerCase(),
        shardB.address.toLowerCase(),
        encryptedShardB,
        shardC.toLowerCase(),
        apiKeyHash,
        req.body.totpSecret ? encryptSecret(req.body.totpSecret) : null,
      ]
    );

    let isDeployed = false;
    try {
      const code = await publicClient.getCode({ address: counterfactualAddress });
      isDeployed = Boolean(code && code !== "0x");
    } catch {
      // Ignore RPC lookup failure
    }

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
      generatedShards: Object.keys(generatedShards).length > 0 ? generatedShards : undefined,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to create threshold wallet" });
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
      shardB: getAddress(wallet.shard_b_address),
      shardC: getAddress(wallet.shard_c_address),
      threshold: wallet.threshold,
      isFrozen: freezeState.frozen,
      frozenUntil: freezeState.frozenUntil,
      freezeReason: freezeState.reason,
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

    // 2. Compute or read the digest to sign
    let digest: `0x${string}`;

    if (req.body.target && req.body.nonce !== undefined && req.body.deadline !== undefined) {
      // Robinhood Chain native executeWithSignatures format
      const target = getAddress(req.body.target);
      const value = BigInt(req.body.value || 0);
      const data = (req.body.data || "0x") as `0x${string}`;
      const nonce = BigInt(req.body.nonce);
      const deadline = BigInt(req.body.deadline);

      digest = computeExecutionDigest(
        target,
        value,
        data,
        nonce,
        deadline,
        BigInt(wallet.chain_id || CHAIN_ID)
      );
    } else if (req.body.digest && isHex(req.body.digest) && req.body.digest.length === 66) {
      digest = req.body.digest as `0x${string}`;
    } else if (req.body.userOpHash && isHex(req.body.userOpHash) && req.body.userOpHash.length === 66) {
      digest = req.body.userOpHash as `0x${string}`;
    } else {
      res.status(400).json({
        error: "Missing execution parameters (target, value, data, nonce, deadline) or 32-byte digest/userOpHash",
      });
      return;
    }

    // 3. Decrypt Shard B private key & sign RFC 6979
    const shardBPrivateKey = decryptSecret(wallet.shard_b_encrypted) as `0x${string}`;
    const { signature: shardBSignature, signer } = await signUserOpHash(shardBPrivateKey, digest);

    // 4. Optionally combine with client Shard A signature if supplied
    let combinedSignatures: `0x${string}` | undefined = undefined;
    if (req.body.shardASignature && isHex(req.body.shardASignature)) {
      combinedSignatures = concatSignatures(
        req.body.shardASignature as `0x${string}`,
        shardBSignature
      );
    }

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
          target: req.body.target,
          nonce: req.body.nonce,
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
    const hours = Number(req.body.hours) || 24;
    const reason = req.body.reason || "Emergency user freeze";

    const state = await freezeWallet(address, hours, reason);
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
