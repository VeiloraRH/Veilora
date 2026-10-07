import { randomUUID } from "node:crypto";
import { ROBINHOOD_TOKEN_REGISTRY } from "../tokens";

export interface IntentConstraints {
  maxTotalFeeBps: number;
  preserveGas: string; // e.g. "0.05 ETH"
  requireCleanProvenance: boolean;
  destinationAddress?: string;
}

export type ActionType =
  | "shield_swap"
  | "shield_deposit"
  | "shield_lend"
  | "safe_unshield"
  | "transfer"
  | "bridge_rebalance";

export interface StructuredPlan {
  id: string;
  goal: string;
  action: ActionType;
  assetIn: string;
  amountIn: string;
  assetOut?: string;
  isShielded: boolean;
  constraints: IntentConstraints;
  createdAt: string;
}

/**
 * Normalizes a natural-language goal or structured prompt into a deterministic plan.
 */
export function parseIntent(
  goalText: string,
  explicitConstraints?: Partial<IntentConstraints>
): StructuredPlan {
  const text = goalText.trim();
  const lower = text.toLowerCase();

  // 1. Detect Action
  let action: ActionType = "shield_deposit";
  let isShielded = lower.includes("shield") || !lower.includes("public");

  if (lower.includes("buy") || lower.includes("swap")) {
    action = "shield_swap";
  } else if (lower.includes("lend") || lower.includes("yield") || lower.includes("morpho")) {
    action = "shield_lend";
  } else if (lower.includes("unshield") || lower.includes("withdraw")) {
    action = "safe_unshield";
  } else if (lower.includes("bridge") || lower.includes("rebalance")) {
    action = "bridge_rebalance";
  } else if (lower.includes("transfer") || lower.includes("send")) {
    action = "transfer";
  }

  // 2. Parse Assets & Amounts
  // e.g. "Buy 500 USDG of NVDA exposure" -> amount 500, assetIn USDG, assetOut NVDA
  let amountIn = "100";
  let assetIn = "USDG";
  let assetOut: string | undefined = undefined;

  const amountMatch = text.match(/(\d+(?:\.\d+)?)\s*(usdg|usdc|usdt|eth|nvda)/i);
  if (amountMatch) {
    amountIn = amountMatch[1];
    assetIn = amountMatch[2].toUpperCase();
  }

  // Detect target asset for swaps against 45 verified Robinhood tokens
  if (action === "shield_swap") {
    for (const symbol of Object.keys(ROBINHOOD_TOKEN_REGISTRY)) {
      if (symbol !== "USDG" && new RegExp(`\\b${symbol}\\b`, "i").test(text)) {
        assetOut = symbol;
        break;
      }
    }
    if (!assetOut && lower.includes("eth")) {
      assetOut = "ETH";
    }
  }

  // 3. Parse Constraints
  // Fee ceiling detection, e.g. "0.75%" -> 75 bps
  let maxTotalFeeBps = 75; // default 0.75%
  const feeMatch =
    text.match(/(?:(?:fee|cost|max|under|ceiling|limit)[^\d%]*?)(\d+(?:\.\d+)?)\s*%/i) ||
    text.match(/(\d+(?:\.\d+)?)\s*%\s*(?:fee|cost|slippage)/i);
  if (feeMatch) {
    maxTotalFeeBps = Math.round(parseFloat(feeMatch[1]) * 100);
  }

  // Gas reserve detection, e.g. "0.05 ETH reserved for gas"
  let preserveGas = "0.05 ETH";
  const gasMatch = text.match(/(\d+(?:\.\d+)?)\s*eth\s*(?:reserved|for gas|gas)/i);
  if (gasMatch) {
    preserveGas = `${gasMatch[1]} ETH`;
  }

  const cleanProv = lower.includes("clean") || lower.includes("provenance") || !lower.includes("unscreened");

  const constraints: IntentConstraints = {
    maxTotalFeeBps: explicitConstraints?.maxTotalFeeBps ?? maxTotalFeeBps,
    preserveGas: explicitConstraints?.preserveGas ?? preserveGas,
    requireCleanProvenance: explicitConstraints?.requireCleanProvenance ?? cleanProv,
    destinationAddress: explicitConstraints?.destinationAddress,
  };

  return {
    id: randomUUID(),
    goal: text,
    action,
    assetIn,
    amountIn,
    assetOut,
    isShielded,
    constraints,
    createdAt: new Date().toISOString(),
  };
}
