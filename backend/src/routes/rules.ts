import { Router, type Request, type Response } from "express";
import { getAddress, isAddress, isHex, recoverMessageAddress } from "viem";
import { query } from "../db/index";
import { getFreezeState } from "../freeze";
import { latestBlockForNewRule } from "../rules/chain";
import { RuleSpecError, hashSpec, nextScheduledRun, parseRuleSpec } from "../rules/spec";

/**
 * Wallet Rules API, mounted at /v1/wallets/:address/rules.
 * Every read and change is authorized by a fresh Shard A signature. Rules only
 * prepare swaps; each execution is approved and co-signed through /cosign.
 */
export const rulesRouter = Router({ mergeParams: true });

const MAX_RULES_PER_WALLET = 20;
const SIGNATURE_WINDOW_SECONDS = 300;

export const rulesReadMessage = (wallet: string, timestamp: number) =>
  `Veilora wallet rules access\nwallet:${getAddress(wallet)}\ntimestamp:${timestamp}`;
export const ruleCreateMessage = (wallet: string, specHash: string, timestamp: number) =>
  `Veilora wallet rule\naction:create\nwallet:${getAddress(wallet)}\nspec:${specHash}\ntimestamp:${timestamp}`;
export const ruleStatusMessage = (wallet: string, ruleId: string, action: string, timestamp: number) =>
  `Veilora wallet rule\naction:${action}\nwallet:${getAddress(wallet)}\nrule:${ruleId}\ntimestamp:${timestamp}`;
export const executionResolveMessage = (wallet: string, executionId: string, outcome: string, txHashes: string[], timestamp: number) =>
  `Veilora rule execution\naction:${outcome}\nwallet:${getAddress(wallet)}\nexecution:${executionId}\ntx:${txHashes.join(",")}\ntimestamp:${timestamp}`;

class HttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

function fresh(timestamp: unknown): number {
  const ts = Number(timestamp);
  if (!Number.isSafeInteger(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > SIGNATURE_WINDOW_SECONDS) {
    throw new HttpError(400, "A fresh Shard A authorization is required");
  }
  return ts;
}

function signatureOf(value: unknown): `0x${string}` {
  if (typeof value !== "string" || !isHex(value) || value.length !== 132) throw new HttpError(400, "A valid Shard A signature is required");
  return value;
}

async function loadWallet(req: Request): Promise<{ address: string; shardA: string }> {
  const raw = String(req.params.address);
  if (!isAddress(raw)) throw new HttpError(400, "A valid smart account address is required");
  const rows = await query("SELECT address, shard_a_address FROM wallets WHERE address = $1", [raw.toLowerCase()]);
  if (!rows.rows.length) throw new HttpError(404, "Wallet not found");
  return { address: rows.rows[0].address, shardA: String(rows.rows[0].shard_a_address).toLowerCase() };
}

async function assertShardA(wallet: { shardA: string }, message: string, signature: `0x${string}`) {
  const signer = await recoverMessageAddress({ message, signature });
  if (signer.toLowerCase() !== wallet.shardA) throw new HttpError(403, "Signature does not match this wallet's Shard A");
}

/** Mutations are single use: a captured signature cannot be replayed inside its window. */
async function consumeAuthorization(walletAddress: string, signature: string) {
  const result = await query(
    "INSERT INTO wallet_rule_authorizations (signature, wallet_address) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING signature",
    [signature.toLowerCase(), walletAddress],
  );
  if (!result.rows.length) throw new HttpError(409, "This authorization has already been used");
  await query("DELETE FROM wallet_rule_authorizations WHERE created_at < now() - interval '1 day'");
}

function send(res: Response, error: unknown, fallback: string) {
  if (error instanceof HttpError) { res.status(error.status).json({ error: error.message }); return; }
  if (error instanceof RuleSpecError) { res.status(400).json({ error: error.message }); return; }
  if (error instanceof Error && (error as Error & { status?: number }).status === 503) { res.status(503).json({ error: error.message }); return; }
  res.status(500).json({ error: error instanceof Error ? error.message : fallback });
}

function presentRule(row: any) {
  return {
    id: String(row.id),
    name: row.name,
    status: row.status,
    mode: row.mode,
    spec: row.spec,
    specHash: row.spec_hash,
    expiresAt: row.expires_at,
    nextRunAt: row.next_run_at,
    lastPriceRaw: row.last_price,
    lastCheckedAt: row.last_checked_at,
    lastTriggeredAt: row.last_triggered_at,
    createdAt: row.created_at,
  };
}

function presentExecution(row: any) {
  return {
    id: String(row.id),
    ruleId: String(row.rule_id),
    ruleName: row.rule_name,
    status: row.status,
    trigger: row.trigger_detail,
    sourceAsset: row.source_asset,
    totalRaw: String(row.total_raw),
    legs: row.legs,
    slippageBps: row.spec?.limits?.slippageBps ?? 50,
    reason: row.reason,
    txHashes: row.tx_hashes,
    error: row.error,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    resolvedAt: row.resolved_at,
  };
}

/** GET / — rules and recent executions. Headers: x-veilora-timestamp, x-veilora-signature. */
rulesRouter.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const wallet = await loadWallet(req);
    const timestamp = fresh(req.header("x-veilora-timestamp"));
    await assertShardA(wallet, rulesReadMessage(wallet.address, timestamp), signatureOf(req.header("x-veilora-signature")));
    const [rules, executions] = await Promise.all([
      query("SELECT * FROM wallet_rules WHERE wallet_address = $1 ORDER BY (status = 'active') DESC, id DESC", [wallet.address]),
      query(
        `SELECT e.*, r.name AS rule_name, r.spec FROM wallet_rule_executions e JOIN wallet_rules r ON r.id = e.rule_id
         WHERE e.wallet_address = $1 ORDER BY (e.status = 'pending') DESC, e.id DESC LIMIT 50`,
        [wallet.address],
      ),
    ]);
    res.json({
      walletAddress: getAddress(wallet.address),
      // Unattended execution needs an audited, scoped preauthorization path in the account.
      automaticExecutionAvailable: false,
      rules: rules.rows.map(presentRule),
      executions: executions.rows.map(presentExecution),
    });
  } catch (error) {
    send(res, error, "Failed to load wallet rules");
  }
});

/** POST / — create a rule from the exact spec string Shard A signed. */
rulesRouter.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const wallet = await loadWallet(req);
    const timestamp = fresh(req.body.timestamp);
    const signature = signatureOf(req.body.shardASignature);
    const spec = parseRuleSpec(req.body.spec);
    const specHash = hashSpec(req.body.spec);
    await assertShardA(wallet, ruleCreateMessage(wallet.address, specHash, timestamp), signature);
    if ((await getFreezeState(wallet.address)).frozen) throw new HttpError(403, "Wallet is frozen; unfreeze it before adding rules");
    const count = await query("SELECT count(*)::int AS n FROM wallet_rules WHERE wallet_address = $1 AND status IN ('active', 'paused')", [wallet.address]);
    if (count.rows[0].n >= MAX_RULES_PER_WALLET) throw new HttpError(409, `A wallet can have up to ${MAX_RULES_PER_WALLET} active or paused rules`);
    await consumeAuthorization(wallet.address, signature);

    const now = new Date();
    // Incoming rules only react to transfers that arrive after the rule exists.
    const scanFrom = spec.trigger.type === "incoming" ? await latestBlockForNewRule() : null;
    const created = await query(
      `INSERT INTO wallet_rules (wallet_address, name, spec, spec_hash, mode, trigger_type, expires_at, next_run_at, last_scanned_block)
       VALUES ($1, $2, $3, $4, 'approval', $5, $6, $7, $8) RETURNING *`,
      [wallet.address, spec.name, JSON.stringify(spec), specHash, spec.trigger.type, spec.limits.expiresAt,
        spec.trigger.type === "schedule" ? nextScheduledRun(spec.trigger, now) : null, scanFrom === null ? null : scanFrom.toString()],
    );
    res.status(201).json(presentRule(created.rows[0]));
  } catch (error) {
    send(res, error, "Failed to create wallet rule");
  }
});

/** POST /:ruleId/status — pause, resume or revoke. */
rulesRouter.post("/:ruleId/status", async (req: Request, res: Response): Promise<void> => {
  try {
    const wallet = await loadWallet(req);
    const ruleId = String(req.params.ruleId);
    const action = String(req.body.action);
    if (!/^\d{1,18}$/.test(ruleId) || !["pause", "resume", "revoke"].includes(action)) throw new HttpError(400, "A rule ID and a pause, resume or revoke action are required");
    const timestamp = fresh(req.body.timestamp);
    const signature = signatureOf(req.body.shardASignature);
    await assertShardA(wallet, ruleStatusMessage(wallet.address, ruleId, action, timestamp), signature);
    const current = await query("SELECT status FROM wallet_rules WHERE id = $1 AND wallet_address = $2", [ruleId, wallet.address]);
    if (!current.rows.length) throw new HttpError(404, "Rule not found");
    const from = current.rows[0].status as string;
    const allowed = action === "pause" ? from === "active" : action === "resume" ? from === "paused" : from === "active" || from === "paused";
    if (!allowed) throw new HttpError(409, `A ${from} rule cannot be ${action === "pause" ? "paused" : action === "resume" ? "resumed" : "revoked"}`);
    await consumeAuthorization(wallet.address, signature);
    const status = action === "pause" ? "paused" : action === "resume" ? "active" : "revoked";
    const updated = await query("UPDATE wallet_rules SET status = $3, updated_at = now() WHERE id = $1 AND wallet_address = $2 RETURNING *", [ruleId, wallet.address, status]);
    if (status === "revoked") {
      await query(
        "UPDATE wallet_rule_executions SET status = 'expired', reason = 'Rule revoked', resolved_at = now() WHERE rule_id = $1 AND status = 'pending'",
        [ruleId],
      );
    }
    res.json(presentRule(updated.rows[0]));
  } catch (error) {
    send(res, error, "Failed to update wallet rule");
  }
});

/** POST /executions/:executionId/resolve — record the owner's decision on a prepared run. */
rulesRouter.post("/executions/:executionId/resolve", async (req: Request, res: Response): Promise<void> => {
  try {
    const wallet = await loadWallet(req);
    const executionId = String(req.params.executionId);
    const outcome = String(req.body.outcome);
    const txHashes: unknown = req.body.txHashes ?? [];
    if (!/^\d{1,18}$/.test(executionId) || !["executed", "failed", "declined"].includes(outcome)) throw new HttpError(400, "An execution ID and an executed, failed or declined outcome are required");
    if (!Array.isArray(txHashes) || txHashes.length > 8 || txHashes.some((h) => typeof h !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(h))) {
      throw new HttpError(400, "Transaction hashes must be 32-byte hex strings");
    }
    if (outcome === "executed" && txHashes.length === 0) throw new HttpError(400, "An executed run needs its transaction hashes");
    if (outcome === "declined" && txHashes.length > 0) throw new HttpError(400, "A declined run has no transactions");
    const error = req.body.error === undefined ? null : String(req.body.error).slice(0, 300);
    const timestamp = fresh(req.body.timestamp);
    const signature = signatureOf(req.body.shardASignature);
    const hashes = (txHashes as string[]).map((h) => h.toLowerCase());
    await assertShardA(wallet, executionResolveMessage(wallet.address, executionId, outcome, hashes, timestamp), signature);
    await consumeAuthorization(wallet.address, signature);
    const updated = await query(
      `UPDATE wallet_rule_executions SET status = $3, tx_hashes = $4, error = $5, resolved_at = now()
       WHERE id = $1 AND wallet_address = $2 AND status = 'pending' RETURNING *`,
      [executionId, wallet.address, outcome, hashes, error],
    );
    if (!updated.rows.length) throw new HttpError(409, "This run is no longer waiting for approval");
    res.json(presentExecution(updated.rows[0]));
  } catch (error) {
    send(res, error, "Failed to resolve rule execution");
  }
});
