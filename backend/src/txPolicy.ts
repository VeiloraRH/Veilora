import {
  decodeFunctionData,
  erc20Abi,
  formatUnits,
  getAddress,
  isAddress,
  parseAbi,
  type Address,
  type Hex,
} from "viem";
import { ESCROW_FACTORY_ADDRESS, publicClient } from "./config";
import { db, query } from "./db/index";
import { ROBINHOOD_TOKEN_REGISTRY } from "./tokens";

export const NATIVE_ASSET = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const SWAP_ROUTER = getAddress("0xcaf681a66d020601342297493863e78c959e5cb2");
const V4_ADAPTER = getAddress("0x2b50d96a0073baCe9e126fb012d46912298486F0");
const RELAY_DEPOSITORY = getAddress("0x4cd00e387622c35bddb9b4c962c136462338bc31");
const USDG_ADDRESS = getAddress("0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168");
const tokenAddresses = new Set(Object.values(ROBINHOOD_TOKEN_REGISTRY).map((t) => t.address.toLowerCase()));
const routeSpenders = new Set([SWAP_ROUTER.toLowerCase(), V4_ADAPTER.toLowerCase(), RELAY_DEPOSITORY.toLowerCase()]);
const erc20Actions = parseAbi([
  "function transfer(address to,uint256 amount) returns (bool)",
  "function approve(address spender,uint256 amount) returns (bool)",
]);
const v3Abi = parseAbi([
  "function multicall(uint256 deadline,bytes[] data) payable returns (bytes[] results)",
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
  "function unwrapWETH9(uint256 amountMinimum,address recipient) payable",
]);
const v4Abi = parseAbi([
  "struct PoolKey { address currency0; address currency1; uint24 fee; int24 tickSpacing; address hooks; }",
  "function swapExactIn(PoolKey key,bool zeroForOne,uint256 amountIn,uint256 minOut,address recipient) returns (uint256 amountOut)",
]);
const WETH9_ABI = parseAbi(["function WETH9() view returns (address)"]);
const BALANCE_ABI = parseAbi(["function balanceOf(address account) view returns (uint256)"]);
const escrowActionAbi = parseAbi(["function approveOutcome(bytes32 digest)"]);
const escrowFactoryAbi = parseAbi(["function isEscrow(address escrow) view returns (bool)"]);
const trustedEscrows = new Set<string>((process.env.VEILORA_TRUSTED_ESCROW_ADDRESSES || "")
  .split(",").map((address) => address.trim().toLowerCase()).filter((address) => /^0x[\da-f]{40}$/.test(address)));

/** Refuse to co-sign. A specific reason tells the user what to change; structural mismatches keep the generic message. */
function deny(reason?: string): never {
  throw new Error(reason ? `Shard B policy denied: ${reason}` : "Shard B policy denied this target, selector, recipient, or amount");
}

const tokensByAddress = new Map(Object.values(ROBINHOOD_TOKEN_REGISTRY).map((t) => [t.address.toLowerCase(), t]));
function describeAsset(asset: string): { symbol: string; decimals: number } {
  if (asset === NATIVE_ASSET) return { symbol: "ETH", decimals: 18 };
  const token = tokensByAddress.get(asset.toLowerCase());
  return token ? { symbol: token.symbol, decimals: token.decimals } : { symbol: "this token", decimals: 18 };
}
function amountText(raw: bigint, decimals: number): string {
  const [whole, fraction = ""] = formatUnits(raw, decimals).split(".");
  const exact = fraction ? `${whole}.${fraction.replace(/0+$/, "")}`.replace(/\.$/, "") : whole;
  const [integer, decimal] = exact.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimal ? `${grouped}.${decimal}` : grouped;
}

/** The daily-limit refusal, in the user's units: what is allowed, what is used, what this needs. */
export function dailyLimitMessage(asset: string, amount: bigint, maxDailySpend: bigint, spentToday: bigint, dailyPercent = 20): string {
  const { symbol, decimals } = describeAsset(asset);
  if (maxDailySpend === 0n) return `you have no ${symbol} available to spend`;
  const left = maxDailySpend > spentToday ? maxDailySpend - spentToday : 0n;
  return `today's ${symbol} limit is ${amountText(maxDailySpend, decimals)} ${symbol} (${dailyPercent}% of your balance at the start of today's co-signed spending)` +
    (spentToday > 0n ? `, ${amountText(spentToday, decimals)} ${symbol} already used, ${amountText(left, decimals)} ${symbol} left` : "") +
    `. This needs ${amountText(amount, decimals)} ${symbol}. The limit resets at 00:00 UTC.`;
}

function isSupportedToken(value: unknown): value is Address {
  return typeof value === "string" && isAddress(value) && tokenAddresses.has(value.toLowerCase());
}

async function reserveDailySpend(wallet: Address, asset: string, amount: bigint, digest: Hex, deadline: bigint): Promise<void> {
  if (amount <= 0n) deny("the amount must be greater than zero");
  // Veilora's relayer pays gas for every execution, so the account's whole
  // balance counts; no ETH is held back for fees.
  const balance = asset === NATIVE_ASSET
    ? await publicClient.getBalance({ address: wallet })
    : await publicClient.readContract({ address: getAddress(asset), abi: BALANCE_ABI, functionName: "balanceOf", args: [wallet] });
  const settings = await query<{ per_transaction_percent: number; daily_total_percent: number }>(
    "SELECT per_transaction_percent, daily_total_percent FROM wallet_spending_policies WHERE wallet_address = $1",
    [wallet.toLowerCase()],
  );
  const perTransactionPercent = Number(settings.rows[0]?.per_transaction_percent ?? 20);
  const dailyPercent = Number(settings.rows[0]?.daily_total_percent ?? 20);
  const maxTransactionSpend = balance * BigInt(perTransactionPercent) / 100n;
  if (amount > maxTransactionSpend) {
    const { symbol, decimals } = describeAsset(asset);
    deny(`a single transaction can use up to ${amountText(maxTransactionSpend, decimals)} ${symbol} (${perTransactionPercent}% of your current balance). This needs ${amountText(amount, decimals)} ${symbol}`);
  }
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const day = await client.query<{ utc_day: string }>("SELECT (now() AT TIME ZONE 'UTC')::date::text AS utc_day");
    const utcDay = day.rows[0].utc_day;
    await client.query(
      `INSERT INTO wallet_daily_spend (wallet_address, utc_day, asset_address, amount_wei, daily_balance_wei)
       VALUES ($1, $2, $3, 0, $4) ON CONFLICT (wallet_address, utc_day, asset_address) DO NOTHING`,
      [wallet.toLowerCase(), utcDay, asset, balance.toString()],
    );
    const daily = await client.query<{ amount_wei: string; daily_balance_wei: string | null }>(
      `SELECT amount_wei::text, daily_balance_wei::text FROM wallet_daily_spend
       WHERE wallet_address=$1 AND utc_day=$2 AND asset_address=$3 FOR UPDATE`,
      [wallet.toLowerCase(), utcDay, asset],
    );
    const spentToday = BigInt(daily.rows[0].amount_wei);
    const balanceAtDayStart = BigInt(daily.rows[0].daily_balance_wei ?? balance.toString());
    const maxDailySpend = balanceAtDayStart * BigInt(dailyPercent) / 100n;
    const existing = await client.query<{ amount_wei: string; status: string; active: boolean }>(
      `SELECT amount_wei::text, status, expires_at > now() AS active FROM wallet_spend_reservations
       WHERE wallet_address=$1 AND utc_day=$2 AND asset_address=$3 AND execution_digest=$4 FOR UPDATE`,
      [wallet.toLowerCase(), utcDay, asset, digest.toLowerCase()],
    );
    if (existing.rows[0] && existing.rows[0].status === "committed") {
      if (BigInt(existing.rows[0].amount_wei) !== amount) deny();
      await client.query("COMMIT");
      return;
    }
    if (existing.rows[0]?.status === "reserved" && existing.rows[0].active) {
      if (BigInt(existing.rows[0].amount_wei) !== amount) deny();
      await client.query("COMMIT");
      return;
    }
    const pending = await client.query<{ amount_wei: string }>(
      `SELECT COALESCE(sum(amount_wei),0)::text AS amount_wei FROM wallet_spend_reservations
       WHERE wallet_address=$1 AND utc_day=$2 AND asset_address=$3 AND status='reserved' AND expires_at > now()`,
      [wallet.toLowerCase(), utcDay, asset],
    );
    const reservedToday = BigInt(pending.rows[0].amount_wei);
    if (spentToday + reservedToday + amount > maxDailySpend) {
      deny(dailyLimitMessage(asset, amount, maxDailySpend, spentToday + reservedToday, dailyPercent));
    }
    await client.query(
      `INSERT INTO wallet_spend_reservations (wallet_address,utc_day,asset_address,execution_digest,amount_wei,status,expires_at)
       VALUES ($1,$2,$3,$4,$5,'reserved',to_timestamp($6)+interval '5 minutes')
       ON CONFLICT (wallet_address,utc_day,asset_address,execution_digest) DO UPDATE
         SET amount_wei=EXCLUDED.amount_wei,status='reserved',expires_at=EXCLUDED.expires_at,transaction_hash=NULL,updated_at=now()`,
      [wallet.toLowerCase(), utcDay, asset, digest.toLowerCase(), amount.toString(), deadline.toString()],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Commit actual mined spend or release an unsubmitted/reverted reservation. */
export async function settleDailySpend(wallet: Address, digest: Hex, succeeded: boolean, transactionHash?: Hex): Promise<void> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const reservation = await client.query<{ utc_day: string; asset_address: string; amount_wei: string; status: string }>(
      `SELECT utc_day::text,asset_address,amount_wei::text,status FROM wallet_spend_reservations
       WHERE wallet_address=$1 AND execution_digest=$2 AND status IN ('reserved','released') FOR UPDATE`,
      [wallet.toLowerCase(), digest.toLowerCase()],
    );
    const row = reservation.rows[0];
    if (!row) { await client.query("COMMIT"); return; }
    if (!succeeded && row.status === "released") { await client.query("COMMIT"); return; }
    if (succeeded) {
      await client.query(
        `UPDATE wallet_daily_spend SET amount_wei=amount_wei+$4,updated_at=now()
         WHERE wallet_address=$1 AND utc_day=$2 AND asset_address=$3`,
        [wallet.toLowerCase(), row.utc_day, row.asset_address, row.amount_wei],
      );
    }
    await client.query(
      `UPDATE wallet_spend_reservations SET status=$3,transaction_hash=$4,updated_at=now()
       WHERE wallet_address=$1 AND execution_digest=$2 AND status IN ('reserved','released')`,
      [wallet.toLowerCase(), digest.toLowerCase(), succeeded ? "committed" : "released", transactionHash ?? null],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Apply an allowlist and per-asset daily spend cap before Shard B co-signs.
 * Every accepted action is limited to a direct asset transfer or the currently
 * wired Uniswap routers; arbitrary contract calls are denied.
 */
export async function enforceExecutionPolicy(
  walletAddress: Address,
  targetAddress: Address,
  value: bigint,
  data: Hex,
  digest: Hex,
  deadline: bigint,
): Promise<void> {
  const wallet = getAddress(walletAddress);
  const target = getAddress(targetAddress);

  if (data === "0x" && target !== wallet && value > 0n) {
    await reserveDailySpend(wallet, NATIVE_ASSET, value, digest, deadline);
    return;
  }

  if (isSupportedToken(target)) {
    let decoded: ReturnType<typeof decodeFunctionData>;
    try { decoded = decodeFunctionData({ abi: erc20Actions, data }); } catch { return deny(); }
    if (decoded.functionName === "transfer") {
      if (value !== 0n) deny();
      const [recipient, amount] = decoded.args as readonly [Address, bigint];
      if (!isAddress(recipient)) deny();
      if (recipient.toLowerCase() === wallet.toLowerCase()) deny("a transfer to your own account does nothing");
      await reserveDailySpend(wallet, target, amount, digest, deadline);
      return;
    }
    if (decoded.functionName === "approve") {
      if (value !== 0n) deny();
      const [spender, amount] = decoded.args as readonly [Address, bigint];
      // Revoking (approving zero) can only remove permission, so it is allowed
      // for any spender and does not count toward spending limits.
      if (amount === 0n) {
        if (!isAddress(spender) || spender.toLowerCase() === "0x0000000000000000000000000000000000000000") deny("revoke needs the spender's address");
        return;
      }
      if (!routeSpenders.has(spender.toLowerCase())) deny("token approvals are only allowed for Uniswap and Relay");
      const balance = await publicClient.readContract({ address: target, abi: BALANCE_ABI, functionName: "balanceOf", args: [wallet] });
      const { symbol, decimals } = describeAsset(target);
      const policy = await query<{ per_transaction_percent: number }>("SELECT per_transaction_percent FROM wallet_spending_policies WHERE wallet_address = $1", [wallet.toLowerCase()]);
      const percent = Number(policy.rows[0]?.per_transaction_percent ?? 20);
      const approvalCap = balance * BigInt(percent) / 100n;
      if (amount > approvalCap) deny(`an approval can cover at most ${amountText(approvalCap, decimals)} ${symbol} (${percent}% of your current balance). This asks for ${amountText(amount, decimals)} ${symbol}`);
      return;
    }
    return deny();
  }

  // Smart-account parties authorize a specific EIP-712 outcome directly on a
  // factory-created escrow. No other call to an escrow is co-signed here.
  if (ESCROW_FACTORY_ADDRESS && value === 0n) {
    let decoded: ReturnType<typeof decodeFunctionData> | undefined;
    try { decoded = decodeFunctionData({ abi: escrowActionAbi, data }); } catch {}
    if (decoded?.functionName === "approveOutcome") {
      if (!trustedEscrows.has(String(target).toLowerCase())) deny("this escrow has not been explicitly approved by Veilora");
      const verified = await publicClient.readContract({
        address: ESCROW_FACTORY_ADDRESS,
        abi: escrowFactoryAbi,
        functionName: "isEscrow",
        args: [target],
      });
      if (!verified) deny("outcome approvals are only allowed for verified Veilora escrows");
      return;
    }
  }

  // Relay's RHC depository accepts only a source owner, the exact asset and
  // amount, plus Relay's 32-byte route payload. The route itself is separately
  // checked against the live quote before the frontend asks Shard A to sign.
  if (target === RELAY_DEPOSITORY) {
    const hex = data.toLowerCase();
    if (hex.startsWith("0x49290c1c")) {
      if (!/^0x49290c1c[\da-f]{128}$/.test(hex) ||
          hex.slice(10, 74) !== wallet.slice(2).toLowerCase().padStart(64, "0") || value <= 0n) deny();
      await reserveDailySpend(wallet, NATIVE_ASSET, value, digest, deadline);
      return;
    }
    if (hex.startsWith("0xe8017952")) {
      if (!/^0xe8017952[\da-f]{256}$/.test(hex) || value !== 0n ||
          hex.slice(10, 74) !== wallet.slice(2).toLowerCase().padStart(64, "0") ||
          hex.slice(74, 138) !== USDG_ADDRESS.slice(2).toLowerCase().padStart(64, "0")) deny();
      const amount = BigInt(`0x${hex.slice(138, 202)}`);
      if (amount <= 0n) deny();
      await reserveDailySpend(wallet, USDG_ADDRESS, amount, digest, deadline);
      return;
    }
    return deny();
  }

  if (target === V4_ADAPTER) {
    if (value !== 0n) deny();
    let decoded: ReturnType<typeof decodeFunctionData>;
    try { decoded = decodeFunctionData({ abi: v4Abi, data }); } catch { return deny(); }
    if (decoded.functionName !== "swapExactIn") deny();
    const [poolKey, zeroForOne, amountIn, minOut, recipient] = decoded.args as readonly [
      { currency0: Address; currency1: Address; fee: number; tickSpacing: number; hooks: Address }, boolean, bigint, bigint, Address,
    ];
    const validTickSpacing: Record<number, number> = { 100: 1, 500: 10, 3000: 60, 10000: 200 };
    if (!isSupportedToken(poolKey.currency0) || !isSupportedToken(poolKey.currency1) ||
        validTickSpacing[poolKey.fee] !== poolKey.tickSpacing ||
        poolKey.hooks !== "0x0000000000000000000000000000000000000000" ||
        minOut <= 0n || amountIn <= 0n) deny();
    if (recipient.toLowerCase() !== wallet.toLowerCase()) deny("swap output must go to your own account");
    const input = zeroForOne ? poolKey.currency0 : poolKey.currency1;
    if (!isSupportedToken(input)) deny();
    await reserveDailySpend(wallet, input, amountIn, digest, deadline);
    return;
  }

  if (target === SWAP_ROUTER) {
    let decoded: ReturnType<typeof decodeFunctionData>;
    try { decoded = decodeFunctionData({ abi: v3Abi, data }); } catch { return deny(); }
    if (decoded.functionName !== "multicall") deny();
    const [deadline, calls] = decoded.args as readonly [bigint, readonly Hex[]];
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (deadline <= now) deny("this quote expired; get a fresh quote and try again");
    if (deadline > now + 120n || value < 0n) deny();
    let inputAsset: string | null = null;
    let inputAmount = 0n;
    let hasSwap = false;
    let outputAsset: Address | null = null;
    let swapRecipient: Address | null = null;
    let didUnwrap = false;
    const weth = getAddress(await publicClient.readContract({ address: SWAP_ROUTER, abi: WETH9_ABI, functionName: "WETH9" }));
    for (const call of calls) {
      let inner: ReturnType<typeof decodeFunctionData>;
      try { inner = decodeFunctionData({ abi: v3Abi, data: call }); } catch { return deny(); }
      if (inner.functionName === "exactInputSingle") {
        if (hasSwap) deny();
        const [params] = inner.args as readonly [{ tokenIn: Address; tokenOut: Address; fee: number; recipient: Address; amountIn: bigint; amountOutMinimum: bigint; sqrtPriceLimitX96: bigint }];
        const nativeIn = params.tokenIn.toLowerCase() === weth.toLowerCase() && value === params.amountIn;
        if ((!nativeIn && !isSupportedToken(params.tokenIn)) ||
            (params.tokenOut.toLowerCase() !== weth.toLowerCase() && !isSupportedToken(params.tokenOut)) ||
            (params.recipient.toLowerCase() !== wallet.toLowerCase() && params.recipient.toLowerCase() !== SWAP_ROUTER.toLowerCase()) ||
            ![100, 500, 3000, 10000].includes(params.fee) || params.sqrtPriceLimitX96 !== 0n ||
            params.amountIn <= 0n || params.amountOutMinimum <= 0n) deny();
        inputAsset = nativeIn ? NATIVE_ASSET : params.tokenIn;
        inputAmount = params.amountIn;
        outputAsset = params.tokenOut;
        swapRecipient = params.recipient;
        hasSwap = true;
      } else if (inner.functionName === "unwrapWETH9") {
        const [minimum, recipient] = inner.args as readonly [bigint, Address];
        if (didUnwrap || minimum <= 0n || recipient.toLowerCase() !== wallet.toLowerCase()) deny();
        didUnwrap = true;
      } else return deny();
    }
    if (!hasSwap || !inputAsset || !outputAsset || !swapRecipient ||
        (inputAsset !== NATIVE_ASSET && value !== 0n) ||
        (swapRecipient.toLowerCase() === SWAP_ROUTER.toLowerCase() && (!didUnwrap || outputAsset.toLowerCase() !== weth.toLowerCase())) ||
        (didUnwrap && (swapRecipient.toLowerCase() !== SWAP_ROUTER.toLowerCase() || outputAsset.toLowerCase() !== weth.toLowerCase()))) deny();
    await reserveDailySpend(wallet, inputAsset, inputAmount, digest, deadline);
    return;
  }

  deny("this contract is not on Veilora's co-signing allowlist");
}
