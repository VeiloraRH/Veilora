import { Router, type Request, type Response } from "express";
import { randomBytes, createHash } from "node:crypto";
import { getAddress, isAddress, isHex, recoverMessageAddress } from "viem";
import { createShieldedNote, verifyNoteStatus } from "../privacy/notes";
import { generateProvenanceProof, getActiveProvenanceSets } from "../privacy/provenance";
import { query } from "../db/index";

export const privacyRouter = Router();

/**
 * POST /v1/privacy/notes
 * Creates and registers a new shielded note commitment.
 */
privacyRouter.post("/notes", async (req: Request, res: Response): Promise<void> => {
  try {
    const { assetSymbol = "USDG", amountWei, ownerAddress, creationRequestId, shardASignature } = req.body;
    if (typeof amountWei !== "string" || !/^\d+$/.test(amountWei) || BigInt(amountWei) <= 0n) {
      res.status(400).json({ error: "A positive integer 'amountWei' is required" });
      return;
    }
    if (typeof assetSymbol !== "string" || !/^[a-zA-Z0-9]{2,12}$/.test(assetSymbol)) {
      res.status(400).json({ error: "A valid asset symbol is required" });
      return;
    }
    if (!isAddress(ownerAddress || "") || typeof creationRequestId !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(creationRequestId)) {
      res.status(400).json({ error: "A wallet address and unique creation request ID are required" });
      return;
    }
    if (!shardASignature || !isHex(shardASignature) || shardASignature.length !== 132) {
      res.status(400).json({ error: "A valid Shard A signature is required" });
      return;
    }

    const walletAddress = getAddress(ownerAddress);
    const wallet = await query("SELECT shard_a_address FROM wallets WHERE address = $1", [walletAddress.toLowerCase()]);
    if (!wallet.rows.length) {
      res.status(404).json({ error: "Veilora wallet not found" });
      return;
    }
    const message = `Veilora shield note creation\nwallet:${walletAddress}\nasset:${assetSymbol.toUpperCase()}\namount:${amountWei}\nrequest:${creationRequestId}`;
    const signer = await recoverMessageAddress({ message, signature: shardASignature });
    if (signer.toLowerCase() !== String(wallet.rows[0].shard_a_address).toLowerCase()) {
      res.status(403).json({ error: "Signature does not match this wallet's Shard A" });
      return;
    }

    const created = await createShieldedNote(assetSymbol, amountWei, walletAddress, creationRequestId);
    res.status(201).json(created);
  } catch (error: any) {
    if (error?.code === "23505" || error?.message?.includes("already been used")) {
      res.status(409).json({ error: "This note creation request has already been used" });
      return;
    }
    res.status(500).json({ error: error.message || "Failed to create shielded note" });
  }
});

/**
 * POST /v1/privacy/notes/:commitment/verify
 * Checks whether a shielded commitment exists and is unspent.
 */
privacyRouter.post("/notes/:commitment/verify", async (req: Request, res: Response): Promise<void> => {
  try {
    const commitment = String(req.params.commitment);
    if (!/^0x[0-9a-fA-F]{64}$/.test(commitment)) {
      res.status(400).json({ error: "A valid 32-byte note commitment is required" });
      return;
    }
    const ownerAddress = String(req.body.walletAddress || "");
    const signature = String(req.body.shardASignature || "");
    if (!isAddress(ownerAddress) || !signature || !isHex(signature) || signature.length !== 132) {
      res.status(400).json({ error: "Wallet address and Shard A signature are required" });
      return;
    }
    const walletAddress = getAddress(ownerAddress);
    const wallet = await query("SELECT shard_a_address FROM wallets WHERE address = $1", [walletAddress.toLowerCase()]);
    if (!wallet.rows.length) {
      res.status(404).json({ error: "Veilora wallet not found" });
      return;
    }
    const message = `Veilora note status request: ${walletAddress}:${commitment}`;
    const signer = await recoverMessageAddress({ message, signature });
    if (signer.toLowerCase() !== String(wallet.rows[0].shard_a_address).toLowerCase()) {
      res.status(403).json({ error: "Signature does not match this wallet's Shard A" });
      return;
    }
    const status = await verifyNoteStatus(commitment, walletAddress);
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to verify note status" });
  }
});

/**
 * POST /v1/privacy/provenance/prove
 * Generates an association-set inclusion proof (PPOI) for clean funds.
 */
privacyRouter.post("/provenance/prove", async (req: Request, res: Response): Promise<void> => {
  try {
    const { depositCommitment, targetAsset = "USDG" } = req.body;
    if (!depositCommitment) {
      res.status(400).json({ error: "Field 'depositCommitment' is required" });
      return;
    }

    const proof = await generateProvenanceProof(depositCommitment, targetAsset);
    res.json(proof);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to generate provenance proof" });
  }
});

/**
 * GET /v1/privacy/provenance/sets
 * Lists active verified association sets.
 */
privacyRouter.get("/provenance/sets", async (_req: Request, res: Response): Promise<void> => {
  try {
    const sets = await getActiveProvenanceSets();
    res.json({ sets });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch provenance sets" });
  }
});

/**
 * POST /v1/privacy/viewkeys
 * Creates a scoped view key for selective compliance disclosure.
 */
privacyRouter.post("/viewkeys", async (req: Request, res: Response): Promise<void> => {
  try {
    const { walletAddress, scope = "account", label = "Compliance View Key", allowedAssets = ["USDG", "ETH", "NVDA"], validDays = 30 } = req.body;
    if (!walletAddress) {
      res.status(400).json({ error: "Field 'walletAddress' is required" });
      return;
    }

    const rawToken = "vk_" + randomBytes(24).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const validUntil = new Date(Date.now() + validDays * 24 * 3600 * 1000).toISOString();

    const result = await query(
      `INSERT INTO view_keys (
        wallet_address, scope, token_hash, label, allowed_assets, valid_until
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING key_id, wallet_address, scope, label, allowed_assets, valid_until, created_at`,
      [walletAddress.toLowerCase(), scope, tokenHash, label, allowedAssets, validUntil]
    );

    res.status(201).json({
      ...result.rows[0],
      viewKeyToken: rawToken,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to create view key" });
  }
});

/**
 * GET /v1/privacy/viewkeys/:token
 * Validates a view key token and returns permitted disclosure scope.
 */
privacyRouter.get("/viewkeys/:token", async (req: Request, res: Response): Promise<void> => {
  try {
    const token = String(req.params.token);
    const tokenHash = createHash("sha256").update(token).digest("hex");

    const result = await query(
      `UPDATE view_keys
       SET access_count = access_count + 1,
           last_accessed_at = now()
       WHERE token_hash = $1 AND is_revoked = false AND (valid_until IS NULL OR valid_until > now())
       RETURNING key_id, wallet_address, scope, label, allowed_assets, valid_until, access_count, last_accessed_at`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Invalid, expired, or revoked view key" });
      return;
    }

    res.json({
      valid: true,
      viewKey: result.rows[0],
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to inspect view key" });
  }
});
