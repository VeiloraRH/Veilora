// Demo data only. Nothing here talks to a chain, a co-signer or a proof provider.

export type Tone = "gold" | "teal" | "coral" | "mist" | "wine" | "cream";

export const NETWORK = { name: "Robinhood Chain", chainId: 4663, block: 18_402_771 };

export const VAULT = {
  label: "Northwind Treasury",
  address: "0x7A3f9c2E41b8D05a6F1e3C27b94d0aE58c1FC91e",
  short: "0x7A3f…C91e",
  shieldedAddress: "vz1q8t4…m2kx9w",
  quorum: "2-of-3",
};

// ---------------------------------------------------------------------------
// Assets and balances

export type ShieldSupport = "live" | "pilot" | "unsupported";

export interface Asset {
  symbol: string;
  name: string;
  kind: "stablecoin" | "native" | "tokenized-stock";
  publicBalance: number;
  shieldedBalance: number;
  priceUsd: number;
  shield: ShieldSupport;
  note?: string;
}

export const ASSETS: Asset[] = [
  { symbol: "USDG", name: "Global Dollar", kind: "stablecoin", publicBalance: 18_420.55, shieldedBalance: 6_250, priceUsd: 1, shield: "live" },
  { symbol: "ETH", name: "Ether (gas)", kind: "native", publicBalance: 0.842, shieldedBalance: 0, priceUsd: 3_412.6, shield: "unsupported", note: "Kept public as the gas reserve" },
  { symbol: "USDC", name: "USD Coin", kind: "stablecoin", publicBalance: 2_100, shieldedBalance: 0, priceUsd: 1, shield: "unsupported", note: "Shielding waits on adapter support" },
  { symbol: "NVDAx", name: "NVIDIA tokenized share", kind: "tokenized-stock", publicBalance: 0, shieldedBalance: 3.8219, priceUsd: 131.42, shield: "pilot", note: "Gate 4 pilot. Issuer and legal model under review" },
];

export const GAS_RESERVE = { asset: "ETH", reserved: 0.05, available: 0.842 };

export function usd(n: number, digits = 2) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function amount(n: number, max = 4) {
  return n.toLocaleString("en-US", { maximumFractionDigits: max });
}

export const TOTALS = (() => {
  const pub = ASSETS.reduce((s, a) => s + a.publicBalance * a.priceUsd, 0);
  const sh = ASSETS.reduce((s, a) => s + a.shieldedBalance * a.priceUsd, 0);
  return { public: pub, shielded: sh, total: pub + sh };
})();

// ---------------------------------------------------------------------------
// Shielded notes

export interface Note {
  id: string;
  asset: string;
  amount: number;
  commitment: string;
  created: string;
  status: "spendable" | "pending" | "spent";
  origin: string;
}

export const NOTES: Note[] = [
  { id: "n-0192", asset: "USDG", amount: 4_000, commitment: "0x1c9e…a04f", created: "Oct 4, 14:02", status: "spendable", origin: "Shield from vault" },
  { id: "n-0193", asset: "USDG", amount: 2_250, commitment: "0x88b2…13de", created: "Oct 5, 09:41", status: "spendable", origin: "Shielded receive" },
  { id: "n-0197", asset: "NVDAx", amount: 3.8219, commitment: "0x4fa0…9b7c", created: "Oct 6, 11:18", status: "spendable", origin: "Recipe: shield → swap" },
  { id: "n-0198", asset: "USDG", amount: 1_000, commitment: "0xd31a…6e20", created: "Oct 6, 15:55", status: "pending", origin: "Shield (awaiting proof)" },
  { id: "n-0171", asset: "USDG", amount: 750, commitment: "0x02fe…c9a1", created: "Sep 28, 18:30", status: "spent", origin: "Unshield to origin" },
];

// ---------------------------------------------------------------------------
// Intent plans (the console matches a typed goal to one of these)

export type Visibility = "public" | "shielded" | "provider" | "local";

export interface PlanStep {
  label: string;
  detail: string;
  visibility: Visibility;
}

export interface PolicyCheck {
  rule: string;
  result: "pass" | "warn" | "fail";
  detail: string;
}

export interface Plan {
  id: string;
  keywords: string[];
  goal: string;
  constraints: { label: string; value: string }[];
  steps: PlanStep[];
  diff: { label: string; before: string; after: string; tone: Tone }[];
  costs: { label: string; value: string }[];
  totalFeeBps: number;
  limitBps: number;
  policy: PolicyCheck[];
  disclosures: { party: string; sees: string }[];
  route: string;
  eta: string;
}

export const PLANS: Plan[] = [
  {
    id: "plan-nvda",
    keywords: ["nvda", "stock", "buy", "exposure"],
    goal: "Buy 500 USDG of NVDA exposure and keep it shielded. Do not proceed if the total cost exceeds 0.75%.",
    constraints: [
      { label: "Max total cost", value: "0.75% (75 bps)" },
      { label: "Output", value: "Shielded note" },
      { label: "Gas reserve", value: "Keep 0.05 ETH" },
      { label: "Clean provenance", value: "Required" },
    ],
    steps: [
      { label: "Shield 500 USDG", detail: "Public USDG moves into a new shielded note", visibility: "public" },
      { label: "Swap USDG → NVDAx", detail: "Uniswap V3 pool via RelayAdapt, inside one atomic plan", visibility: "shielded" },
      { label: "Receive shielded NVDAx", detail: "Output lands as a note only your keys can open", visibility: "shielded" },
      { label: "Clean-provenance proof", detail: "Proof against the Sep 30 association set", visibility: "provider" },
    ],
    diff: [
      { label: "Public USDG", before: "18,420.55", after: "17,920.55", tone: "coral" },
      { label: "Shielded NVDAx", before: "3.8219", after: "7.6142", tone: "teal" },
      { label: "Gas reserve (ETH)", before: "0.842", after: "0.8391", tone: "mist" },
    ],
    costs: [
      { label: "Swap fee + slippage", value: "0.24%" },
      { label: "Proving (local)", value: "0.00%" },
      { label: "Broadcaster fee", value: "0.08%" },
      { label: "Gas", value: "0.0029 ETH" },
    ],
    totalFeeBps: 34,
    limitBps: 75,
    policy: [
      { rule: "Total cost ceiling", result: "pass", detail: "0.34% is under the 0.75% limit" },
      { rule: "Gas reserve", result: "pass", detail: "0.839 ETH stays above the 0.05 ETH floor" },
      { rule: "Daily spend limit", result: "pass", detail: "500 of 10,000 USDG used today" },
      { rule: "Asset eligibility", result: "warn", detail: "NVDAx is a Gate 4 pilot asset. Eligibility confirmed for this vault only" },
      { rule: "Clean provenance", result: "pass", detail: "Inputs are in the Sep 30 association set" },
    ],
    disclosures: [
      { party: "Robinhood Chain (public)", sees: "A 500 USDG shield deposit from your vault address" },
      { party: "Co-signer (Shard B)", sees: "Plan hash, policy result and amounts. No note contents" },
      { party: "Broadcaster", sees: "The proof and its fee. Cannot change the destination" },
      { party: "Proof provider", sees: "Commitments being checked. No raw notes or history" },
    ],
    route: "Shield → Uniswap V3 (RelayAdapt) → Shielded note",
    eta: "~45 s after the second signature",
  },
  {
    id: "plan-rebalance",
    keywords: ["move", "optimism", "rebalance", "idle", "bridge", "%"],
    goal: "Move 20% of idle USDG to Optimism, keep 0.05 ETH reserved for gas, and only use routes under 0.5% total fees.",
    constraints: [
      { label: "Amount", value: "20% of idle USDG (3,684.11)" },
      { label: "Destination", value: "Optimism · same vault" },
      { label: "Max total fees", value: "0.5% (50 bps)" },
      { label: "Gas reserve", value: "Keep 0.05 ETH" },
    ],
    steps: [
      { label: "Select route", detail: "3 bridge routes compared, 1 is under the fee ceiling", visibility: "local" },
      { label: "Bridge 3,684.11 USDG", detail: "Across bridge adapter, Robinhood Chain → Optimism", visibility: "public" },
      { label: "Confirm on destination", detail: "Settlement monitor waits for finality on Optimism", visibility: "public" },
    ],
    diff: [
      { label: "USDG on Robinhood Chain", before: "18,420.55", after: "14,736.44", tone: "coral" },
      { label: "USDG on Optimism", before: "0.00", after: "3,679.69", tone: "teal" },
      { label: "Gas reserve (ETH)", before: "0.842", after: "0.8384", tone: "mist" },
    ],
    costs: [
      { label: "Bridge fee", value: "0.09%" },
      { label: "Destination gas", value: "0.03%" },
      { label: "Gas", value: "0.0036 ETH" },
    ],
    totalFeeBps: 12,
    limitBps: 50,
    policy: [
      { rule: "Fee ceiling", result: "pass", detail: "0.12% is under the 0.5% limit" },
      { rule: "Destination allowlist", result: "pass", detail: "Optimism vault address is allowlisted" },
      { rule: "Gas reserve", result: "pass", detail: "0.838 ETH stays above the 0.05 ETH floor" },
      { rule: "Large transfer cooling-off", result: "warn", detail: "Over 2,500 USDG: a 10-minute review window applies" },
    ],
    disclosures: [
      { party: "Both chains (public)", sees: "The bridge transfer, amount and both vault addresses" },
      { party: "Bridge solver", sees: "Route, amount and destination" },
      { party: "Co-signer (Shard B)", sees: "Plan hash, policy result and amounts" },
    ],
    route: "Across bridge adapter · Robinhood Chain → Optimism",
    eta: "~3 min after cooling-off",
  },
  {
    id: "plan-shield",
    keywords: ["shield", "protect", "private", "hide"],
    goal: "Shield 2,000 USDG and keep the rest public for payroll.",
    constraints: [
      { label: "Amount", value: "2,000 USDG" },
      { label: "Output", value: "Shielded note" },
      { label: "Clean provenance", value: "Required" },
    ],
    steps: [
      { label: "Shield 2,000 USDG", detail: "Deposit into the shielded pool as one new note", visibility: "public" },
      { label: "Clean-provenance proof", detail: "Proof against the Sep 30 association set", visibility: "provider" },
      { label: "Note created", detail: "Commitment recorded, receipt saved locally", visibility: "shielded" },
    ],
    diff: [
      { label: "Public USDG", before: "18,420.55", after: "16,420.55", tone: "coral" },
      { label: "Shielded USDG", before: "6,250.00", after: "8,250.00", tone: "teal" },
      { label: "Gas reserve (ETH)", before: "0.842", after: "0.8402", tone: "mist" },
    ],
    costs: [
      { label: "Shield fee", value: "0.25%" },
      { label: "Proving (local)", value: "0.00%" },
      { label: "Gas", value: "0.0018 ETH" },
    ],
    totalFeeBps: 25,
    limitBps: 100,
    policy: [
      { rule: "Daily spend limit", result: "pass", detail: "2,000 of 10,000 USDG used today" },
      { rule: "Gas reserve", result: "pass", detail: "0.840 ETH stays above the 0.05 ETH floor" },
      { rule: "Clean provenance", result: "pass", detail: "Inputs are in the Sep 30 association set" },
    ],
    disclosures: [
      { party: "Robinhood Chain (public)", sees: "A 2,000 USDG shield deposit from your vault address" },
      { party: "Co-signer (Shard B)", sees: "Plan hash, policy result and amount" },
      { party: "Proof provider", sees: "The new commitment being checked" },
    ],
    route: "Vault → Shielded pool",
    eta: "~30 s after the second signature",
  },
];

export const INTENT_SUGGESTIONS = PLANS.map((p) => p.goal);

export function matchPlan(text: string): Plan {
  const t = text.toLowerCase();
  let best = PLANS[0];
  let score = -1;
  for (const p of PLANS) {
    const s = p.keywords.filter((k) => t.includes(k)).length;
    if (s > score) {
      best = p;
      score = s;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Outbox

export type SigState = "signed" | "pending" | "standby";

export interface OutboxItem {
  id: string;
  title: string;
  planId: string;
  created: string;
  status: "awaiting-approval" | "collecting-signatures" | "proof-pending" | "cooling-off" | "ready" | "blocked";
  signatures: { A: SigState; B: SigState; C: SigState };
  policy: "pass" | "warn" | "fail";
  broadcaster: string;
  expires: string;
  amountUsd: number;
}

export const OUTBOX: OutboxItem[] = [
  { id: "ob-311", title: "Buy 500 USDG of NVDAx, keep shielded", planId: "plan-nvda", created: "2 min ago", status: "awaiting-approval", signatures: { A: "pending", B: "pending", C: "standby" }, policy: "warn", broadcaster: "Lantern Relay", expires: "in 28 min", amountUsd: 500 },
  { id: "ob-310", title: "Move 20% of idle USDG to Optimism", planId: "plan-rebalance", created: "14 min ago", status: "cooling-off", signatures: { A: "signed", B: "signed", C: "standby" }, policy: "warn", broadcaster: "Direct (public)", expires: "cooling-off 6:12 left", amountUsd: 3_684.11 },
  { id: "ob-309", title: "Shield 1,000 USDG", planId: "plan-shield", created: "38 min ago", status: "proof-pending", signatures: { A: "signed", B: "signed", C: "standby" }, policy: "pass", broadcaster: "Quay Network", expires: "refund at 16:10 if no proof", amountUsd: 1_000 },
  { id: "ob-305", title: "Send 12,000 USDG to new address", planId: "plan-shield", created: "Yesterday", status: "blocked", signatures: { A: "signed", B: "pending", C: "standby" }, policy: "fail", broadcaster: "—", expires: "Blocked by policy", amountUsd: 12_000 },
];

export const OUTBOX_STATUS: Record<OutboxItem["status"], { label: string; tone: Tone }> = {
  "awaiting-approval": { label: "Awaiting your approval", tone: "gold" },
  "collecting-signatures": { label: "Collecting signatures", tone: "gold" },
  "proof-pending": { label: "Proof pending", tone: "teal" },
  "cooling-off": { label: "Cooling-off", tone: "cream" },
  ready: { label: "Ready to submit", tone: "teal" },
  blocked: { label: "Blocked", tone: "coral" },
};

// The PPOI standby flow from the product doc. Every state is explicit.
export const PROOF_STATES = ["Proof requested", "Provider pending", "Proof accepted", "Action eligible", "Timeout / safe refund"];

// ---------------------------------------------------------------------------
// Activity and local receipts

export interface Receipt {
  id: string;
  title: string;
  kind: "shield" | "unshield" | "swap" | "send" | "receive" | "bridge" | "recipe" | "disclosure";
  status: "settled" | "pending" | "refunded" | "blocked";
  time: string;
  route: string;
  fee: string;
  proof: string;
  provedOn: "This device" | "Server-assisted (blinded)" | "—";
  commitment?: string;
  tx?: string;
}

export const RECEIPTS: Receipt[] = [
  { id: "r-1048", title: "Shield → swap → shielded NVDAx", kind: "recipe", status: "settled", time: "Oct 6, 11:18", route: "Shield → Uniswap V3 → note", fee: "0.31%", proof: "Accepted (Sep 30 set)", provedOn: "This device", commitment: "0x4fa0…9b7c", tx: "0x9e1b…77ac" },
  { id: "r-1047", title: "Received 2,250 USDG (shielded)", kind: "receive", status: "settled", time: "Oct 5, 09:41", route: "Shielded receive address", fee: "—", proof: "Not required", provedOn: "—", commitment: "0x88b2…13de" },
  { id: "r-1046", title: "Auditor view key issued", kind: "disclosure", status: "settled", time: "Oct 5, 08:12", route: "Local", fee: "—", proof: "—", provedOn: "—" },
  { id: "r-1045", title: "Shield 4,000 USDG", kind: "shield", status: "settled", time: "Oct 4, 14:02", route: "Vault → shielded pool", fee: "0.25%", proof: "Accepted (Sep 30 set)", provedOn: "Server-assisted (blinded)", commitment: "0x1c9e…a04f", tx: "0x31cd…02be" },
  { id: "r-1044", title: "Swap 1,200 USDC → USDG", kind: "swap", status: "settled", time: "Oct 3, 17:26", route: "Uniswap V3 (public)", fee: "0.05%", proof: "Not required", provedOn: "—", tx: "0x7d40…ee19" },
  { id: "r-1043", title: "Unshield 750 USDG to origin", kind: "unshield", status: "settled", time: "Sep 28, 18:30", route: "Shielded pool → vault (origin)", fee: "0.25%", proof: "Accepted (Sep 21 set)", provedOn: "This device", tx: "0xa2f8…5c03" },
  { id: "r-1042", title: "Shield 300 USDG", kind: "shield", status: "refunded", time: "Sep 27, 10:04", route: "Vault → shielded pool", fee: "Gas only", proof: "Provider timeout, refunded", provedOn: "—", tx: "0x55e1…b9d2" },
];

// ---------------------------------------------------------------------------
// Policies

export interface Policy {
  id: string;
  name: string;
  rule: string;
  scope: string;
  enabled: boolean;
  kind: "limit" | "allowlist" | "fee" | "provenance" | "reserve" | "timing";
}

export const POLICIES: Policy[] = [
  { id: "p-01", name: "Daily spend limit", rule: "Up to 10,000 USDG per day across all assets", scope: "All actions", enabled: true, kind: "limit" },
  { id: "p-02", name: "Fee ceiling", rule: "Block any plan whose total cost is over 1.00%", scope: "Swaps, bridges, recipes", enabled: true, kind: "fee" },
  { id: "p-03", name: "Gas reserve", rule: "Always keep at least 0.05 ETH public for gas", scope: "All actions", enabled: true, kind: "reserve" },
  { id: "p-04", name: "Destination allowlist", rule: "Sends and bridges go only to 6 allowlisted addresses", scope: "Send, bridge, unshield", enabled: true, kind: "allowlist" },
  { id: "p-05", name: "Clean provenance", rule: "Shielded inputs must prove membership in a set under 7 days old", scope: "Shield, unshield, recipes", enabled: true, kind: "provenance" },
  { id: "p-06", name: "Large transfer cooling-off", rule: "Over 2,500 USDG waits 10 minutes before submission", scope: "Send, bridge, unshield", enabled: true, kind: "timing" },
  { id: "p-07", name: "New destination review", rule: "A first send to any address needs a new review and a 24-hour delay", scope: "Send, unshield", enabled: false, kind: "timing" },
];

export const POLICY_VERSIONS = [
  { version: "v14", date: "Oct 2", author: "Shard A + B", change: "Raised daily limit 7,500 → 10,000 USDG" },
  { version: "v13", date: "Sep 24", author: "Shard A + B", change: "Added clean-provenance freshness of 7 days" },
  { version: "v12", date: "Sep 11", author: "Shard A + C", change: "Added Optimism vault to the destination allowlist" },
];

// ---------------------------------------------------------------------------
// Disclosure: view keys and clean-provenance proofs

export interface ViewKey {
  id: string;
  holder: string;
  scope: string;
  type: "Account" | "Note" | "Time-limited" | "Tax period" | "Counterparty";
  expires: string;
  status: "active" | "expired" | "revoked";
  lastAccess: string;
}

export const VIEW_KEYS: ViewKey[] = [
  { id: "vk-07", holder: "Harbor & Pike LLP (auditor)", scope: "All shielded USDG activity, Q3 2026", type: "Time-limited", expires: "Oct 31, 2026", status: "active", lastAccess: "Today, 08:40" },
  { id: "vk-06", holder: "Ledgerline (tax tool)", scope: "Tax period 2026 H1 export", type: "Tax period", expires: "Dec 31, 2026", status: "active", lastAccess: "Sep 30" },
  { id: "vk-05", holder: "Counterparty: Arcadia Labs", scope: "Note n-0193 only", type: "Note", expires: "Oct 12, 2026", status: "active", lastAccess: "Never" },
  { id: "vk-03", holder: "Former CFO", scope: "Account-level view", type: "Account", expires: "—", status: "revoked", lastAccess: "Aug 14" },
  { id: "vk-02", holder: "Q2 auditor", scope: "Q2 2026 activity", type: "Time-limited", expires: "Jul 31, 2026", status: "expired", lastAccess: "Jul 29" },
];

export const ACCESS_LOG = [
  { when: "Today, 08:40", who: "Harbor & Pike LLP", what: "Viewed 14 notes (Q3 USDG)" },
  { when: "Oct 5, 08:12", who: "You", what: "Issued vk-07 to Harbor & Pike LLP" },
  { when: "Sep 30, 16:05", who: "Ledgerline", what: "Exported H1 tax period" },
  { when: "Aug 14, 10:30", who: "You", what: "Revoked vk-03 (Former CFO)" },
];

export const PROOFS = [
  {
    id: "pf-22",
    provider: "Association set: Lumen PPOI",
    set: "Lumen clean set #412",
    timestamp: "Sep 30, 2026 00:00 UTC",
    freshness: "6 days old (policy: under 7 days)",
    coverage: "USDG, NVDAx · shield, unshield, swap recipes",
    validUntil: "Oct 7, 2026",
    reveals: "That your input commitments are members of set #412. Nothing about amounts or other notes.",
    fallback: "If Lumen is unavailable, actions wait in 'Provider pending' for up to 15 min, then refund safely.",
    status: "valid" as const,
  },
  {
    id: "pf-19",
    provider: "Association set: Lumen PPOI",
    set: "Lumen clean set #398",
    timestamp: "Sep 21, 2026 00:00 UTC",
    freshness: "15 days old (policy: under 7 days)",
    coverage: "USDG · shield, unshield",
    validUntil: "Sep 28, 2026",
    reveals: "That your input commitments are members of set #398.",
    fallback: "Expired proofs cannot be reused. A new proof is requested automatically.",
    status: "expired" as const,
  },
];

// ---------------------------------------------------------------------------
// Recipes (Step → Recipe → Combo)

export interface Recipe {
  id: string;
  name: string;
  steps: string[];
  summary: string;
  inputs: string;
  outputs: string;
  assets: string;
  contracts: string;
  fees: string;
  proof: string;
  failure: string;
  privacy: string;
  audit: "Audited" | "Audit in progress" | "Testnet only";
  gate: number;
  combo: boolean;
}

export const RECIPES: Recipe[] = [
  { id: "rc-1", name: "Shield USDG", steps: ["Shield"], summary: "Move public USDG into a shielded note.", inputs: "USDG (public)", outputs: "USDG note", assets: "USDG", contracts: "VeiloraShieldPool v1.2", fees: "0.25% + gas", proof: "Clean provenance", failure: "No proof in 15 min → deposit refunded to origin", privacy: "Deposit amount and address are public. The note is not.", audit: "Audited", gate: 2, combo: false },
  { id: "rc-2", name: "Shield → swap → shielded asset", steps: ["Shield", "Swap"], summary: "Buy an asset and receive it straight into the shield.", inputs: "USDG (public or shielded)", outputs: "Asset note", assets: "USDG → NVDAx, ETH", contracts: "ShieldPool v1.2 · RelayAdapt v0.9 · Uniswap V3", fees: "0.25% + pool fee + slippage", proof: "Clean provenance", failure: "Swap reverts → whole combo reverts, nothing moves", privacy: "The pool sees a swap from RelayAdapt, not from your vault.", audit: "Audit in progress", gate: 3, combo: true },
  { id: "rc-3", name: "Shield → lend → monitor yield", steps: ["Shield", "Lend"], summary: "Lend shielded USDG on Morpho and track the position.", inputs: "USDG note", outputs: "Lending position note", assets: "USDG", contracts: "RelayAdapt v0.9 · Morpho Blue", fees: "0.25% + gas", proof: "Clean provenance", failure: "Market paused → funds stay in the note", privacy: "Morpho sees a deposit from RelayAdapt. Yield is protocol risk.", audit: "Testnet only", gate: 3, combo: true },
  { id: "rc-4", name: "Unshield → execute → reshield", steps: ["Unshield", "Swap", "Shield"], summary: "Step out to use a public protocol, then step straight back in.", inputs: "Any supported note", outputs: "New note", assets: "USDG, ETH", contracts: "ShieldPool v1.2 · RelayAdapt v0.9", fees: "0.50% + protocol fee", proof: "Clean provenance on both legs", failure: "Any leg fails → combo reverts to the original note", privacy: "The middle step is public for one block.", audit: "Audit in progress", gate: 3, combo: true },
  { id: "rc-5", name: "Bridge → shield at destination", steps: ["Bridge", "Shield"], summary: "Bridge USDG and shield it on arrival.", inputs: "USDG (public)", outputs: "USDG note on destination", assets: "USDG", contracts: "Across adapter · ShieldPool (destination)", fees: "Bridge fee + 0.25%", proof: "Clean provenance at destination", failure: "Bridge timeout → funds stay public on the destination chain", privacy: "Both chains see the bridge. Only destination support allows shielding.", audit: "Testnet only", gate: 5, combo: true },
];

// ---------------------------------------------------------------------------
// Custody

export const SHARDS = [
  { id: "A", name: "This device", where: "Secure Enclave · MacBook Pro", status: "healthy", lastUsed: "2 min ago", role: "Signs every approval you make here" },
  { id: "B", name: "Policy co-signer", where: "Veilora hosted (customer-deployable)", status: "healthy", lastUsed: "14 min ago", role: "Signs only plans that pass your policies" },
  { id: "C", name: "Passkey / recovery", where: "iPhone passkey + paper backup", status: "standby", lastUsed: "Sep 12 (recovery drill)", role: "Replaces A or B if one is lost" },
] as const;

export const COSIGNER_VISIBILITY = [
  { item: "Plan hash and policy result", sees: true },
  { item: "Amounts and asset types", sees: true },
  { item: "Destination addresses", sees: true },
  { item: "Shielded note contents", sees: false },
  { item: "Your intent text", sees: false },
  { item: "Unrelated wallet history", sees: false },
];

// ---------------------------------------------------------------------------
// Network: adapters, broadcasters, provers

export const ADAPTERS = [
  { name: "Robinhood Chain", type: "Chain", transparent: true, shielded: true, finality: "~2 s soft / ~15 min L1", status: "Live", version: "1.4.0" },
  { name: "ERC-4337 accounts", type: "Account", transparent: true, shielded: false, finality: "Chain", status: "Live", version: "0.7" },
  { name: "Uniswap V3", type: "DEX", transparent: true, shielded: true, finality: "Chain", status: "Live", version: "1.1.2" },
  { name: "Morpho Blue", type: "Lending", transparent: true, shielded: true, finality: "Chain", status: "Testnet", version: "0.3.0" },
  { name: "Across", type: "Bridge", transparent: true, shielded: false, finality: "~2–5 min", status: "Live", version: "2.0.1" },
  { name: "RelayAdapt", type: "Privacy router", transparent: false, shielded: true, finality: "Atomic", status: "Audit in progress", version: "0.9.0" },
];

export const BROADCASTERS = [
  { name: "Lantern Relay", fee: "0.08%", bond: "25,000 USDG", liveness: 99.96, latency: "1.8 s", status: "Primary" },
  { name: "Quay Network", fee: "0.10%", bond: "20,000 USDG", liveness: 99.71, latency: "2.4 s", status: "Fallback" },
  { name: "Ninefold", fee: "0.06%", bond: "10,000 USDG", liveness: 97.2, latency: "4.9 s", status: "Degraded" },
];

export const PROVERS = [
  { name: "This device", kind: "Local", latency: "6.2 s (M2)", privacy: "Highest. Nothing leaves the device", status: "Default" },
  { name: "Veilora prover", kind: "Server-assisted, blinded witness", latency: "2.1 s", privacy: "Sees a blinded witness only", status: "Fallback for mobile" },
];

export const SAFETY_METRICS = [
  { label: "Unilateral-spend incidents", value: "0" },
  { label: "Executions bypassing approval", value: "0" },
  { label: "Funds stuck in proof limbo", value: "0" },
  { label: "Actions with a viewed simulation", value: "100%" },
];
