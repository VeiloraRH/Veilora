/* Launch gates, from "VEILORA — Integrated Product Approach" §10 and §12. */

export type GateStatus = "Building" | "Next" | "Planned" | "Later";

export type Gate = {
  n: number;
  name: string;
  short: string;
  status: GateStatus;
  why: string;
  items: string[];
  opens: string;
};

export const GATES: Gate[] = [
  {
    n: 1,
    name: "Trustworthy control core",
    short: "Control core",
    status: "Building",
    why: "Privacy is only as safe as the authorization around it. The control loop ships first, before any shielded DeFi.",
    items: [
      "2-of-3 wallet and recovery",
      "Local intent planning",
      "Simulation and balance diffs",
      "Policies and outbox",
      "Transparent send, swap and bridge flows",
      "Local audit receipts",
    ],
    opens: "Every action is simulated, policy-checked and approved by quorum.",
  },
  {
    n: 2,
    name: "Shielded payments",
    short: "Shielded payments",
    status: "Next",
    why: "One stablecoin, end to end, with explicit states for every proof and every refund.",
    items: [
      "Shield and unshield for one stablecoin",
      "Shielded receive flow",
      "Selective disclosure",
      "Provenance proof integration",
      "Safe timeout and refund behaviour",
      "Mobile proving benchmark",
    ],
    opens: "No funds can sit in an unexplained proof-provider state.",
  },
  {
    n: 3,
    name: "Shielded DeFi",
    short: "Shielded DeFi",
    status: "Planned",
    why: "Composable recipes with one simulation and one approval, executed atomically where the route allows it.",
    items: [
      "Shielded swap recipe",
      "Shielded lending recipe",
      "Atomic unshield → execute → reshield",
      "Broadcaster failover",
      "Full simulation of privacy and fee effects",
    ],
    opens: "Recipes declare contracts, fees, proofs, failure behaviour and audit status.",
  },
  {
    n: 4,
    name: "Tokenized stocks",
    short: "Tokenized stocks",
    status: "Planned",
    why: "The long-term edge on Robinhood Chain, treated as its own asset class rather than as ordinary ERC-20 support.",
    items: [
      "One verified stock-token issuer and asset first",
      "Corporate-action and rebase tests",
      "Legal and eligibility review",
      "Shielded purchase and receipt",
      "Proof and selective-disclosure flows",
      "Only then expand the registry",
    ],
    opens: "Asset, legal and pricing models verified for each listed stock token.",
  },
  {
    n: 5,
    name: "Multichain privacy",
    short: "Multichain",
    status: "Later",
    why: "More chains only once the Robinhood Chain privacy and recovery experience is stable.",
    items: [
      "Add adapters only after Robinhood Chain is stable",
      "Keep chain-specific privacy assumptions visible",
      "Never promise identical privacy across chains",
    ],
    opens: "Each chain shows its own privacy assumptions before you sign.",
  },
];

export const REVISE = [
  ["“One-tap” privacy", "Keep the action simple, but always show the simulation and disclosure summary."],
  ["“Private DeFi”", "Say what is shielded, what stays public and which providers see route data."],
  ["“15-minute PPOI”", "A measured service-level target with a safe fallback, not a promise."],
  ["Broadcaster economics", "Define subsidies, bonding, failure handling and censorship resistance."],
  ["Yield inside the shield", "A later recipe, with clear smart-contract and protocol risk."],
];

export const DEFERRED = [
  "Token launch, staking or fee-token mechanics",
  "A broad stock-token registry",
  "Many-chain shielded support",
  "Automated treasury execution",
  "Unbounded protocol-composition recipes",
  "Any privacy claim that depends on an unaudited or unshipped proof system",
];

export const METRICS: { area: string; items: string[] }[] = [
  {
    area: "Safety",
    items: [
      "Zero unilateral-spend incidents",
      "Zero executions bypassing policy and approval",
      "Zero funds trapped by an unresolved proof state",
      "Share of actions with a viewed simulation",
      "Share of users completing a recovery drill",
    ],
  },
  {
    area: "Privacy",
    items: [
      "Eligible computations completed on-device",
      "Raw intents sent to external services",
      "Shielded actions with successful note recovery",
      "Selective-disclosure completion rate",
      "Proof-provider outage recovery time",
    ],
  },
  {
    area: "Usefulness",
    items: [
      "Time from intent to approved plan",
      "Quote-to-settlement discrepancy",
      "Shield-to-first-private-action completion",
      "Shield, swap, lend and unshield recipe completion",
      "Risky actions blocked before signing",
    ],
  },
  {
    area: "Network health",
    items: [
      "Broadcaster liveness and fallback success",
      "Proving latency by device class",
      "Adapter test coverage",
      "SDK integration time",
      "Adapters with current capability declarations",
    ],
  },
];
