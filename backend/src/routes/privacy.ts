import { Router, type Request, type Response } from "express";
import { randomBytes, createHash } from "node:crypto";
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
    const { assetSymbol = "USDG", amountWei, ownerAddress } = req.body;
    if (!amountWei) {
      res.status(400).json({ error: "Field 'amountWei' is required" });
      return;
    }

    const created = await createShieldedNote(assetSymbol, amountWei, ownerAddress);
    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to create shielded note" });
  }
});

/**
 * GET /v1/privacy/notes/:commitment
 * Checks whether a shielded commitment exists and is unspent.
 */
privacyRouter.get("/notes/:commitment", async (req: Request, res: Response): Promise<void> => {
  try {
    const commitment = String(req.params.commitment);
    const status = await verifyNoteStatus(commitment);
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
