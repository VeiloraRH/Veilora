import { isAddress } from "viem";
import { RELAY_LINK_API_KEY, USDG_ADDRESS } from "./config";

export const ROBINHOOD_CHAIN_ID = 4663;
export const RELAY_DEPOSITORY = "0x4cd00e387622c35bddb9b4c962c136462338bc31";
export const NATIVE_CURRENCY = "0x0000000000000000000000000000000000000000";

export const bridgeSourceAssets = [
  { symbol: "ETH", name: "Ether", currency: NATIVE_CURRENCY, decimals: 18, native: true },
  { symbol: "USDG", name: "Global Dollar", currency: USDG_ADDRESS, decimals: 6, native: false },
] as const;

export const bridgeDestinations = [
  {
    chainId: 8453,
    name: "Base",
    assets: [
      { symbol: "ETH", name: "Ether", currency: NATIVE_CURRENCY, decimals: 18 },
      { symbol: "USDC", name: "USD Coin", currency: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", decimals: 6 },
      { symbol: "cbBTC", name: "Coinbase Wrapped BTC", currency: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", decimals: 8 },
    ],
  },
  {
    chainId: 1,
    name: "Ethereum",
    assets: [
      { symbol: "ETH", name: "Ether", currency: NATIVE_CURRENCY, decimals: 18 },
      { symbol: "USDC", name: "USD Coin", currency: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", decimals: 6 },
      { symbol: "USDT", name: "Tether USD", currency: "0xdac17f958d2ee523a2206206994597c13d831ec7", decimals: 6 },
      { symbol: "PYUSD", name: "PayPal USD", currency: "0x6c3ea9036406852006290770bedfcaba0e23a0e8", decimals: 6 },
    ],
  },
  {
    chainId: 137,
    name: "Polygon",
    assets: [
      { symbol: "POL", name: "POL", currency: NATIVE_CURRENCY, decimals: 18, native: true },
      { symbol: "ETH", name: "Wrapped Ether", currency: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619", decimals: 18 },
      { symbol: "USDC", name: "USD Coin", currency: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359", decimals: 6 },
      { symbol: "USDT", name: "Tether USD", currency: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f", decimals: 6 },
    ],
  },
  {
    chainId: 56,
    name: "BNB Chain",
    assets: [
      { symbol: "ETH", name: "Binance-Peg Ethereum Token", currency: "0x2170ed0880ac9a755fd29b2688956bd959f933f8", decimals: 18 },
      { symbol: "BNB", name: "BNB", currency: NATIVE_CURRENCY, decimals: 18, native: true },
      { symbol: "USDC", name: "Binance-Peg USD Coin", currency: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", decimals: 18 },
      { symbol: "USDT", name: "Tether USD", currency: "0x55d398326f99059ff775485246999027b3197955", decimals: 18 },
    ],
  },
] as const;

type BridgeInput = {
  ownerAddress: string;
  recipient: string;
  amount: string;
  originCurrency: string;
  source: (typeof bridgeSourceAssets)[number];
  destinationChainId: number;
  destination: (typeof bridgeDestinations)[number]["assets"][number];
};

const sameAddress = (a: unknown, b: string) => typeof a === "string" && a.toLowerCase() === b.toLowerCase();
const word = (value: string) => value.slice(2).toLowerCase().padStart(64, "0");

export function parseBridgeInput(body: any): BridgeInput {
  const source = bridgeSourceAssets.find((asset) => sameAddress(body?.originCurrency, asset.currency));
  const destination = bridgeDestinations.find((chain) => chain.chainId === Number(body?.destinationChainId));
  const output = destination?.assets.find((asset) => sameAddress(body?.destinationCurrency, asset.currency));
  const ownerAddress = body?.ownerAddress;
  const recipient = body?.recipient;
  const amount = body?.amount;

  if (!source) throw new Error("Choose ETH or USDG on Robinhood Chain.");
  if (!destination || !output) throw new Error("Choose a supported destination chain and asset.");
  if (!isAddress(ownerAddress, { strict: false }) || /^0x0{40}$/i.test(ownerAddress))
    throw new Error("Connect a valid Veilora wallet.");
  if (!isAddress(recipient, { strict: false }) || /^0x0{40}$/i.test(recipient))
    throw new Error("Enter a valid destination wallet address.");
  if (typeof amount !== "string" || !/^[1-9]\d{0,77}$/.test(amount))
    throw new Error("Enter a positive amount in base units.");

  return {
    ownerAddress,
    recipient,
    amount,
    originCurrency: source.currency,
    source,
    destinationChainId: destination.chainId,
    destination: output,
  };
}

export async function relayRequest(path: string, body?: unknown) {
  if (!RELAY_LINK_API_KEY) throw new Error("Relay is not configured on the backend.");
  const response = await fetch(`https://api.relay.link${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": RELAY_LINK_API_KEY,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(18_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("Relay cannot provide this route right now.");
  return data as any;
}

export function validateRelayQuote(raw: any, input: BridgeInput, startedAt: number) {
  const details = raw?.details;
  if (!/^0x[\da-f]{64}$/i.test(raw?.requestId ?? "") || !details ||
      !sameAddress(details.sender, input.ownerAddress) || !sameAddress(details.recipient, input.recipient) ||
      details.currencyIn?.currency?.chainId !== ROBINHOOD_CHAIN_ID ||
      !sameAddress(details.currencyIn.currency.address, input.originCurrency) ||
      details.currencyIn.amount !== input.amount ||
      details.currencyOut?.currency?.chainId !== input.destinationChainId ||
      !sameAddress(details.currencyOut.currency.address, input.destination.currency))
    throw new Error("Relay quote does not match the requested transfer.");

  const amountOut = details.currencyOut.amount;
  const minimumAmountOut = details.currencyOut.minimumAmount;
  if (!/^\d+$/.test(amountOut ?? "") || !/^\d+$/.test(minimumAmountOut ?? "") ||
      BigInt(minimumAmountOut) <= 0n || BigInt(amountOut) < BigInt(minimumAmountOut) ||
      BigInt(minimumAmountOut) < BigInt(amountOut) * 9950n / 10000n)
    throw new Error("Relay returned an invalid amount or exceeded the 0.5% slippage limit.");

  const steps: { id: "approve" | "deposit"; to: string; data: string; value: string; chainId: number }[] = [];
  for (const step of raw.steps ?? []) {
    if (step?.kind !== "transaction" || !["approve", "deposit"].includes(step.id) || step.items?.length !== 1)
      throw new Error("Relay returned a transaction flow Veilora does not support.");
    const tx = step.items[0]?.data;
    if (!tx || tx.chainId !== ROBINHOOD_CHAIN_ID || !sameAddress(tx.from, input.ownerAddress) ||
        !isAddress(tx.to, { strict: false }) || typeof tx.data !== "string" || !/^0x[\da-f]*$/i.test(tx.data))
      throw new Error("Relay returned an unexpected source transaction.");

    const data = tx.data.toLowerCase();
    const value = BigInt(tx.value ?? "0");
    const amountWord = BigInt(input.amount).toString(16).padStart(64, "0");
    if (step.id === "approve") {
      const expected = `0x095ea7b3${word(RELAY_DEPOSITORY)}${amountWord}`;
      if (input.source.native || value !== 0n || !sameAddress(tx.to, input.originCurrency) || data !== expected)
        throw new Error("Relay approval does not match the exact source token, amount, and bridge contract.");
    } else {
      if (input.source.native) {
        if (!sameAddress(tx.to, RELAY_DEPOSITORY) || data.length !== 138 ||
            data.slice(0, 10) !== "0x49290c1c" || data.slice(10, 74) !== word(input.ownerAddress) ||
            !/^0x49290c1c[\da-f]{128}$/i.test(data) || value !== BigInt(input.amount))
          throw new Error("Relay ETH deposit does not match the reviewed source amount.");
      } else if (!sameAddress(tx.to, RELAY_DEPOSITORY) || data.length !== 266 ||
          data.slice(0, 10) !== "0xe8017952" || data.slice(10, 74) !== word(input.ownerAddress) ||
          data.slice(74, 138) !== word(input.originCurrency) || data.slice(138, 202) !== amountWord ||
          !/^0xe8017952[\da-f]{256}$/i.test(data) || value !== 0n) {
        throw new Error("Relay USDG deposit does not match the reviewed source token and amount.");
      }
    }
    steps.push({ id: step.id, to: tx.to, data, value: value.toString(), chainId: ROBINHOOD_CHAIN_ID });
  }

  const sequence = steps.map((step) => step.id).join(",");
  if (sequence !== "deposit" && sequence !== "approve,deposit")
    throw new Error("Relay returned an incomplete source transaction flow.");

  return {
    requestId: raw.requestId,
    input: {
      ownerAddress: input.ownerAddress,
      recipient: input.recipient,
      amount: input.amount,
      originCurrency: input.originCurrency,
      destinationChainId: input.destinationChainId,
      destinationCurrency: input.destination.currency,
    },
    amountOut,
    minimumAmountOut,
    outputDecimals: input.destination.decimals,
    outputSymbol: input.destination.symbol,
    sourceDecimals: input.source.decimals,
    sourceSymbol: input.source.symbol,
    fees: raw.fees,
    timeEstimate: details.timeEstimate ?? null,
    steps,
    expiresAt: startedAt + 120_000,
  };
}
