import { createHmac } from "node:crypto";
import { getAddress, isAddress } from "viem";
import { USDG_ADDRESS } from "./config";
import { relayRequest } from "./bridge";

/**
 * Add funds: card or bank purchases through MoonPay, delivered to the
 * user's smart account on Robinhood Chain.
 *
 * - "direct": MoonPay delivers on Robinhood Chain to the account itself. Only
 *   enabled for currency codes configured in ONRAMP_DIRECT_CURRENCIES, once
 *   MoonPay confirms Robinhood Chain support for that asset.
 * - "relay": MoonPay delivers on Base to a Relay deposit address, and Relay
 *   bridges it to the account on Robinhood Chain. Funds never land at the
 *   account's address on Base, where no account exists.
 */

export type OnrampAsset = "USDG" | "ETH";
export type OnrampRoute =
  | { asset: OnrampAsset; kind: "direct"; currencyCode: string; network: string }
  | { asset: OnrampAsset; kind: "relay"; currencyCode: string; network: string; originChainId: number; originCurrency: string; originDecimals: number; destinationCurrency: string; quoteAmount: string };

const ZERO = "0x0000000000000000000000000000000000000000";

/** Base routes for the Relay fallback. MoonPay currency codes can be overridden per deployment. */
const RELAY_ROUTES: Record<OnrampAsset, Omit<Extract<OnrampRoute, { kind: "relay" }>, "currencyCode"> & { defaultCode: string; envCode: string }> = {
  USDG: {
    asset: "USDG", kind: "relay", network: "Base → Robinhood Chain", originChainId: 8453,
    originCurrency: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", originDecimals: 6,
    destinationCurrency: USDG_ADDRESS, quoteAmount: "100000000", defaultCode: "usdc_base", envCode: "MOONPAY_BASE_USDC_CODE",
  },
  ETH: {
    asset: "ETH", kind: "relay", network: "Base → Robinhood Chain", originChainId: 8453,
    originCurrency: ZERO, originDecimals: 18, destinationCurrency: ZERO, quoteAmount: "50000000000000000",
    defaultCode: "eth_base", envCode: "MOONPAY_BASE_ETH_CODE",
  },
};

export type OnrampConfig = {
  publishableKey: string;
  secretKey: string;
  widgetBaseUrl: string;
  refundAddress: string | null;
  relayEnabled: boolean;
  direct: Partial<Record<OnrampAsset, string>>;
};

/** Read the deployment's on-ramp settings. Returns null when the provider is not configured. */
export function readOnrampConfig(env: NodeJS.ProcessEnv = process.env): OnrampConfig | null {
  const publishableKey = env.MOONPAY_PUBLISHABLE_KEY?.trim();
  const secretKey = env.MOONPAY_SECRET_KEY?.trim();
  if (!publishableKey || !secretKey) return null;
  const sandbox = (env.MOONPAY_ENV ?? "sandbox") !== "production";
  if (sandbox !== publishableKey.startsWith("pk_test_") || sandbox !== secretKey.startsWith("sk_test_")) {
    throw new Error("MOONPAY_ENV must match the MoonPay key environment (pk_test_/sk_test_ for sandbox, pk_live_/sk_live_ for production)");
  }
  const direct: Partial<Record<OnrampAsset, string>> = {};
  for (const pair of (env.ONRAMP_DIRECT_CURRENCIES ?? "").split(",").map((p) => p.trim()).filter(Boolean)) {
    const [asset, code] = pair.split("=").map((p) => p.trim());
    if ((asset === "USDG" || asset === "ETH") && /^[a-z0-9_]{2,40}$/.test(code ?? "")) direct[asset] = code;
  }
  const refund = env.ONRAMP_REFUND_ADDRESS?.trim();
  return {
    publishableKey,
    secretKey,
    widgetBaseUrl: sandbox ? "https://buy-sandbox.moonpay.com" : "https://buy.moonpay.com",
    refundAddress: refund && isAddress(refund) ? getAddress(refund) : null,
    // The fallback needs Relay plus an app-controlled refund address on Base:
    // a refund to the user's own address there would be unreachable.
    relayEnabled: Boolean(env.RELAY_LINK_API_KEY) && Boolean(refund && isAddress(refund)) && env.ONRAMP_RELAY_FALLBACK !== "off",
    direct,
  };
}

export function routeFor(config: OnrampConfig, asset: OnrampAsset, env: NodeJS.ProcessEnv = process.env): OnrampRoute | null {
  const directCode = config.direct[asset];
  if (directCode) return { asset, kind: "direct", currencyCode: directCode, network: "Robinhood Chain" };
  if (!config.relayEnabled) return null;
  const { defaultCode, envCode, ...route } = RELAY_ROUTES[asset];
  return { ...route, currencyCode: env[envCode]?.trim() || defaultCode };
}

/** MoonPay URL signing: base64 HMAC-SHA256 of the query string, including its leading "?". */
export function signWidgetUrl(baseUrl: string, params: Record<string, string>, secretKey: string): string {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const signature = createHmac("sha256", secretKey).update(url.search).digest("base64");
  return `${url.toString()}&signature=${encodeURIComponent(signature)}`;
}

const sameAddress = (a: unknown, b: string) => typeof a === "string" && a.toLowerCase() === b.toLowerCase();

/** Overridable in tests so session creation does not call Relay. */
export const onrampRelay = { request: relayRequest };

/**
 * Ask Relay for an open deposit address on Base that bridges to `wallet` on
 * Robinhood Chain, and check it is wired to exactly that destination.
 */
export async function relayDepositAddress(route: Extract<OnrampRoute, { kind: "relay" }>, wallet: `0x${string}`, refundTo: string) {
  const raw = await onrampRelay.request("/quote/v2", {
    user: wallet,
    recipient: wallet,
    originChainId: route.originChainId,
    destinationChainId: 4663,
    originCurrency: route.originCurrency,
    destinationCurrency: route.destinationCurrency,
    amount: route.quoteAmount,
    tradeType: "EXACT_INPUT",
    useDepositAddress: true,
    refundTo,
  });
  const step = Array.isArray(raw?.steps) ? raw.steps.find((s: any) => s?.depositAddress) : null;
  const depositAddress = step?.depositAddress;
  const requestId = step?.requestId ?? raw?.requestId;
  const details = raw?.details;
  if (!isAddress(depositAddress ?? "") || sameAddress(depositAddress, ZERO) ||
      !sameAddress(details?.recipient, wallet) ||
      details?.currencyOut?.currency?.chainId !== 4663 || !sameAddress(details.currencyOut.currency.address, route.destinationCurrency) ||
      details?.currencyIn?.currency?.chainId !== route.originChainId || !sameAddress(details.currencyIn.currency.address, route.originCurrency)) {
    throw new Error("Relay returned a deposit address that does not match this route");
  }
  return {
    depositAddress: getAddress(depositAddress),
    requestId: typeof requestId === "string" ? requestId : null,
    timeEstimate: typeof details.timeEstimate === "number" ? details.timeEstimate : null,
  };
}

export type DeliveryState = "waiting" | "delivering" | "delivered" | "refunded" | "failed";

/** Fold Relay's requests for a deposit address into one delivery state per request. */
export function summarizeRelayRequests(raw: any) {
  const requests = Array.isArray(raw?.requests) ? raw.requests : [];
  return requests.slice(0, 20).map((r: any) => {
    const status = String(r?.status ?? "unknown");
    const state: DeliveryState = status === "success" ? "delivered" : status === "refund" || status === "refunded" ? "refunded"
      : status === "failure" || status === "failed" ? "failed" : status === "waiting" ? "waiting" : "delivering";
    const outTx = r?.data?.outTxs?.[0]?.hash ?? null;
    return {
      requestId: typeof r?.id === "string" ? r.id : null,
      state,
      amountOut: r?.data?.metadata?.currencyOut?.amount ?? null,
      outTxHash: typeof outTx === "string" ? outTx : null,
      updatedAt: typeof r?.updatedAt === "string" ? r.updatedAt : null,
    };
  });
}
