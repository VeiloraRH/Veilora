export const API_BASE =
  ((import.meta as any).env?.VITE_API_URL as string) || "https://api.veilorarh.com";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data as T;
}

const ROBINHOOD_RPC = "https://rpc.mainnet.chain.robinhood.com";
const USDG_CONTRACT = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";

export async function getOnChainBalances(address: string): Promise<{ eth: number; usdg: number }> {
  try {
    const cleanAddr = address.toLowerCase().replace("0x", "").padStart(64, "0");
    const [ethRes, usdgRes] = await Promise.all([
      fetch(ROBINHOOD_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_getBalance",
          params: [address, "latest"],
          id: 1,
        }),
      }).then((r) => r.json()),
      fetch(ROBINHOOD_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_call",
          params: [{ to: USDG_CONTRACT, data: "0x70a08231" + cleanAddr }, "latest"],
          id: 2,
        }),
      }).then((r) => r.json()),
    ]);

    const ethWei = BigInt(ethRes?.result || "0x0");
    const usdgWei = BigInt(usdgRes?.result || "0x0");

    return {
      eth: Number(ethWei) / 1e18,
      usdg: Number(usdgWei) / 1e18,
    };
  } catch {
    return { eth: 0, usdg: 0 };
  }
}

// ---------------------------------------------------------------------------
// Network & System Status
// ---------------------------------------------------------------------------

export async function getHealth() {
  return request<{ status: string; timestamp: string; version: string }>("/health");
}

export async function getRelayerStatus() {
  return request<{
    network: { chainId: number; rpcUrl: string; blockNumber: string; gasPriceGwei: string };
    relayer: { address: string | null; balanceEth: string; ready: boolean };
    contracts: { factory: string; shieldedPool: string; usdgToken: string };
  }>("/v1/relayer/status");
}

export async function getAdaptersStatus() {
  return request<{
    activeChain: { chainId: number; name: string; status: string };
    contracts: { factory: string; shieldedPool: string; usdgToken: string };
    integrations: Record<string, string>;
  }>("/v1/adapters/status");
}

// ---------------------------------------------------------------------------
// Composable Recipes
// ---------------------------------------------------------------------------

export interface RecipeItem {
  recipe_id: string;
  name: string;
  description: string;
  steps: string[];
  supported_assets: string[];
  max_slippage_bps: number;
  requires_clean_provenance: boolean;
}

export async function getRecipes() {
  return request<{ recipes: RecipeItem[] }>("/v1/recipes");
}

export async function getRecipeById(id: string) {
  return request<RecipeItem>(`/v1/recipes/${id}`);
}

// ---------------------------------------------------------------------------
// Intent & Simulation Engine
// ---------------------------------------------------------------------------

export interface StructuredPlan {
  id: string;
  goal: string;
  action: string;
  assetIn: string;
  amountIn: string;
  assetOut?: string;
  isShielded: boolean;
  constraints: {
    maxTotalFeeBps: number;
    preserveGas: string;
    requireCleanProvenance: boolean;
    destinationAddress?: string;
  };
  createdAt: string;
}

export interface PlanSimulation {
  planId: string;
  isValid: boolean;
  status: "eligible" | "policy_blocked" | "insufficient_gas";
  route: string[];
  balanceDiffs: Array<{
    asset: string;
    tokenAddress?: string;
    before: string;
    after: string;
    delta: string;
    isShielded: boolean;
  }>;
  estimatedFees: {
    totalFeeBps: number;
    gasFeeEstimateWei: string;
    gasPriceGwei: string;
    protocolFeeUSDG: string;
    provingFeeUSDG: string;
  };
  gasReserveStatus: {
    reservedGasEth: string;
    isPreserved: boolean;
  };
  disclosures: Array<{
    surface: string;
    visibleData: string;
    guarantee: string;
  }>;
  provingLatencyTargetSeconds: number;
  expectedCommitmentPreview: string;
  warnings: string[];
}

export async function parseIntent(goal: string, constraints?: Record<string, any>) {
  return request<StructuredPlan>("/v1/intent/parse", {
    method: "POST",
    body: JSON.stringify({ goal, constraints }),
  });
}

export async function simulateIntent(params: {
  plan?: StructuredPlan;
  goal?: string;
  constraints?: Record<string, any>;
  currentPublicUSDG?: number;
  currentGasEth?: number;
  walletAddress?: string;
}) {
  return request<{ plan: StructuredPlan; simulation: PlanSimulation }>("/v1/intent/simulate", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function evaluatePolicies(plan: StructuredPlan, simulation: PlanSimulation) {
  return request<{
    passed: boolean;
    violations: string[];
    evaluatedPolicyVersion: number;
    checks: {
      feeCeilingOk: boolean;
      gasReserveOk: boolean;
      assetAllowed: boolean;
      provenanceRequirementSatisfied: boolean;
    };
  }>("/v1/policies/evaluate", {
    method: "POST",
    body: JSON.stringify({ plan, simulation }),
  });
}

// ---------------------------------------------------------------------------
// 2-of-3 Threshold Custody & Co-signing
// ---------------------------------------------------------------------------

export interface WalletMetadata {
  address: string;
  chainId: number;
  shardA: string;
  shardB: string;
  shardC: string;
  threshold: number;
  isFrozen: boolean;
  frozenUntil: string | null;
  freezeReason: string | null;
  isDeployed: boolean;
  nonce: string;
  createdAt?: string;
}

export async function createWallet(params: {
  shardAAddress?: string;
  shardCAddress?: string;
  salt?: string;
  totpSecret?: string;
}) {
  return request<{
    address: string;
    chainId: number;
    factoryAddress: string;
    shardA: string;
    shardB: string;
    shardC: string;
    threshold: number;
    salt: string;
    apiKey: string;
    isDeployed: boolean;
    generatedShards?: Record<string, { address: string; privateKey?: string }>;
  }>("/v1/wallets", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function getWallet(address: string) {
  return request<WalletMetadata>(`/v1/wallets/${address}`);
}

export async function cosignTransaction(
  address: string,
  payload: {
    target?: string;
    value?: string;
    data?: string;
    nonce?: number;
    deadline?: number;
    userOpHash?: string;
    digest?: string;
    shardASignature?: string;
  }
) {
  return request<{
    status: "APPROVED";
    walletAddress: string;
    digest: string;
    shardBSignature: string;
    shardBAddress: string;
    combinedSignatures?: string;
  }>(`/v1/wallets/${address}/cosign`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function freezeWallet(address: string, hours = 24, reason = "Emergency freeze") {
  return request<{
    address: string;
    frozen: boolean;
    frozenUntil: string;
    reason: string;
  }>(`/v1/wallets/${address}/freeze`, {
    method: "POST",
    body: JSON.stringify({ hours, reason }),
  });
}

export async function unfreezeWallet(address: string) {
  return request<{
    address: string;
    frozen: boolean;
    frozenUntil: null;
    reason: null;
  }>(`/v1/wallets/${address}/unfreeze`, {
    method: "POST",
  });
}

export async function getWalletAudit(address: string) {
  return request<{
    walletAddress: string;
    records: Array<{
      id: string;
      user_op_hash: string;
      status: string;
      shard_b_signature: string | null;
      metadata: Record<string, any>;
      created_at: string;
    }>;
  }>(`/v1/wallets/${address}/audit`);
}

// ---------------------------------------------------------------------------
// Privacy Plane: Notes, Provenance (PPOI), View Keys
// ---------------------------------------------------------------------------

export async function createShieldedNote(assetSymbol: string, amountWei: string, ownerAddress?: string) {
  return request<{
    note: {
      commitment: string;
      nullifierHash: string;
      assetSymbol: string;
      amountWei: string;
      status: string;
      createdAt: string;
    };
    nullifierSecret: string;
    blindingSecret: string;
  }>("/v1/privacy/notes", {
    method: "POST",
    body: JSON.stringify({ assetSymbol, amountWei, ownerAddress }),
  });
}

export async function verifyNote(commitment: string) {
  return request<{
    exists: boolean;
    isUnspent: boolean;
    asset?: string;
    amountWei?: string;
  }>(`/v1/privacy/notes/${commitment}`);
}

export async function generateProvenanceProof(depositCommitment: string, targetAsset = "USDG") {
  return request<{
    proofId: string;
    setId: string;
    provider: string;
    status: string;
    rootHash: string;
    freshnessTimestamp: string;
    validUntil: string;
    disclosures: { reveals: string; guarantee: string };
    timeoutMinutes: number;
    isEligibleForExecution: boolean;
  }>("/v1/privacy/provenance/prove", {
    method: "POST",
    body: JSON.stringify({ depositCommitment, targetAsset }),
  });
}

export async function getProvenanceSets() {
  return request<{
    sets: Array<{
      set_id: string;
      name: string;
      root_hash: string;
      member_count: string;
      freshness_timestamp: string;
      is_active: boolean;
    }>;
  }>("/v1/privacy/provenance/sets");
}

export async function createViewKey(params: {
  walletAddress: string;
  scope?: string;
  label?: string;
  allowedAssets?: string[];
  validDays?: number;
}) {
  return request<{
    key_id: string;
    wallet_address: string;
    scope: string;
    label: string;
    allowed_assets: string[];
    valid_until: string;
    viewKeyToken: string;
  }>("/v1/privacy/viewkeys", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function inspectViewKey(token: string) {
  return request<{
    valid: boolean;
    viewKey: {
      key_id: string;
      wallet_address: string;
      scope: string;
      label: string;
      allowed_assets: string[];
      valid_until: string;
      access_count: number;
      last_accessed_at: string;
    };
  }>(`/v1/privacy/viewkeys/${token}`);
}

// ---------------------------------------------------------------------------
// Relayer Broadcasting (Execution Hook)
// ---------------------------------------------------------------------------

export async function broadcastTransaction(payload: {
  walletAddress: string;
  target: string;
  value?: string;
  data?: string;
  nonce: number;
  deadline: number;
  signatures: string;
}) {
  return request<{
    success: boolean;
    transactionHash: string;
    blockNumber: string;
    gasUsed: string;
    walletAddress: string;
    target: string;
    nonce: string;
  }>("/v1/relayer/broadcast", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
