import { decodeEventLog, decodeFunctionData, formatUnits, getAddress, isAddress, isHex, parseAbi, type Address, type Hex } from "viem";
import { publicClient } from "./config";
import { ROBINHOOD_TOKEN_REGISTRY } from "./tokens";
import { RELAY_DEPOSITORY } from "./bridge";

/**
 * Transaction explanations: a deterministic, plain-language reading of what a
 * call does, with flags for unusual costs or permissions. Nothing here guesses;
 * anything Veilora cannot decode is reported as unrecognized. Veily narrates
 * these results instead of inventing its own.
 */

export type Flag = { level: "info" | "warn" | "danger"; code: string; text: string };
export type Effect = { direction: "out" | "in" | "permission"; asset: string; amount: string | null; raw: string | null; counterparty: string | null };
export type Explanation = {
  kind: "send" | "token-send" | "approve" | "swap" | "bridge" | "shard-change" | "deployment" | "receive" | "contract-call";
  title: string;
  summary: string[];
  effects: Effect[];
  flags: Flag[];
  target: { address: string; label: string };
};
export type Call = { target: string; value: string | bigint; data: string };

const SWAP_ROUTER = getAddress("0xcaf681a66d020601342297493863e78c959e5cb2");
const V4_ADAPTER = getAddress("0x2b50d96a0073baCe9e126fb012d46912298486F0");
const DEPOSITORY = getAddress(RELAY_DEPOSITORY);
const UNLIMITED = 2n ** 255n;
const WETH_LABEL = "WETH";

const tokensByAddress = new Map(Object.values(ROBINHOOD_TOKEN_REGISTRY).map((t) => [t.address.toLowerCase(), t]));
const KNOWN: Record<string, string> = {
  [SWAP_ROUTER.toLowerCase()]: "Uniswap v3 router",
  [V4_ADAPTER.toLowerCase()]: "Uniswap v4 adapter",
  [DEPOSITORY.toLowerCase()]: "Relay bridge depository",
};
const SPENDERS = new Set([SWAP_ROUTER.toLowerCase(), V4_ADAPTER.toLowerCase(), DEPOSITORY.toLowerCase()]);

const erc20 = parseAbi([
  "function transfer(address to,uint256 amount) returns (bool)",
  "function approve(address spender,uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);
const v3 = parseAbi([
  "function multicall(uint256 deadline,bytes[] data) payable returns (bytes[] results)",
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
  "function unwrapWETH9(uint256 amountMinimum,address recipient) payable",
]);
const v4 = parseAbi([
  "struct PoolKey { address currency0; address currency1; uint24 fee; int24 tickSpacing; address hooks; }",
  "function swapExactIn(PoolKey key,bool zeroForOne,uint256 amountIn,uint256 minOut,address recipient) returns (uint256 amountOut)",
]);
const account = parseAbi([
  "function executeWithSignatures(address target,uint256 value,bytes data,uint256 _nonce,uint256 deadline,bytes signatures) returns (bytes)",
  "function rotateShardA(address newShardA)",
  "function rotateShardC(address newShardC)",
  "function execute(address target,uint256 value,bytes data)",
]);
const factory = parseAbi(["function createAccount(address shardA,address shardB,address shardC,uint256 salt) returns (address)"]);

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
function asset(address: string): { symbol: string; decimals: number } {
  const token = tokensByAddress.get(address.toLowerCase());
  return token ? { symbol: token.symbol, decimals: token.decimals } : { symbol: short(address), decimals: 18 };
}
function amountOf(raw: bigint, decimals: number) {
  return Number(formatUnits(raw, decimals)).toLocaleString("en-US", { maximumFractionDigits: 6 });
}
function label(address: string, wallet: string) {
  if (address.toLowerCase() === wallet.toLowerCase()) return "Your account";
  return KNOWN[address.toLowerCase()] ?? (tokensByAddress.has(address.toLowerCase()) ? `${asset(address).symbol} token` : short(address));
}

/** Explain one call the account would make (or made). Pure: no network access. */
export function explainCall(walletAddress: string, call: Call): Explanation {
  const wallet = getAddress(walletAddress);
  if (!isAddress(call.target) || !isHex(call.data)) throw new Error("A valid target and calldata are required");
  const target = getAddress(call.target);
  const value = BigInt(call.value);
  const data = call.data as Hex;
  const base = { target: { address: target, label: label(target, wallet) } };
  const flags: Flag[] = [];
  const ethOut: Effect | null = value > 0n ? { direction: "out", asset: "ETH", amount: amountOf(value, 18), raw: value.toString(), counterparty: target } : null;

  if (data === "0x") {
    if (value === 0n) return { ...base, kind: "contract-call", title: "Empty call", summary: ["This call sends nothing and calls nothing."], effects: [], flags: [{ level: "warn", code: "empty", text: "This transaction does nothing; there is no reason to sign it." }] };
    return { ...base, kind: "send", title: `Send ${amountOf(value, 18)} ETH`, summary: [`Sends ${amountOf(value, 18)} ETH from your account to ${short(target)}.`], effects: [ethOut!], flags };
  }

  if (target === wallet) {
    try {
      const d = decodeFunctionData({ abi: account, data });
      if (d.functionName === "rotateShardA" || d.functionName === "rotateShardC") {
        const which = d.functionName === "rotateShardA" ? "device key (Shard A)" : "recovery key (Shard C)";
        return { ...base, kind: "shard-change", title: `Replace your ${which}`, summary: [`Changes your account's ${which} to ${short(d.args[0] as string)}.`, "After this, the old key can no longer sign for your account."],
          effects: [{ direction: "permission", asset: "Account control", amount: null, raw: null, counterparty: d.args[0] as string }],
          flags: [{ level: "danger", code: "signer-change", text: `This changes who can sign for your account. Only approve it if you started a ${which} replacement yourself.` }] };
      }
    } catch { /* fall through to unrecognized */ }
  }

  if (tokensByAddress.has(target.toLowerCase())) {
    const token = asset(target);
    try {
      const d = decodeFunctionData({ abi: erc20, data });
      if (d.functionName === "transfer") {
        const [to, raw] = d.args as readonly [Address, bigint];
        if (value > 0n) flags.push({ level: "warn", code: "eth-with-token", text: `Also sends ${amountOf(value, 18)} ETH to the token contract, which is unusual.` });
        return { ...base, kind: "token-send", title: `Send ${amountOf(raw, token.decimals)} ${token.symbol}`, summary: [`Sends ${amountOf(raw, token.decimals)} ${token.symbol} from your account to ${short(to)}.`],
          effects: [{ direction: "out", asset: token.symbol, amount: amountOf(raw, token.decimals), raw: raw.toString(), counterparty: to }, ...(ethOut ? [ethOut] : [])], flags };
      }
      if (d.functionName === "approve") {
        const [spender, raw] = d.args as readonly [Address, bigint];
        const known = SPENDERS.has(spender.toLowerCase());
        const unlimited = raw >= UNLIMITED;
        if (raw === 0n) {
          return { ...base, kind: "approve", title: `Revoke ${token.symbol} approval`, summary: [`Removes ${label(spender, wallet)}'s permission to move your ${token.symbol}.`], effects: [{ direction: "permission", asset: token.symbol, amount: "0", raw: "0", counterparty: spender }], flags };
        }
        if (unlimited) flags.push({ level: "danger", code: "unlimited-approval", text: `Unlimited approval: ${label(spender, wallet)} could move all of your ${token.symbol}, now and later.` });
        if (!known) flags.push({ level: "danger", code: "unknown-spender", text: `${short(spender)} is not a contract Veilora recognizes. It could move this ${token.symbol}.` });
        if (known && !unlimited) flags.push({ level: "info", code: "limited-approval", text: `Limited to ${amountOf(raw, token.decimals)} ${token.symbol} for ${label(spender, wallet)}.` });
        return { ...base, kind: "approve", title: `Allow ${label(spender, wallet)} to use ${unlimited ? "all your" : amountOf(raw, token.decimals)} ${token.symbol}`,
          summary: [`Gives ${known ? label(spender, wallet) : short(spender)} permission to move ${unlimited ? "any amount of" : `up to ${amountOf(raw, token.decimals)}`} ${token.symbol} from your account.`, "Nothing moves yet; the next step uses this permission."],
          effects: [{ direction: "permission", asset: token.symbol, amount: unlimited ? "unlimited" : amountOf(raw, token.decimals), raw: raw.toString(), counterparty: spender }], flags };
      }
    } catch { /* fall through */ }
  }

  if (target === SWAP_ROUTER) {
    try {
      const outer = decodeFunctionData({ abi: v3, data });
      if (outer.functionName === "multicall") {
        type V3Swap = { tokenIn: Address; tokenOut: Address; amountIn: bigint; amountOutMinimum: bigint; recipient: Address; fee: number };
        let swap = null as V3Swap | null;
        let unwrapRecipient: Address | null = null;
        for (const inner of outer.args[1] as readonly Hex[]) {
          const d = decodeFunctionData({ abi: v3, data: inner });
          if (d.functionName === "exactInputSingle" && !swap) swap = d.args[0] as V3Swap;
          else if (d.functionName === "unwrapWETH9" && !unwrapRecipient) unwrapRecipient = (d.args as readonly [bigint, Address])[1];
          else throw new Error("unexpected");
        }
        if (swap) {
          if (unwrapRecipient && (unwrapRecipient.toLowerCase() !== wallet.toLowerCase() || swap.recipient.toLowerCase() !== SWAP_ROUTER.toLowerCase())) throw new Error("unexpected unwrap recipient");
          if (!unwrapRecipient && swap.recipient.toLowerCase() !== wallet.toLowerCase()) flags.push({ level: "danger", code: "foreign-recipient", text: `The swap output goes to ${short(swap.recipient)}, not your account.` });
          const nativeIn = value > 0n;
          const inA = nativeIn ? { symbol: "ETH", decimals: 18 } : asset(swap.tokenIn);
          const outA = unwrapRecipient ? { symbol: "ETH", decimals: 18 } : tokensByAddress.has(swap.tokenOut.toLowerCase()) ? asset(swap.tokenOut) : { symbol: WETH_LABEL, decimals: 18 };
          flags.push({ level: "info", code: "min-out", text: `If the price moves so you would get less than ${amountOf(swap.amountOutMinimum, outA.decimals)} ${outA.symbol}, the swap cancels and nothing is spent.` });
          flags.push({ level: "info", code: "pool-fee", text: `Includes Uniswap's ${swap.fee / 10000}% pool fee.` });
          return { ...base, kind: "swap", title: `Swap ${amountOf(swap.amountIn, inA.decimals)} ${inA.symbol} for ${outA.symbol}`,
            summary: [`Swaps ${amountOf(swap.amountIn, inA.decimals)} ${inA.symbol} for at least ${amountOf(swap.amountOutMinimum, outA.decimals)} ${outA.symbol} on Uniswap v3.`, "The output is delivered to your account."],
            effects: [{ direction: "out", asset: inA.symbol, amount: amountOf(swap.amountIn, inA.decimals), raw: swap.amountIn.toString(), counterparty: SWAP_ROUTER },
              { direction: "in", asset: outA.symbol, amount: `≥ ${amountOf(swap.amountOutMinimum, outA.decimals)}`, raw: swap.amountOutMinimum.toString(), counterparty: SWAP_ROUTER }], flags };
        }
      }
    } catch { /* fall through */ }
  }

  if (target === V4_ADAPTER) {
    try {
      const d = decodeFunctionData({ abi: v4, data });
      const [key, zeroForOne, amountIn, minOut, recipient] = d.args as readonly [{ currency0: Address; currency1: Address; fee: number }, boolean, bigint, bigint, Address];
      const inA = asset(zeroForOne ? key.currency0 : key.currency1);
      const outA = asset(zeroForOne ? key.currency1 : key.currency0);
      if (recipient.toLowerCase() !== wallet.toLowerCase()) flags.push({ level: "danger", code: "foreign-recipient", text: `The swap output goes to ${short(recipient)}, not your account.` });
      flags.push({ level: "info", code: "min-out", text: `If the price moves so you would get less than ${amountOf(minOut, outA.decimals)} ${outA.symbol}, the swap cancels and nothing is spent.` });
      flags.push({ level: "info", code: "pool-fee", text: `Includes Uniswap's ${key.fee / 10000}% pool fee.` });
      return { ...base, kind: "swap", title: `Swap ${amountOf(amountIn, inA.decimals)} ${inA.symbol} for ${outA.symbol}`,
        summary: [`Swaps ${amountOf(amountIn, inA.decimals)} ${inA.symbol} for at least ${amountOf(minOut, outA.decimals)} ${outA.symbol} on Uniswap v4.`, "The output is delivered to your account."],
        effects: [{ direction: "out", asset: inA.symbol, amount: amountOf(amountIn, inA.decimals), raw: amountIn.toString(), counterparty: V4_ADAPTER },
          { direction: "in", asset: outA.symbol, amount: `≥ ${amountOf(minOut, outA.decimals)}`, raw: minOut.toString(), counterparty: V4_ADAPTER }], flags };
    } catch { /* fall through */ }
  }

  if (target === DEPOSITORY) {
    const selector = data.slice(0, 10).toLowerCase();
    if (selector === "0x49290c1c" || selector === "0xe8017952") {
      const erc = selector === "0xe8017952";
      const tokenAddr = erc ? getAddress(`0x${data.slice(98, 138)}`) : null;
      const a = tokenAddr ? asset(tokenAddr) : { symbol: "ETH", decimals: 18 };
      const raw = erc ? BigInt(`0x${data.slice(138, 202)}`) : value;
      return { ...base, kind: "bridge", title: `Bridge ${amountOf(raw, a.decimals)} ${a.symbol} with Relay`,
        summary: [`Deposits ${amountOf(raw, a.decimals)} ${a.symbol} with Relay, which delivers it on the destination chain you reviewed.`, "The funds leave Robinhood Chain."],
        effects: [{ direction: "out", asset: a.symbol, amount: amountOf(raw, a.decimals), raw: raw.toString(), counterparty: DEPOSITORY }],
        flags: [{ level: "info", code: "bridge-trust", text: "Delivery depends on Relay. If it cannot fill, funds are refunded to your account on Robinhood Chain." }] };
    }
  }

  return { ...base, kind: "contract-call", title: target === wallet ? "Unrecognized call to your account" : `Call to ${label(target, wallet)}`, summary: [`Calls ${short(target)} with data Veilora cannot decode.`, ...(ethOut ? [`Also sends ${ethOut.amount} ETH.`] : [])],
    effects: ethOut ? [ethOut] : [],
    flags: [{ level: "danger", code: "unrecognized", text: "Veilora does not recognize this contract call, so it cannot tell you what it does. Its co-signer refuses calls it cannot verify." }] };
}

/** Overridable in tests so mined-transaction explanations do not need an RPC. */
export const explainChain = {
  getTransaction: (hash: Hex) => publicClient.getTransaction({ hash }),
  getReceipt: (hash: Hex) => publicClient.getTransactionReceipt({ hash }),
};

/** Explain a mined transaction from this wallet's point of view, using what actually moved. */
export async function explainTransaction(walletAddress: string, hash: Hex): Promise<Explanation & { status: "success" | "reverted"; gasPaidBy: "relayer" | "you" | "sender"; feeEth: string | null }> {
  const wallet = getAddress(walletAddress);
  const [tx, receipt] = await Promise.all([explainChain.getTransaction(hash), explainChain.getReceipt(hash)]);
  const fee = receipt.gasUsed * (receipt.effectiveGasPrice ?? 0n);
  const status = receipt.status === "success" ? "success" : "reverted";
  const to = tx.to ? getAddress(tx.to) : null;

  // Actual token movements for this wallet, from the receipt logs.
  const moved: Effect[] = [];
  for (const log of receipt.logs) {
    if (!tokensByAddress.has(log.address.toLowerCase())) continue;
    try {
      const ev = decodeEventLog({ abi: erc20, data: log.data, topics: log.topics });
      if (ev.eventName !== "Transfer") continue;
      const { from, to: dest, value } = ev.args as { from: Address; to: Address; value: bigint };
      const a = asset(log.address);
      if (from.toLowerCase() === wallet.toLowerCase()) moved.push({ direction: "out", asset: a.symbol, amount: amountOf(value, a.decimals), raw: value.toString(), counterparty: dest });
      else if (dest.toLowerCase() === wallet.toLowerCase()) moved.push({ direction: "in", asset: a.symbol, amount: amountOf(value, a.decimals), raw: value.toString(), counterparty: from });
    } catch { /* not a standard Transfer */ }
  }

  let explanation: Explanation;
  let gasPaidBy: "relayer" | "you" | "sender" = "sender";
  const isCreate = (() => { try { return decodeFunctionData({ abi: factory, data: tx.input }).functionName === "createAccount"; } catch { return false; } })();
  const receivedEth = to === wallet && tx.input === "0x" && tx.value > 0n;
  let executed: readonly [Address, bigint, Hex] | null = null;
  if (to === wallet && !receivedEth) {
    try {
      const d = decodeFunctionData({ abi: account, data: tx.input });
      if (d.functionName === "executeWithSignatures") executed = [d.args[0], d.args[1], d.args[2]] as const;
    } catch { /* not an account execution */ }
  }

  if (executed) {
    explanation = explainCall(wallet, { target: executed[0], value: executed[1], data: executed[2] });
    gasPaidBy = tx.from.toLowerCase() === wallet.toLowerCase() ? "you" : "relayer";
    explanation.summary.push("Signed by two of your account's three keys and submitted by Veilora's relayer.");
  } else if (isCreate && to) {
    explanation = { kind: "deployment", title: "Account deployment", summary: ["Deploys your 2-of-3 smart account on Robinhood Chain.", "Paid by Veilora's relayer; nothing left your account."], effects: [], flags: [], target: { address: to, label: "Veilora account factory" } };
    gasPaidBy = "relayer";
  } else if (receivedEth || (moved.length > 0 && moved.every((m) => m.direction === "in"))) {
    const ins: Effect[] = [...moved, ...(receivedEth ? [{ direction: "in" as const, asset: "ETH", amount: amountOf(tx.value, 18), raw: tx.value.toString(), counterparty: tx.from }] : [])];
    explanation = { kind: "receive", title: `Received ${ins.map((m) => `${m.amount} ${m.asset}`).join(", ")}`, summary: [`Sent to your account by ${short(tx.from)}.`, "Receiving costs you nothing."], effects: ins, flags: [], target: { address: tx.from, label: short(tx.from) } };
  } else if (to) {
    explanation = explainCall(wallet, { target: to, value: tx.value, data: tx.input });
    if (tx.from.toLowerCase() !== wallet.toLowerCase()) explanation.summary.unshift(`Sent by ${short(tx.from)}, not by your account.`);
  } else {
    explanation = { kind: "contract-call", title: "Contract creation", summary: [`${short(tx.from)} deployed a contract.`], effects: [], flags: [], target: { address: tx.from, label: short(tx.from) } };
  }

  // Prefer what actually moved over what the calldata allowed.
  if (status === "success" && moved.length && explanation.kind !== "receive") {
    explanation.effects = [...moved, ...explanation.effects.filter((e) => e.direction === "permission" || e.asset === "ETH")];
  }
  if (status === "reverted") {
    explanation.effects = [];
    explanation.flags.unshift({ level: "warn", code: "reverted", text: "This transaction failed. Nothing moved; only the network fee was spent." });
  }
  if (gasPaidBy === "relayer") explanation.flags.push({ level: "info", code: "gas-sponsored", text: `Network fee of ${Number(formatUnits(fee, 18)).toPrecision(2)} ETH was paid by Veilora's relayer, not you.` });
  return { ...explanation, status, gasPaidBy, feeEth: formatUnits(fee, 18) };
}
