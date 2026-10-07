import { query } from "../db/index";
import type { StructuredPlan } from "../intent/parser";
import type { PlanSimulation } from "../simulation/engine";

export interface PolicyEvaluationResult {
  passed: boolean;
  violations: string[];
  evaluatedPolicyVersion: number;
  checks: {
    feeCeilingOk: boolean;
    gasReserveOk: boolean;
    assetAllowed: boolean;
    provenanceRequirementSatisfied: boolean;
  };
}

/**
 * Evaluates an intent and simulation against active system policies and guardrails.
 */
export async function evaluatePolicy(
  plan: StructuredPlan,
  simulation: PlanSimulation
): Promise<PolicyEvaluationResult> {
  const violations: string[] = [];

  // 1. Fetch active policy rules from database (or fall back to defaults)
  let maxFeeBps = 75;
  let allowedAssets = ["USDG", "ETH", "NVDA"];
  let requireProvenance = true;
  let policyVersion = 1;

  try {
    const res = await query(
      `SELECT version, max_fee_bps, require_clean_provenance, allowed_assets
       FROM policies WHERE is_active = true
       ORDER BY version DESC LIMIT 1`
    );
    if (res.rows.length > 0) {
      const row = res.rows[0];
      maxFeeBps = row.max_fee_bps;
      allowedAssets = row.allowed_assets || allowedAssets;
      requireProvenance = row.require_clean_provenance;
      policyVersion = row.version;
    }
  } catch {
    // Default safe fallback if database offline during unit test
  }

  // 2. Fee Ceiling Check
  const feeCeilingOk = simulation.estimatedFees.totalFeeBps <= maxFeeBps;
  if (!feeCeilingOk) {
    violations.push(
      `Estimated fee (${simulation.estimatedFees.totalFeeBps} bps) exceeds policy ceiling of ${maxFeeBps} bps`
    );
  }

  // 3. Gas Reserve Check
  const gasReserveOk = simulation.gasReserveStatus.isPreserved;
  if (!gasReserveOk) {
    violations.push(
      `Execution would deplete gas below mandatory reserve of ${simulation.gasReserveStatus.reservedGasEth}`
    );
  }

  // 4. Asset Allowlist Check
  const assetAllowed =
    allowedAssets.includes(plan.assetIn.toUpperCase()) &&
    (!plan.assetOut || allowedAssets.includes(plan.assetOut.toUpperCase()));
  if (!assetAllowed) {
    violations.push(
      `Asset ${plan.assetIn}${plan.assetOut ? ` or ${plan.assetOut}` : ""} is not in approved asset registry: [${allowedAssets.join(", ")}]`
    );
  }

  // 5. Clean Provenance Check
  const provenanceRequirementSatisfied =
    !requireProvenance || plan.constraints.requireCleanProvenance;
  if (!provenanceRequirementSatisfied) {
    violations.push("Policy strictly mandates clean-provenance association proof for shielded flows");
  }

  const passed = violations.length === 0;

  return {
    passed,
    violations,
    evaluatedPolicyVersion: policyVersion,
    checks: {
      feeCeilingOk,
      gasReserveOk,
      assetAllowed,
      provenanceRequirementSatisfied,
    },
  };
}
