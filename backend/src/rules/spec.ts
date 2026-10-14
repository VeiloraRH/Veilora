import { keccak256, parseUnits, stringToHex } from "viem";
import { ROBINHOOD_TOKEN_REGISTRY } from "../tokens";

/**
 * Wallet Rules v1. A rule watches for a trigger and prepares a swap plan that
 * the owner approves with the normal 2-of-3 signing flow. Rules never carry
 * signing authority of their own; automatic execution is not offered until a
 * scoped, audited preauthorization path exists in the smart account.
 */

export type RuleAsset = { symbol: string; decimals: number; native: boolean; address: `0x${string}` | null };

export const RULE_ASSETS: Record<string, RuleAsset> = {
  ETH: { symbol: "ETH", decimals: 18, native: true, address: null },
  ...Object.fromEntries(
    Object.values(ROBINHOOD_TOKEN_REGISTRY).map((t) => [t.symbol, { symbol: t.symbol, decimals: t.decimals, native: false, address: t.address }]),
  ),
};

export type IncomingTrigger = { type: "incoming"; asset: string; minAmount: string };
export type ScheduleTrigger = { type: "schedule"; frequency: "daily" | "weekly" | "monthly"; hourUtc: number; weekday?: number; dayOfMonth?: number };
export type PriceTrigger = { type: "price"; asset: string; direction: "above" | "below"; priceUsdg: string };
export type RuleTrigger = IncomingTrigger | ScheduleTrigger | PriceTrigger;

export type RuleSpec = {
  version: 1;
  name: string;
  trigger: RuleTrigger;
  /** For incoming triggers the source is the received asset and the base is the received amount. */
  source: { asset: string; amount?: string };
  allocations: { asset: string; percent: number }[];
  limits: { maxPerRun: string; dailyCap: string; slippageBps: number; expiresAt: string };
  mode: "approval";
};

export class RuleSpecError extends Error {}

const MAX_SPEC_BYTES = 4096;
const DECIMAL = /^(?:0|[1-9]\d{0,17})(?:\.\d{1,18})?$/;
const DAY_MS = 86_400_000;

function fail(message: string): never {
  throw new RuleSpecError(message);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function onlyKeys(value: Record<string, unknown>, allowed: string[], label: string) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`Unknown field "${key}" in ${label}`);
}

function asset(symbol: unknown, label: string): RuleAsset {
  if (typeof symbol !== "string" || !RULE_ASSETS[symbol]) fail(`${label} must be a supported Robinhood Chain asset`);
  return RULE_ASSETS[symbol];
}

/** Parse a positive decimal amount into raw units for the given asset. */
export function toRaw(amount: unknown, decimals: number, label: string): bigint {
  if (typeof amount !== "string" || !DECIMAL.test(amount)) fail(`${label} must be a positive decimal amount`);
  if ((amount.split(".")[1]?.length ?? 0) > decimals) fail(`${label} has more than ${decimals} decimal places`);
  const raw = parseUnits(amount, decimals);
  if (raw <= 0n) fail(`${label} must be greater than zero`);
  return raw;
}

function integer(value: unknown, min: number, max: number, label: string): number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) fail(`${label} must be a whole number from ${min} to ${max}`);
  return value as number;
}

export function hashSpec(specJson: string): `0x${string}` {
  return keccak256(stringToHex(specJson));
}

/** Validate the exact JSON string the owner signed. Returns the parsed spec. */
export function parseRuleSpec(specJson: unknown, now = new Date()): RuleSpec {
  if (typeof specJson !== "string" || !specJson.length || Buffer.byteLength(specJson, "utf8") > MAX_SPEC_BYTES) fail("Rule spec must be a JSON string under 4 KB");
  let raw: unknown;
  try { raw = JSON.parse(specJson); } catch { fail("Rule spec is not valid JSON"); }
  if (!isObject(raw)) fail("Rule spec must be an object");
  onlyKeys(raw, ["version", "name", "trigger", "source", "allocations", "limits", "mode"], "rule");
  if (raw.version !== 1) fail("Unsupported rule version");

  if (raw.mode === "automatic") fail("Automatic execution is not available yet. Choose approval first.");
  if (raw.mode !== "approval") fail("Execution mode must be approval first");

  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name || name.length > 60 || /[\r\n]/.test(name)) fail("Rule name must be 1 to 60 characters on one line");

  if (!isObject(raw.trigger)) fail("Rule trigger is required");
  const t = raw.trigger;
  let trigger: RuleTrigger;
  if (t.type === "incoming") {
    onlyKeys(t, ["type", "asset", "minAmount"], "trigger");
    const a = asset(t.asset, "Incoming asset");
    if (a.native) fail("Incoming ETH transfers are not supported yet; watch an ERC-20 asset");
    toRaw(t.minAmount, a.decimals, "Minimum incoming amount");
    trigger = { type: "incoming", asset: a.symbol, minAmount: t.minAmount as string };
  } else if (t.type === "schedule") {
    onlyKeys(t, ["type", "frequency", "hourUtc", "weekday", "dayOfMonth"], "trigger");
    if (!["daily", "weekly", "monthly"].includes(t.frequency as string)) fail("Schedule frequency must be daily, weekly or monthly");
    const hourUtc = integer(t.hourUtc, 0, 23, "Schedule hour");
    trigger = { type: "schedule", frequency: t.frequency as ScheduleTrigger["frequency"], hourUtc };
    if (t.frequency === "weekly") trigger.weekday = integer(t.weekday, 0, 6, "Schedule weekday");
    else if (t.weekday !== undefined) fail("Weekday only applies to weekly schedules");
    if (t.frequency === "monthly") trigger.dayOfMonth = integer(t.dayOfMonth, 1, 28, "Schedule day of month");
    else if (t.dayOfMonth !== undefined) fail("Day of month only applies to monthly schedules");
  } else if (t.type === "price") {
    onlyKeys(t, ["type", "asset", "direction", "priceUsdg"], "trigger");
    const a = asset(t.asset, "Price asset");
    if (a.symbol === "USDG") fail("USDG is the price unit; pick another asset to watch");
    if (t.direction !== "above" && t.direction !== "below") fail("Price direction must be above or below");
    toRaw(t.priceUsdg, 6, "Target price");
    trigger = { type: "price", asset: a.symbol, direction: t.direction, priceUsdg: t.priceUsdg as string };
  } else {
    fail("Trigger must be an incoming transfer, a schedule or a price condition");
  }

  if (!isObject(raw.source)) fail("Rule source is required");
  onlyKeys(raw.source, ["asset", "amount"], "source");
  const source = asset(raw.source.asset, "Source asset");
  if (trigger.type === "incoming") {
    if (source.symbol !== trigger.asset) fail("An incoming rule spends the asset it receives");
    if (raw.source.amount !== undefined) fail("Incoming rules size each run from the received amount");
  } else {
    toRaw(raw.source.amount, source.decimals, "Source amount");
  }

  if (!Array.isArray(raw.allocations) || raw.allocations.length < 1 || raw.allocations.length > 4) fail("Add one to four target assets");
  const seen = new Set<string>();
  let total = 0;
  const allocations = raw.allocations.map((entry, i) => {
    if (!isObject(entry)) fail("Each allocation needs an asset and a percent");
    onlyKeys(entry, ["asset", "percent"], "allocation");
    const target = asset(entry.asset, `Target asset ${i + 1}`);
    if (target.symbol === source.symbol) fail("A target asset must differ from the source asset");
    if (seen.has(target.symbol)) fail("Each target asset can appear only once");
    seen.add(target.symbol);
    const percent = integer(entry.percent, 1, 100, `Allocation ${i + 1} percent`);
    total += percent;
    return { asset: target.symbol, percent };
  });
  if (total > 100) fail("Allocations cannot add up to more than 100%");

  if (!isObject(raw.limits)) fail("Rule limits are required");
  onlyKeys(raw.limits, ["maxPerRun", "dailyCap", "slippageBps", "expiresAt"], "limits");
  const maxPerRun = toRaw(raw.limits.maxPerRun, source.decimals, "Maximum per run");
  const dailyCap = toRaw(raw.limits.dailyCap, source.decimals, "Daily cap");
  if (dailyCap < maxPerRun) fail("Daily cap must be at least the maximum per run");
  if (trigger.type !== "incoming" && toRaw(raw.source.amount, source.decimals, "Source amount") * BigInt(total) / 100n > maxPerRun) {
    fail("The fixed amount you allocate is above your maximum per run");
  }
  const slippageBps = integer(raw.limits.slippageBps, 10, 300, "Slippage limit (basis points)");
  const expiresAt = typeof raw.limits.expiresAt === "string" ? new Date(raw.limits.expiresAt) : new Date(NaN);
  if (Number.isNaN(expiresAt.getTime())) fail("Expiry must be an ISO date");
  if (expiresAt.getTime() < now.getTime() + 3_600_000 || expiresAt.getTime() > now.getTime() + 366 * DAY_MS) fail("Expiry must be between one hour and one year from now");

  return {
    version: 1,
    name,
    trigger,
    source: trigger.type === "incoming" ? { asset: source.symbol } : { asset: source.symbol, amount: raw.source.amount as string },
    allocations,
    limits: { maxPerRun: raw.limits.maxPerRun as string, dailyCap: raw.limits.dailyCap as string, slippageBps, expiresAt: expiresAt.toISOString() },
    mode: "approval",
  };
}

/** The next scheduled run strictly after `after`, in UTC. */
export function nextScheduledRun(trigger: ScheduleTrigger, after: Date): Date {
  const candidate = new Date(Date.UTC(after.getUTCFullYear(), after.getUTCMonth(), after.getUTCDate(), trigger.hourUtc));
  if (trigger.frequency === "daily") {
    if (candidate <= after) candidate.setUTCDate(candidate.getUTCDate() + 1);
    return candidate;
  }
  if (trigger.frequency === "weekly") {
    const shift = (trigger.weekday! - candidate.getUTCDay() + 7) % 7;
    candidate.setUTCDate(candidate.getUTCDate() + shift);
    if (candidate <= after) candidate.setUTCDate(candidate.getUTCDate() + 7);
    return candidate;
  }
  candidate.setUTCDate(trigger.dayOfMonth!);
  if (candidate <= after) candidate.setUTCMonth(candidate.getUTCMonth() + 1, trigger.dayOfMonth!);
  return candidate;
}

export type PlannedLeg = { asset: string; percent: number; amountRaw: string };
export type ExecutionPlan =
  | { status: "pending"; totalRaw: bigint; legs: PlannedLeg[]; capped: boolean; reason: string | null }
  | { status: "skipped"; totalRaw: 0n; legs: []; capped: false; reason: string };

/**
 * Size one run: allocations of the base amount, held under the per-run maximum
 * and what is left of today's cap. Rounding dust stays in the wallet.
 */
export function planExecution(spec: RuleSpec, baseRaw: bigint, spentTodayRaw: bigint): ExecutionPlan {
  const source = RULE_ASSETS[spec.source.asset];
  const maxPerRun = parseUnits(spec.limits.maxPerRun, source.decimals);
  const dailyCap = parseUnits(spec.limits.dailyCap, source.decimals);
  const percentTotal = spec.allocations.reduce((sum, a) => sum + a.percent, 0);
  const requested = (baseRaw * BigInt(percentTotal)) / 100n;
  const remaining = dailyCap > spentTodayRaw ? dailyCap - spentTodayRaw : 0n;
  if (remaining === 0n) return { status: "skipped", totalRaw: 0n, legs: [], capped: false, reason: "Daily cap reached" };
  let total = requested;
  let reason: string | null = null;
  if (total > maxPerRun) { total = maxPerRun; reason = "Reduced to your maximum per run"; }
  if (total > remaining) { total = remaining; reason = "Reduced to what is left of today's cap"; }
  if (total <= 0n) return { status: "skipped", totalRaw: 0n, legs: [], capped: false, reason: "Amount too small to split" };
  const legs = spec.allocations.map((a) => ({ asset: a.asset, percent: a.percent, amountRaw: ((total * BigInt(a.percent)) / BigInt(percentTotal)).toString() }));
  if (legs.some((leg) => leg.amountRaw === "0")) return { status: "skipped", totalRaw: 0n, legs: [], capped: false, reason: "Amount too small to split" };
  const planned = legs.reduce((sum, leg) => sum + BigInt(leg.amountRaw), 0n);
  return { status: "pending", totalRaw: planned, legs, capped: reason !== null, reason };
}
