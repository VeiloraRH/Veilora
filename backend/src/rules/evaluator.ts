import { getAddress, parseAbiItem, parseUnits } from "viem";
import { publicClient } from "../config";
import { db, query } from "../db/index";
import { getFreezeState } from "../freeze";
import { quoteUsdgPrice, reportQuotePerformance } from "./prices";
import { recordAlert } from "../alerts/store";
import { RULE_ASSETS, nextScheduledRun, planExecution, toRaw, type RuleSpec } from "./spec";

const TICK_MS = Math.max(15_000, Number(process.env.RULES_TICK_MS) || 60_000);
const MAX_BLOCKS_PER_SCAN = 5_000n;
const MAX_PENDING_PER_RULE = 5;
const configuredRuleConcurrency = Number(process.env.RULES_EVALUATOR_CONCURRENCY);
const MAX_RULE_CONCURRENCY = Number.isFinite(configuredRuleConcurrency) && configuredRuleConcurrency > 0
  ? Math.max(1, Math.min(32, Math.floor(configuredRuleConcurrency)))
  : 8;
export const APPROVAL_WINDOW_HOURS = 24;
const LOCK_KEY = "veilora:wallet-rules:evaluator";
const transferEvent = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

export type IncomingTransfer = { ref: string; amountRaw: bigint; txHash: string; blockNumber: bigint };

/** Chain access the evaluator needs; tests replace it with fixtures. */
export type EvaluatorDeps = {
  now: () => Date;
  latestBlock: () => Promise<bigint>;
  incomingTransfers: (wallet: `0x${string}`, token: `0x${string}`, fromBlock: bigint, toBlock: bigint) => Promise<IncomingTransfer[]>;
  usdgPrice: (symbol: string) => Promise<bigint>;
};

export const chainDeps: EvaluatorDeps = {
  now: () => new Date(),
  latestBlock: () => publicClient.getBlockNumber(),
  incomingTransfers: async (wallet, token, fromBlock, toBlock) => {
    const logs = await publicClient.getLogs({ address: token, event: transferEvent, args: { to: wallet }, fromBlock, toBlock });
    return logs.map((log) => ({
      ref: `${log.transactionHash}:${log.logIndex}`,
      amountRaw: log.args.value ?? 0n,
      txHash: log.transactionHash ?? "",
      blockNumber: log.blockNumber ?? toBlock,
    }));
  },
  usdgPrice: quoteUsdgPrice,
};

type RuleRow = {
  id: string;
  wallet_address: string;
  spec: RuleSpec;
  trigger_type: "incoming" | "schedule" | "price";
  next_run_at: Date | null;
  last_scanned_block: string | null;
  price_armed: boolean;
};

async function spentToday(ruleId: string, now: Date): Promise<bigint> {
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const result = await query<{ total: string }>(
    `SELECT COALESCE(SUM(total_raw), 0)::text AS total FROM wallet_rule_executions
     WHERE rule_id = $1 AND status IN ('pending', 'executed', 'failed') AND created_at >= $2`,
    [ruleId, dayStart],
  );
  return BigInt(result.rows[0]?.total ?? "0");
}

/** Record one trigger occurrence as a pending approval (or a visible skip). Idempotent per trigger_ref. */
async function recordTrigger(rule: RuleRow, ref: string, baseRaw: bigint, detail: Record<string, unknown>, now: Date): Promise<boolean> {
  const pending = await query<{ n: string }>(
    "SELECT count(*)::text AS n FROM wallet_rule_executions WHERE rule_id = $1 AND status = 'pending'",
    [rule.id],
  );
  const plan = Number(pending.rows[0]?.n ?? 0) >= MAX_PENDING_PER_RULE
    ? { status: "skipped" as const, totalRaw: 0n, legs: [], reason: "Too many approvals are waiting for this rule" }
    : planExecution(rule.spec, baseRaw, await spentToday(rule.id, now));
  const expiresAt = new Date(now.getTime() + APPROVAL_WINDOW_HOURS * 3_600_000);
  const inserted = await query(
    `INSERT INTO wallet_rule_executions
       (rule_id, wallet_address, status, trigger_ref, trigger_detail, source_asset, total_raw, legs, reason, created_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (rule_id, trigger_ref) DO NOTHING
     RETURNING id`,
    [rule.id, rule.wallet_address, plan.status, ref, JSON.stringify({ ...detail, baseRaw: baseRaw.toString() }), rule.spec.source.asset,
      plan.totalRaw.toString(), JSON.stringify(plan.legs), plan.reason, now, expiresAt],
  );
  if (inserted.rows.length) {
    await query("UPDATE wallet_rules SET last_triggered_at = $2, updated_at = now() WHERE id = $1", [rule.id, now]);
    const executionId = String(inserted.rows[0].id);
    await recordAlert(rule.wallet_address, plan.status === "pending"
      ? { type: "rule", severity: "info", title: `“${rule.spec.name}” needs your approval`, body: "A rule triggered and its swap is ready. Review and approve it in Wallet Rules within 24 hours.", ref: `rule:${executionId}`, data: { ruleId: rule.id, executionId } }
      : { type: "rule", severity: "warn", title: `“${rule.spec.name}” was skipped`, body: plan.reason ?? "The rule triggered but could not prepare a run.", ref: `rule:${executionId}`, data: { ruleId: rule.id, executionId } });
  }
  return inserted.rows.length > 0;
}

async function evaluateIncoming(rule: RuleRow, deps: EvaluatorDeps, latest: bigint, now: Date): Promise<number> {
  if (rule.spec.trigger.type !== "incoming") return 0;
  const token = RULE_ASSETS[rule.spec.trigger.asset];
  if (!token?.address) return 0;
  const minRaw = toRaw(rule.spec.trigger.minAmount, token.decimals, "Minimum incoming amount");
  const from = rule.last_scanned_block === null ? latest : BigInt(rule.last_scanned_block) + 1n;
  if (from > latest) return 0;
  const to = from + MAX_BLOCKS_PER_SCAN - 1n < latest ? from + MAX_BLOCKS_PER_SCAN - 1n : latest;
  const transfers = await deps.incomingTransfers(getAddress(rule.wallet_address), token.address, from, to);
  let created = 0;
  for (const transfer of transfers) {
    if (transfer.amountRaw < minRaw) continue;
    if (await recordTrigger(rule, `transfer:${transfer.ref}`, transfer.amountRaw,
      { kind: "incoming", asset: token.symbol, txHash: transfer.txHash, blockNumber: transfer.blockNumber.toString() }, now)) created += 1;
  }
  await query("UPDATE wallet_rules SET last_scanned_block = $2, last_checked_at = $3 WHERE id = $1", [rule.id, to.toString(), now]);
  return created;
}

async function evaluateSchedule(rule: RuleRow, now: Date): Promise<number> {
  const trigger = rule.spec.trigger;
  if (trigger.type !== "schedule" || !rule.next_run_at || new Date(rule.next_run_at) > now) return 0;
  const source = RULE_ASSETS[rule.spec.source.asset];
  const dueAt = new Date(rule.next_run_at);
  const created = await recordTrigger(rule, `schedule:${dueAt.toISOString()}`, parseUnits(rule.spec.source.amount!, source.decimals),
    { kind: "schedule", dueAt: dueAt.toISOString() }, now);
  // A missed window (backend downtime) produces one run, not a backlog.
  await query("UPDATE wallet_rules SET next_run_at = $2, last_checked_at = $3 WHERE id = $1", [rule.id, nextScheduledRun(trigger, now), now]);
  return created ? 1 : 0;
}

async function evaluatePrice(rule: RuleRow, deps: EvaluatorDeps, now: Date): Promise<number> {
  const trigger = rule.spec.trigger;
  if (trigger.type !== "price") return 0;
  const price = await deps.usdgPrice(trigger.asset);
  const target = parseUnits(trigger.priceUsdg, 6);
  const met = trigger.direction === "above" ? price >= target : price <= target;
  let created = 0;
  // Fire once per crossing: the rule re-arms only after the condition stops holding.
  if (met && rule.price_armed) {
    const source = RULE_ASSETS[rule.spec.source.asset];
    if (await recordTrigger(rule, `price:${now.toISOString()}`, parseUnits(rule.spec.source.amount!, source.decimals),
      { kind: "price", asset: trigger.asset, priceRaw: price.toString(), direction: trigger.direction, targetRaw: target.toString() }, now)) created = 1;
  }
  await query("UPDATE wallet_rules SET price_armed = $2, last_price = $3, last_checked_at = $4 WHERE id = $1",
    [rule.id, !met, price.toString(), now]);
  return created;
}

/** One evaluation pass over every active rule. Returns how many executions were recorded. */
export async function evaluateRules(deps: EvaluatorDeps = chainDeps): Promise<number> {
  const started = performance.now();
  const now = deps.now();
  let rulesCount = 0;
  let created = 0;
  try {
    await query("UPDATE wallet_rules SET status = 'expired', updated_at = now() WHERE status IN ('active', 'paused') AND expires_at <= $1", [now]);
    await query(
      `UPDATE wallet_rule_executions SET status = 'expired', reason = COALESCE(reason, 'Approval window closed'), resolved_at = $1
       WHERE status = 'pending' AND expires_at <= $1`,
      [now],
    );
    const rules = await query<RuleRow>(
      `SELECT id, wallet_address, spec, trigger_type, next_run_at, last_scanned_block::text, price_armed
       FROM wallet_rules WHERE status = 'active' ORDER BY id LIMIT 1000`,
    );
    rulesCount = rules.rows.length;
    let latest: Promise<bigint> | undefined;
    const frozen = new Map<string, Promise<boolean>>();
    let nextRule = 0;
    const worker = async () => {
      while (true) {
        const index = nextRule++;
        const rule = rules.rows[index];
        if (!rule) return;
        try {
          let freezeCheck = frozen.get(rule.wallet_address);
          if (!freezeCheck) {
            freezeCheck = getFreezeState(rule.wallet_address).then((state) => state.frozen);
            frozen.set(rule.wallet_address, freezeCheck);
          }
          if (await freezeCheck) continue;
          if (rule.trigger_type === "incoming") {
            latest ??= deps.latestBlock();
            const count = await evaluateIncoming(rule, deps, await latest, now);
            created += count;
          } else if (rule.trigger_type === "schedule") {
            const count = await evaluateSchedule(rule, now);
            created += count;
          } else {
            const count = await evaluatePrice(rule, deps, now);
            created += count;
          }
        } catch (error) {
          // One unreachable quote or RPC call must not stall every other rule.
          console.warn(JSON.stringify({ msg: "rule evaluation failed", rule_id: rule.id, error: error instanceof Error ? error.message : String(error) }));
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(MAX_RULE_CONCURRENCY, rules.rows.length) }, () => worker()));
    return created;
  } finally {
    const duration = performance.now() - started;
    console.info(JSON.stringify({ msg: "rules evaluator pass", duration_ms: Math.round(duration), active_rules: rulesCount, executions_recorded: created, concurrency: MAX_RULE_CONCURRENCY }));
    reportQuotePerformance("rules", duration);
  }
}

/** Background loop. A session advisory lock keeps one evaluator active across replicas. */
export function startRulesEvaluator(deps: EvaluatorDeps = chainDeps): () => void {
  let stopped = false;
  let running = false;
  const tick = async () => {
    if (running || stopped) return;
    running = true;
    const client = await db.connect().catch(() => null);
    if (!client) { running = false; return; }
    try {
      const lock = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock(hashtext($1)) AS ok", [LOCK_KEY]);
      if (!lock.rows[0]?.ok) return;
      try {
        await evaluateRules(deps);
      } finally {
        await client.query("SELECT pg_advisory_unlock(hashtext($1))", [LOCK_KEY]);
      }
    } catch (error) {
      console.warn(JSON.stringify({ msg: "rules evaluator tick failed", error: error instanceof Error ? error.message : String(error) }));
    } finally {
      client.release();
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), TICK_MS);
  void tick();
  return () => { stopped = true; clearInterval(timer); };
}
