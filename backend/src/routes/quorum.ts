import { Router, type Request, type Response } from "express";
import { getAddress, isAddress } from "viem";
import { publicClient } from "../config";
import { veiloraAccountAbi } from "../abi";
import { query } from "../db/index";
import { getFreezeState } from "../freeze";

/**
 * GET /v1/wallets/:address/quorum
 * Shard status for the recovery center: the shards the deployed account will
 * actually accept, compared with what Veilora registered, plus freeze and
 * co-signer health. Only public addresses and counts are returned.
 */
export const quorumRouter = Router({ mergeParams: true });

type OnChainShards = { shardA: `0x${string}`; shardB: `0x${string}`; shardC: `0x${string}`; nonce: bigint } | null;

/** Overridable in tests so status checks do not depend on a live RPC. */
export const quorumChain = {
  async read(address: `0x${string}`): Promise<OnChainShards> {
    const code = await publicClient.getCode({ address });
    if (!code || code === "0x") return null;
    const read = (functionName: "shardA" | "shardB" | "shardC" | "nonce") =>
      publicClient.readContract({ address, abi: veiloraAccountAbi, functionName }) as Promise<never>;
    const [shardA, shardB, shardC, nonce] = await Promise.all([read("shardA"), read("shardB"), read("shardC"), read("nonce")]);
    return { shardA, shardB, shardC, nonce };
  },
};

quorumRouter.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const raw = String(req.params.address);
    if (!isAddress(raw)) { res.status(400).json({ error: "A valid smart account address is required" }); return; }
    const address = getAddress(raw);
    const rows = await query("SELECT shard_a_address, shard_b_address, shard_c_address, threshold, created_at FROM wallets WHERE address = $1", [address.toLowerCase()]);
    if (!rows.rows.length) { res.status(404).json({ error: "Wallet not found" }); return; }
    const wallet = rows.rows[0];
    const registered = { shardA: getAddress(wallet.shard_a_address), shardB: getAddress(wallet.shard_b_address), shardC: getAddress(wallet.shard_c_address) };

    let onChain: OnChainShards = null;
    let chainError: string | null = null;
    try {
      onChain = await quorumChain.read(address);
    } catch {
      chainError = "Robinhood Chain could not be reached; on-chain shards were not checked";
    }

    const [freeze, cosign] = await Promise.all([
      getFreezeState(address),
      query<{ approved: string; rejected: string; last_approved: Date | null; last_rejected: Date | null }>(
        `SELECT count(*) FILTER (WHERE status = 'APPROVED' AND created_at > now() - interval '30 days')::text AS approved,
                count(*) FILTER (WHERE status LIKE 'REJECTED%' AND created_at > now() - interval '30 days')::text AS rejected,
                max(created_at) FILTER (WHERE status = 'APPROVED') AS last_approved,
                max(created_at) FILTER (WHERE status LIKE 'REJECTED%') AS last_rejected
         FROM cosign_audit WHERE wallet_address = $1`,
        [address.toLowerCase()],
      ),
    ]);
    const stats = cosign.rows[0];
    const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

    res.json({
      address,
      threshold: wallet.threshold,
      registered,
      deployed: onChain !== null,
      chainError,
      onChain: onChain && { shardA: getAddress(onChain.shardA), shardB: getAddress(onChain.shardB), shardC: getAddress(onChain.shardC), nonce: onChain.nonce.toString() },
      matches: onChain && {
        shardA: same(onChain.shardA, registered.shardA),
        shardB: same(onChain.shardB, registered.shardB),
        shardC: same(onChain.shardC, registered.shardC),
      },
      freeze,
      coSigner: {
        // The co-signer refuses every request while a freeze is active.
        signing: !freeze.frozen,
        approvals30d: Number(stats?.approved ?? 0),
        rejections30d: Number(stats?.rejected ?? 0),
        lastApprovedAt: stats?.last_approved ?? null,
        lastRejectedAt: stats?.last_rejected ?? null,
      },
      // What each pair of shards can do through Veilora today.
      recoveryPaths: {
        deviceAndCoSigner: "available",
        recoveryKeyFreeze: "available",
        recoveryKeyRotation: "planned",
      },
      createdAt: wallet.created_at,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to read quorum status" });
  }
});
