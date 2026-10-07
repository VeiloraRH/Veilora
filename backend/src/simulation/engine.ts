import type { StructuredPlan } from "../intent/parser";

export interface BalanceDiff {
  asset: string;
  before: string;
  after: string;
  delta: string;
  isShielded: boolean;
}

export interface DisclosureDetail {
  surface: string;
  visibleData: string;
  guarantee: string;
}

export interface PlanSimulation {
  planId: string;
  isValid: boolean;
  status: "eligible" | "policy_blocked" | "insufficient_gas";
  route: string[];
  balanceDiffs: BalanceDiff[];
  estimatedFees: {
    totalFeeBps: number;
    gasFeeEstimateWei: string;
    protocolFeeUSDG: string;
    provingFeeUSDG: string;
  };
  gasReserveStatus: {
    reservedGasEth: string;
    isPreserved: boolean;
  };
  disclosures: DisclosureDetail[];
  provingLatencyTargetSeconds: number;
  expectedCommitmentPreview?: string;
  warnings: string[];
}

// Mock oracle pricing for Robinhood Chain settlement (1 NVDA = ~130.8 USDG)
const NVDA_PRICE_USDG = 130.82;

/**
 * Simulates the deterministic effects of an approved plan before threshold authorization.
 */
export async function simulatePlan(
  plan: StructuredPlan,
  currentPublicUSDG: number = 2500,
  currentGasEth: number = 0.15
): Promise<PlanSimulation> {
  const amountNum = parseFloat(plan.amountIn) || 0;
  const warnings: string[] = [];

  // Check gas reservation floor
  const gasReserved = parseFloat(plan.constraints.preserveGas.replace(/[^\d.]/g, "")) || 0.05;
  const gasPreserved = currentGasEth - 0.002 >= gasReserved;
  if (!gasPreserved) {
    warnings.push(`Action would violate gas reserve floor of ${plan.constraints.preserveGas}`);
  }

  const balanceDiffs: BalanceDiff[] = [];
  let totalFeeBps = 32; // base 0.32%
  let route: string[] = [];

  if (plan.action === "shield_swap" && plan.assetOut === "NVDA") {
    const receivedStock = (amountNum * 0.9968) / NVDA_PRICE_USDG;
    route = [
      "Shield USDG to Join-Split Pool",
      "Route via Uniswap V3 Pool (0.05% fee tier)",
      "Mint Shielded NVDA UTXO Note",
    ];

    balanceDiffs.push({
      asset: "USDG",
      before: `${currentPublicUSDG.toFixed(2)} USDG`,
      after: `${(currentPublicUSDG - amountNum).toFixed(2)} USDG`,
      delta: `-${amountNum.toFixed(2)} USDG`,
      isShielded: false,
    });

    balanceDiffs.push({
      asset: "NVDA",
      before: "0.0000 NVDA",
      after: `${receivedStock.toFixed(4)} NVDA`,
      delta: `+${receivedStock.toFixed(4)} NVDA`,
      isShielded: true,
    });
  } else if (plan.action === "safe_unshield") {
    route = [
      "Verify Clean-Provenance Association Set",
      "Nullify Shielded UTXO Note",
      "Settle USDG to Origin Account",
    ];
    totalFeeBps = 15;

    balanceDiffs.push({
      asset: "USDG",
      before: "0.00 USDG",
      after: `${amountNum.toFixed(2)} USDG`,
      delta: `+${amountNum.toFixed(2)} USDG`,
      isShielded: false,
    });
  } else {
    // Standard Shield deposit
    route = ["Deposit USDG", "Generate Note Commitment", "Insert to Shielded Tree"];
    totalFeeBps = 10;

    balanceDiffs.push({
      asset: plan.assetIn,
      before: `${currentPublicUSDG.toFixed(2)} ${plan.assetIn}`,
      after: `${(currentPublicUSDG - amountNum).toFixed(2)} ${plan.assetIn}`,
      delta: `-${amountNum.toFixed(2)} ${plan.assetIn}`,
      isShielded: false,
    });

    balanceDiffs.push({
      asset: plan.assetIn,
      before: "0.00 (shielded)",
      after: `${amountNum.toFixed(2)} (shielded)`,
      delta: `+${amountNum.toFixed(2)} ${plan.assetIn}`,
      isShielded: true,
    });
  }

  // Check fee ceiling
  if (totalFeeBps > plan.constraints.maxTotalFeeBps) {
    warnings.push(
      `Fee ${totalFeeBps} bps exceeds user constraint limit of ${plan.constraints.maxTotalFeeBps} bps`
    );
  }

  const disclosures: DisclosureDetail[] = [
    {
      surface: "Robinhood Chain Public Ledger",
      visibleData: "Deposit transaction hash and entry point execution gas",
      guarantee: "Recipient address and subsequent note balances are shielded",
    },
    {
      surface: "Co-Signer Policy Service (Shard B)",
      visibleData: "UserOp hash, velocity limit, and fee validation flag",
      guarantee: "Co-signer does not store unencrypted note secrets or recipient history",
    },
    {
      surface: "Proof Provider (PPOI)",
      visibleData: "Blinded witness for association-set membership",
      guarantee: "Provider does not receive raw note amounts or counterparty identity",
    },
  ];

  const isValid = warnings.length === 0;

  return {
    planId: plan.id,
    isValid,
    status: isValid ? "eligible" : "policy_blocked",
    route,
    balanceDiffs,
    estimatedFees: {
      totalFeeBps,
      gasFeeEstimateWei: "1500000000000000", // ~0.0015 ETH
      protocolFeeUSDG: (amountNum * (totalFeeBps / 10000)).toFixed(4),
      provingFeeUSDG: "0.10",
    },
    gasReserveStatus: {
      reservedGasEth: `${gasReserved} ETH`,
      isPreserved: gasPreserved,
    },
    disclosures,
    provingLatencyTargetSeconds: 8,
    expectedCommitmentPreview: "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
    warnings,
  };
}
