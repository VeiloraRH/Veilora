import { sha256Hex } from "../crypto";
import { query } from "../db/index";
import { randomBytes } from "node:crypto";

export interface ShieldedNote {
  commitment: string;
  nullifierHash: string;
  assetSymbol: string;
  amountWei: string;
  status: "unspent" | "spent" | "pending_unshield" | "reclaimed";
  ownerViewTag?: string;
  createdAt: string;
}

/**
 * Computes deterministic note commitment: Hash(asset || amountWei || nullifier || blinding)
 */
export function computeNoteCommitment(
  assetSymbol: string,
  amountWei: string,
  nullifier: string,
  blinding: string
): string {
  const payload = `${assetSymbol.toUpperCase()}:${amountWei}:${nullifier}:${blinding}`;
  return sha256Hex(payload);
}

/**
 * Computes nullifier hash to prevent double-spending without revealing the note.
 */
export function computeNullifierHash(nullifier: string, commitment: string): string {
  return sha256Hex(`nullifier:${nullifier}:${commitment}`);
}

/**
 * Generates and stores a new shielded note in the registry.
 */
export async function createShieldedNote(
  assetSymbol: string,
  amountWei: string,
  ownerAddress?: string
): Promise<{ note: ShieldedNote; nullifierSecret: string; blindingSecret: string }> {
  const nullifierSecret = "0x" + randomBytes(32).toString("hex");
  const blindingSecret = "0x" + randomBytes(32).toString("hex");

  const commitment = computeNoteCommitment(assetSymbol, amountWei, nullifierSecret, blindingSecret);
  const nullifierHash = computeNullifierHash(nullifierSecret, commitment);
  const ownerViewTag = ownerAddress ? sha256Hex(`view:${ownerAddress}`).slice(0, 18) : undefined;

  await query(
    `INSERT INTO shielded_notes (
      commitment, nullifier_hash, asset_symbol, amount_wei, status, owner_view_tag
    ) VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (commitment) DO NOTHING`,
    [commitment, nullifierHash, assetSymbol.toUpperCase(), amountWei, "unspent", ownerViewTag]
  );

  return {
    note: {
      commitment,
      nullifierHash,
      assetSymbol: assetSymbol.toUpperCase(),
      amountWei,
      status: "unspent",
      ownerViewTag,
      createdAt: new Date().toISOString(),
    },
    nullifierSecret,
    blindingSecret,
  };
}

/**
 * Verifies if a note is valid and unspent.
 */
export async function verifyNoteStatus(commitment: string): Promise<{
  exists: boolean;
  isUnspent: boolean;
  asset?: string;
  amountWei?: string;
}> {
  const res = await query(
    `SELECT asset_symbol, amount_wei, status FROM shielded_notes WHERE commitment = $1`,
    [commitment]
  );

  if (res.rows.length === 0) {
    return { exists: false, isUnspent: false };
  }

  const row = res.rows[0];
  return {
    exists: true,
    isUnspent: row.status === "unspent",
    asset: row.asset_symbol,
    amountWei: row.amount_wei,
  };
}
