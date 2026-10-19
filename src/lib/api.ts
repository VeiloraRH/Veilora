import type { VeilyReceipt } from './veilyReceipt';
import { resolveRpcEndpoint } from './rpcSettings';
import { getAddress, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

export const API_BASE =
  ((import.meta as any).env?.VITE_API_URL as string) || "/api";
const ROBINHOOD_RPC_PROXY = `${API_BASE.replace(/\/$/, "")}/v1/rpc`;

async function rpcRequest(payload: unknown) {
  const response = await fetch(resolveRpcEndpoint(ROBINHOOD_RPC_PROXY), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`RPC proxy returned ${response.status}`);
  return response.json();
}

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

const USDG_CONTRACT = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";

export async function getOnChainBalances(address: string): Promise<{ eth: number; usdg: number }> {
  try {
    const cleanAddr = address.toLowerCase().replace("0x", "").padStart(64, "0");
    const [ethRes, usdgRes] = await Promise.all([
      rpcRequest({
          jsonrpc: "2.0",
          method: "eth_getBalance",
          params: [address, "latest"],
          id: 1,
        }),
      rpcRequest({
          jsonrpc: "2.0",
          method: "eth_call",
          params: [{ to: USDG_CONTRACT, data: "0x70a08231" + cleanAddr }, "latest"],
          id: 2,
        }),
    ]);

    const ethWei = BigInt(ethRes?.result || "0x0");
    const usdgWei = BigInt(usdgRes?.result || "0x0");

    return {
      eth: Number(ethWei) / 1e18,
      usdg: Number(usdgWei) / 1e6,
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

export type VeilyMode = "hosted" | "byok";
export type VeilyProvider = "groq" | "openai" | "anthropic";
export type VeilyAction = { screen: "dashboard" | "market" | "swap" | "bridge" | "history" | "rules"; token?: string; sourceAsset?: "ETH" | "USDG"; destinationChainId?: number; destinationAsset?: string; amount?: string; recipient?: string };
export interface VeilyMessage { role: "user" | "assistant"; content: string; actions?: VeilyAction[]; receipt?: VeilyReceipt }

export async function askVeily(payload: {
  walletAddress: string;
  requestId: string;
  timestamp: number;
  permissionId?: string;
  mode: VeilyMode;
  messages: VeilyMessage[];
  context: string;
  provider?: VeilyProvider;
  model?: string;
  apiKey?: string;
  shardASignature: string;
}): Promise<{ answer: string; actions: VeilyAction[]; provider: string; model: string; receipt?: VeilyReceipt | null }> {
  return request("/v1/veily/chat", { method: "POST", body: JSON.stringify(payload) });
}

export interface VeilySessionPermission {
  id: string;
  purpose: string;
  scopes: Array<"wallet:read" | "activity:read" | "navigation:prepare">;
  status: "active" | "expired" | "revoked";
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export async function listVeilyPermissions(payload: {
  walletAddress: string;
  requestId: string;
  timestamp: number;
  shardASignature: string;
}) {
  return request<{ permissions: VeilySessionPermission[] }>("/v1/veily/permissions/list", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createVeilyPermission(payload: {
  walletAddress: string;
  requestId: string;
  timestamp: number;
  purpose: string;
  requestedScopes: VeilySessionPermission["scopes"];
  expiresAt: string;
  shardASignature: string;
}) {
  return request<{ permission: VeilySessionPermission }>("/v1/veily/permissions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function revokeVeilyPermission(permissionId: string, payload: {
  walletAddress: string;
  requestId: string;
  timestamp: number;
  shardASignature: string;
}) {
  return request<{ permission: VeilySessionPermission }>(`/v1/veily/permissions/${encodeURIComponent(permissionId)}/revoke`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getRelayerStatus() {
  return request<{
    network: { chainId: number; rpcHost: string; blockNumber: string; gasPriceGwei: string };
    relayer: { address: string | null; balanceEth: string; ready: boolean };
    contracts: { factory: string; legacyFactory: string; v2Factory: string | null; usdgToken: string };
  }>("/v1/relayer/status");
}

// ---------------------------------------------------------------------------
// Relay cross-chain quotes and delivery tracking
// ---------------------------------------------------------------------------

export interface BridgeQuoteRequest {
  ownerAddress: string;
  recipient: string;
  originCurrency: string;
  destinationChainId: number;
  destinationCurrency: string;
  amount: string;
}

export interface BridgeQuote {
  requestId: string;
  input: BridgeQuoteRequest;
  amountOut: string;
  minimumAmountOut: string;
  outputDecimals: number;
  outputSymbol: string;
  sourceDecimals: number;
  sourceSymbol: string;
  fees: Record<string, { amountFormatted?: string; amountUsd?: string; currency?: { symbol?: string } }>;
  timeEstimate: number | null;
  steps: Array<{ id: "approve" | "deposit"; to: string; data: `0x${string}`; value: string; chainId: number }>;
  expiresAt: number;
}

export async function getBridgeQuote(input: BridgeQuoteRequest) {
  return request<{ success: true; quote: BridgeQuote }>("/v1/bridge/quote", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface BridgeStatus {
  status: string;
  inTxHashes: string[];
  outTxHashes: string[];
  refundTxHashes: string[];
  updatedAt: string | null;
}

export async function getBridgeStatus(requestId: string) {
  return request<{ success: true; status: BridgeStatus }>(`/v1/bridge/status/${encodeURIComponent(requestId)}`);
}

// ---------------------------------------------------------------------------
// 2-of-3 Threshold Custody & Co-signing
// ---------------------------------------------------------------------------

export interface WalletMetadata {
  address: string;
  chainId: number;
  accountVersion: 1 | 2;
  shardA: string;
  shardB: string;
  shardC: string;
  threshold: number;
  isFrozen: boolean;
  frozenUntil: string | null;
  freezeReason: string | null;
  freezeInitiatedBy?: "device" | "recovery" | null;
  isDeployed: boolean;
  nonce: string;
  createdAt?: string;
}

export async function createWallet(params: {
  accountVersion: 2;
  shardAAddress?: string;
  shardCAddress?: string;
  salt?: string;
  totpSecret?: string;
  deployOnCreate?: boolean;
  requestId?: string;
  timestamp?: number;
  shardASignature?: string;
}) {
  return request<{
    address: string;
    chainId: number;
    factoryAddress: string;
    accountVersion: 2;
    shardA: string;
    shardB: string;
    shardC: string;
    threshold: number;
    salt: string;
    apiKey: string;
    isDeployed: boolean;
  }>("/v1/wallets", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export interface QuorumStatus {
  address: string;
  threshold: number;
  registered: { shardA: string; shardB: string; shardC: string };
  deployed: boolean;
  chainError: string | null;
  onChain: { shardA: string; shardB: string; shardC: string; nonce: string } | null;
  matches: { shardA: boolean; shardB: boolean; shardC: boolean } | null;
  freeze: { frozen: boolean; frozenUntil: string | null; reason: string | null; initiatedBy: "device" | "recovery" | null };
  coSigner: { signing: boolean; approvals30d: number; rejections30d: number; lastApprovedAt: string | null; lastRejectedAt: string | null };
  recoveryPaths: { deviceAndCoSigner: "available"; recoveryKeyFreeze: "available"; recoveryKeyRotation: "available" | "planned" };
}

// ---------------------------------------------------------------------------
// Add funds (card / bank via MoonPay)
// ---------------------------------------------------------------------------

export type OnrampAsset = "USDG" | "ETH";
export interface OnrampConfig { enabled: boolean; provider: string; sandbox: boolean; assets: { asset: OnrampAsset; route: "direct" | "relay"; network: string }[] }
export interface OnrampSession { sessionId: string; url: string; asset: OnrampAsset; route: "direct" | "relay"; network: string; depositAddress: string | null; timeEstimateSeconds: number | null }
export interface OnrampDelivery { requestId: string | null; state: "waiting" | "delivering" | "delivered" | "refunded" | "failed"; amountOut: string | null; outTxHash: string | null; updatedAt: string | null }
export interface OnrampSessionStatus { sessionId: string; asset: OnrampAsset; route: "direct" | "relay"; deliveries: OnrampDelivery[]; note: string | null }

export async function getOnrampConfig() {
  return request<OnrampConfig>("/v1/onramp/config");
}
export async function createOnrampSession(walletAddress: string, asset: OnrampAsset, fiatAmount?: number) {
  return request<OnrampSession>("/v1/onramp/session", { method: "POST", body: JSON.stringify({ walletAddress, asset, fiatAmount }) });
}
export async function getOnrampSession(sessionId: string) {
  return request<OnrampSessionStatus>(`/v1/onramp/session/${encodeURIComponent(sessionId)}`);
}

// ---------------------------------------------------------------------------
// Transaction explanations
// ---------------------------------------------------------------------------

export type ExplainFlag = { level: "info" | "warn" | "danger"; code: string; text: string };
export type ExplainEffect = { direction: "out" | "in" | "permission"; asset: string; amount: string | null; raw: string | null; counterparty: string | null };
export interface TxExplanation { kind: string; title: string; summary: string[]; effects: ExplainEffect[]; flags: ExplainFlag[]; target: { address: string; label: string }; status?: "success" | "reverted"; gasPaidBy?: "relayer" | "you" | "sender"; feeEth?: string | null }

export async function explainCalls(walletAddress: string, calls: { target: string; value: bigint; data: string }[]) {
  return request<{ level: "info" | "warn" | "danger"; explanations: TxExplanation[] }>("/v1/explain", {
    method: "POST",
    body: JSON.stringify({ walletAddress, calls: calls.map((c) => ({ target: c.target, value: c.value.toString(), data: c.data })) }),
  });
}
export async function explainTransaction(walletAddress: string, hash: string) {
  return request<TxExplanation>(`/v1/wallets/${encodeURIComponent(walletAddress)}/explain/${encodeURIComponent(hash)}`);
}

export async function getQuorumStatus(address: string) {
  return request<QuorumStatus>(`/v1/wallets/${encodeURIComponent(address)}/quorum`);
}

export async function deleteWalletData(walletAddress: string, timestamp: number, shardASignature: string) {
  return request<{ deleted: boolean; walletAddress: string }>(
    `/v1/wallets/${encodeURIComponent(walletAddress)}`,
    {
      method: "DELETE",
      body: JSON.stringify({ timestamp, shardASignature }),
    },
  );
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

export async function freezeWallet(address: string, hours: number, reason: string, timestamp: number, shardASignature: string) {
  return request<{
    address: string;
    frozen: boolean;
    frozenUntil: string;
    reason: string;
  }>(`/v1/wallets/${address}/freeze`, {
    method: "POST",
    body: JSON.stringify({ hours, reason, timestamp, shardASignature }),
  });
}

export async function unfreezeWallet(address: string, timestamp: number, shardASignature: string) {
  return request<{
    address: string;
    frozen: boolean;
    frozenUntil: null;
    reason: null;
  }>(`/v1/wallets/${address}/unfreeze`, {
    method: "POST",
    body: JSON.stringify({ timestamp, shardASignature }),
  });
}

export async function getWalletAudit(address: string, shardAKey: Hex) {
  const timestamp = Math.floor(Date.now() / 1000);
  const message = `Veilora wallet audit access\nwallet:${getAddress(address)}\ntimestamp:${timestamp}`;
  const signature = await privateKeyToAccount(shardAKey).signMessage({ message });
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
  }>(`/v1/wallets/${address}/audit`, { headers: { "x-veilora-timestamp": String(timestamp), "x-veilora-signature": signature } });
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
