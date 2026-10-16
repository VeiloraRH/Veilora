import { useQuery } from '@tanstack/react-query';
import { getAddress, keccak256, stringToHex, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { API_BASE } from './api';
import { ROBINHOOD_TOKEN_REGISTRY as TOKENS } from './tokens';
import { amountText } from './walletChain';
import { useWallet } from './walletContext';

export type RuleTrigger =
 | { type: 'incoming'; asset: string; minAmount: string }
 | { type: 'schedule'; frequency: 'daily' | 'weekly' | 'monthly'; hourUtc: number; weekday?: number; dayOfMonth?: number }
 | { type: 'price'; asset: string; direction: 'above' | 'below'; priceUsdg: string };
export type SendAction = { type: 'send'; recipient: string; recipientName: string; percent?: number };
export type RuleSpec = { version: 1; name: string; trigger: RuleTrigger; source: { asset: string; amount?: string }; allocations: { asset: string; percent: number }[]; action?: SendAction; limits: { maxPerRun: string; dailyCap: string; slippageBps: number; expiresAt: string }; mode: 'approval' };
export type WalletRule = { id: string; name: string; status: 'active' | 'paused' | 'revoked' | 'expired'; mode: 'approval'; spec: RuleSpec; expiresAt: string; nextRunAt: string | null; lastPriceRaw: string | null; lastCheckedAt: string | null; lastTriggeredAt: string | null; createdAt: string };
export type RuleExecution = { id: string; ruleId: string; ruleName: string; status: 'pending' | 'executed' | 'failed' | 'declined' | 'skipped' | 'expired'; trigger: { kind: string; baseRaw?: string; txHash?: string; asset?: string; priceRaw?: string; dueAt?: string }; sourceAsset: string; totalRaw: string; legs: { asset: string; percent: number; amountRaw: string; recipient?: string; recipientName?: string }[]; slippageBps: number; reason: string | null; txHashes: string[]; error: string | null; createdAt: string; expiresAt: string; resolvedAt: string | null };
export type RulesState = { automaticExecutionAvailable: boolean; rules: WalletRule[]; executions: RuleExecution[] };
export type RuleExecutionPage = { executions: RuleExecution[]; page: number; pageSize: number; total: number; pages: number };

// These strings must match backend/src/routes/rules.ts exactly.
const readMessage = (w: string, ts: number) => `Veilora wallet rules access\nwallet:${getAddress(w)}\ntimestamp:${ts}`;
const createMessage = (w: string, hash: string, ts: number) => `Veilora wallet rule\naction:create\nwallet:${getAddress(w)}\nspec:${hash}\ntimestamp:${ts}`;
const statusMessage = (w: string, id: string, action: string, ts: number) => `Veilora wallet rule\naction:${action}\nwallet:${getAddress(w)}\nrule:${id}\ntimestamp:${ts}`;
const resolveMessage = (w: string, id: string, outcome: string, hashes: string[], ts: number) => `Veilora rule execution\naction:${outcome}\nwallet:${getAddress(w)}\nexecution:${id}\ntx:${hashes.join(',')}\ntimestamp:${ts}`;

const now = () => Math.floor(Date.now() / 1000);
const sign = (key: Hex, message: string) => privateKeyToAccount(key).signMessage({ message });
async function call<T>(path: string, init: RequestInit): Promise<T> {
 const response = await fetch(`${API_BASE}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } });
 const body = await response.json().catch(() => ({}));
 if (!response.ok) throw new Error(body.error || `Request failed with status ${response.status}`);
 return body as T;
}

export async function fetchRules(wallet: string, key: Hex): Promise<RulesState> {
 const ts = now();
 return call(`/v1/wallets/${wallet}/rules`, { method: 'GET', headers: { 'x-veilora-timestamp': String(ts), 'x-veilora-signature': await sign(key, readMessage(wallet, ts)) } });
}
export async function fetchRuleExecutions(wallet: string, key: Hex, page: number, status: string, search: string): Promise<RuleExecutionPage> {
 const ts = now(); const params = new URLSearchParams({ page: String(page), pageSize: '20', status, search });
 return call(`/v1/wallets/${wallet}/rules/executions?${params}`, { method: 'GET', headers: { 'x-veilora-timestamp': String(ts), 'x-veilora-signature': await sign(key, readMessage(wallet, ts)) } });
}
export async function createRule(wallet: string, key: Hex, spec: RuleSpec): Promise<WalletRule> {
 const json = JSON.stringify(spec); const ts = now();
 return call(`/v1/wallets/${wallet}/rules`, { method: 'POST', body: JSON.stringify({ spec: json, timestamp: ts, shardASignature: await sign(key, createMessage(wallet, keccak256(stringToHex(json)), ts)) }) });
}
export async function setRuleStatus(wallet: string, key: Hex, id: string, action: 'pause' | 'resume' | 'revoke'): Promise<WalletRule> {
 const ts = now();
 return call(`/v1/wallets/${wallet}/rules/${id}/status`, { method: 'POST', body: JSON.stringify({ action, timestamp: ts, shardASignature: await sign(key, statusMessage(wallet, id, action, ts)) }) });
}
export async function resolveExecution(wallet: string, key: Hex, id: string, outcome: 'executed' | 'failed' | 'declined', txHashes: string[] = [], error?: string): Promise<RuleExecution> {
 const ts = now(); const hashes = txHashes.map(h => h.toLowerCase());
 return call(`/v1/wallets/${wallet}/rules/executions/${id}/resolve`, { method: 'POST', body: JSON.stringify({ outcome, txHashes: hashes, error, timestamp: ts, shardASignature: await sign(key, resolveMessage(wallet, id, outcome, hashes, ts)) }) });
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const hourLabel = (hourUtc: number) => `${String(hourUtc).padStart(2, '0')}:00 UTC`;
export const rawText = (raw: string | bigint, symbol: string) => `${amountText(BigInt(raw), TOKENS[symbol]?.decimals ?? 18)} ${symbol}`;

export function describeTrigger(t: RuleTrigger): string {
 if (t.type === 'incoming') return `When ${Number(t.minAmount).toLocaleString()}+ ${t.asset} arrives`;
 if (t.type === 'price') return `When ${t.asset} is ${t.direction} ${Number(t.priceUsdg).toLocaleString()} USDG`;
 if (t.frequency === 'daily') return `Every day at ${hourLabel(t.hourUtc)}`;
 if (t.frequency === 'weekly') return `Every ${WEEKDAYS[t.weekday ?? 0]} at ${hourLabel(t.hourUtc)}`;
 return `On day ${t.dayOfMonth} of every month at ${hourLabel(t.hourUtc)}`;
}
export function describeAction(spec: RuleSpec): string {
 if (spec.action?.type === 'send') return spec.trigger.type === 'incoming'
  ? `send ${spec.action.percent ?? 100}% of what arrives to ${spec.action.recipientName}`
  : `send ${Number(spec.source.amount).toLocaleString()} ${spec.source.asset} to ${spec.action.recipientName}`;
 const split = spec.allocations.map(a => `${a.percent}% into ${a.asset}`).join(' and ');
 return spec.trigger.type === 'incoming' ? `swap ${split} of what arrives` : `swap ${split} of ${Number(spec.source.amount).toLocaleString()} ${spec.source.asset}`;
}
export function describeLimits(spec: RuleSpec): string {
 const { maxPerRun, dailyCap, slippageBps, expiresAt } = spec.limits;
 return `Up to ${Number(maxPerRun).toLocaleString()} ${spec.source.asset} per run and ${Number(dailyCap).toLocaleString()} per day · ${slippageBps / 100}% max slippage · ends ${new Date(expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}
export const WEEKDAY_NAMES = WEEKDAYS;

/** Rules and runs for the active wallet; reads are signed locally with the unlocked device key. */
export function useWalletRules() {
 const {walletAddress,getStoredDeviceKey}=useWallet(); const key=getStoredDeviceKey();
 return useQuery({queryKey:['wallet-rules',walletAddress],enabled:!!walletAddress&&!!key,refetchInterval:30000,retry:1,queryFn:()=>fetchRules(walletAddress,key as Hex)});
}

export function useRuleExecutions(page: number, status: string, search: string) {
 const {walletAddress,getStoredDeviceKey}=useWallet(); const key=getStoredDeviceKey();
 return useQuery({queryKey:['wallet-rule-runs',walletAddress,page,status,search],enabled:!!walletAddress&&!!key,retry:1,refetchInterval:30000,placeholderData:previous=>previous,queryFn:()=>fetchRuleExecutions(walletAddress,key as Hex,page,status,search)});
}
