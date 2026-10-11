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
    name: "Wallet safety and recovery",
    short: "Wallet safety",
    status: "Building",
    why: "Every wallet action starts with clear ownership, safe key handling, and verifiable transaction approval.",
    items: ["2-of-3 account authorization", "Encrypted device-key storage", "Offline recovery-key flow", "Signed freeze and disconnect actions"],
    opens: "Users can control and recover their account with understandable security boundaries.",
  },
  {
    n: 2,
    name: "Everyday wallet flows",
    short: "Wallet flows",
    status: "Next",
    why: "Make the core wallet fast to understand and dependable on Robinhood Chain.",
    items: ["Clear send and receive carousels", "Live balance refresh", "Readable transaction receipts", "Accessible mobile layout"],
    opens: "Send, receive, and balance states stay consistent with chain settlement.",
  },
  {
    n: 3,
    name: "Swap reliability",
    short: "Swaps",
    status: "Planned",
    why: "Compare supported routes and make execution outcomes easy to verify.",
    items: ["Live Uniswap v3 and v4 quotes", "Slippage and expiry checks", "Token approval limits", "Quote-to-settlement monitoring"],
    opens: "Each swap shows its route, minimum output, and final settlement receipt.",
  },
  {
    n: 4,
    name: "Market coverage",
    short: "Market",
    status: "Planned",
    why: "Show supported first-class assets with verified addresses and current balances.",
    items: ["ETH and USDG details", "Robinhood token registry", "Reliable market pricing", "Asset metadata verification"],
    opens: "Listed assets have verified contract addresses and clear price sources.",
  },
  {
    n: 5,
    name: "History and operations",
    short: "History",
    status: "Later",
    why: "Make account activity searchable and improve operational visibility without exposing secrets.",
    items: ["Search and history filters", "Indexed token transfers", "Relayer health checks", "Incident and recovery runbook"],
    opens: "Users can reconcile activity with on-chain receipts and understand service status.",
  },
];

export const REVISE = [
  ["Price estimates", "Show the source and timestamp, and label estimates when values are incomplete."],
  ["Swap quotes", "Show route, minimum received, expiry and fees before the user signs."],
  ["Account recovery", "Keep recovery instructions clear and verify the offline backup step."],
  ["Transaction history", "Use chain-indexed records and link each item to its explorer receipt."],
];

export const DEFERRED = [
  "Additional chains before Robinhood Chain flows are stable",
  "Automated treasury execution",
  "Unverified token listings",
  "Any privacy feature without a deployed, independently reviewed proof system",
];

export const METRICS: { area: string; items: string[] }[] = [
  { area: "Safety", items: ["Zero unauthorized co-signatures", "Zero arbitrary contract calls accepted", "Sponsored deployment spend within daily cap", "Users completing a recovery drill"] },
  { area: "Usefulness", items: ["Send and receive completion rate", "Quote-to-settlement discrepancy", "History search success", "Time to refresh balances"] },
  { area: "Network health", items: ["Relayer liveness", "History provider availability", "Swap route availability", "Supported token registry accuracy"] },
];
