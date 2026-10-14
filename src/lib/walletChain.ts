import { createPublicClient, http, defineChain, erc20Abi, parseAbi, encodeAbiParameters, encodeFunctionData, keccak256, stringToHex, getAddress, parseUnits, formatUnits, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { API_BASE, cosignTransaction, broadcastTransaction } from './api';
import { WALLET_TOKENS, type WalletToken } from './tokens';

export const EXPLORER = 'https://robinhoodchain.blockscout.com';
export const ROBINHOOD_RPC_PROXY = `${API_BASE.replace(/\/$/, '')}/v1/rpc`;
export const chain = defineChain({ id: 4663, name: 'Robinhood Chain', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [ROBINHOOD_RPC_PROXY] } } });
export const chainClient = createPublicClient({ chain, transport: http(ROBINHOOD_RPC_PROXY, { batch: true }) });
// Same deployed Uniswap contracts and fee-tier search used by Curtain's operator.
export const SWAP_ROUTER = getAddress('0xcaf681a66d020601342297493863e78c959e5cb2');
const V3_QUOTER = getAddress('0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7');
export const UNISWAP_V4_ADAPTER = getAddress('0x2b50d96a0073baCe9e126fb012d46912298486F0');
const V4_QUOTER = getAddress('0x8dc178efb8111bb0973dd9d722ebeff267c98f94');
const routerAbi = parseAbi([
 'function WETH9() view returns (address)',
 'function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256)',
 'function unwrapWETH9(uint256 amountMinimum,address recipient) payable',
 'function multicall(uint256 deadline,bytes[] data) payable returns (bytes[] results)',
]);
const v3QuoterAbi = parseAbi(['function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)']);
const v4QuoterAbi = parseAbi([
 'struct PoolKey { address currency0; address currency1; uint24 fee; int24 tickSpacing; address hooks; }',
 'struct QuoteExactSingleParams { PoolKey poolKey; bool zeroForOne; uint128 exactAmount; bytes hookData; }',
 'function quoteExactInputSingle(QuoteExactSingleParams params) returns (uint256 amountOut,uint256 gasEstimate)',
]);
const v4AdapterAbi = parseAbi([
 'struct PoolKey { address currency0; address currency1; uint24 fee; int24 tickSpacing; address hooks; }',
 'function swapExactIn(PoolKey key,bool zeroForOne,uint256 amountIn,uint256 minOut,address recipient) returns (uint256 amountOut)',
]);
const V3_FEE_TIERS = [100, 500, 3000, 10000];
const V4_FEE_TIERS = [{ fee: 100, tickSpacing: 1 }, { fee: 500, tickSpacing: 10 }, { fee: 3000, tickSpacing: 60 }, { fee: 10000, tickSpacing: 200 }];
const NO_HOOKS = '0x0000000000000000000000000000000000000000' as Address;
export type V4Pool = { currency0: Address; currency1: Address; fee: number; tickSpacing: number; hooks: Address; zeroForOne: boolean };
export function rawAmount(amount: string, decimals: number) {
 if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(amount) || (amount.split('.')[1]?.length ?? 0) > decimals) throw new Error(`Enter a positive amount with at most ${decimals} decimal places.`);
 const raw = parseUnits(amount, decimals);
 if (raw <= 0n) throw new Error('Enter an amount greater than zero.');
 return raw;
}
export async function tokenBalance(wallet: Address, token: WalletToken) {
 return token.native ? chainClient.getBalance({ address: wallet }) : chainClient.readContract({ address: token.address, abi: erc20Abi, functionName: 'balanceOf', args: [wallet] });
}
export async function readHoldings(wallet: Address) {
 const entries = await Promise.all(WALLET_TOKENS.map(async token => {
  try { return { token, raw: await tokenBalance(wallet, token), error: false }; }
  catch { return { token, raw: null, error: true }; }
 }));
 if (entries.every(entry => entry.error)) throw new Error('Balances are unavailable. Please try again.');
 return entries;
}
export type Holding = Awaited<ReturnType<typeof readHoldings>>[number];
export const amountText = (value: bigint, decimals: number) => Number(formatUnits(value, decimals)).toLocaleString(undefined, { maximumFractionDigits: 6 });

// Leave a minute of headroom under the backend's five-minute limit for client/server clock skew.
export async function executeWalletCall(wallet: Address, privateKey: Hex, target: Address, value: bigint, data: Hex, deadline = Math.floor(Date.now()/1000)+240) {
 const nonce = await chainClient.readContract({ address: wallet, abi: parseAbi(['function nonce() view returns (uint256)']), functionName: 'nonce' });
 if (nonce > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Account nonce exceeds the supported range.');
 const typeHash = keccak256(stringToHex('VeiloraExecution(address target,uint256 value,bytes data,uint256 nonce,uint256 deadline,uint256 chainId)'));
 const digest = keccak256(encodeAbiParameters([{type:'bytes32'},{type:'address'},{type:'uint256'},{type:'bytes32'},{type:'uint256'},{type:'uint256'},{type:'uint256'}], [typeHash,target,value,keccak256(data),nonce,BigInt(deadline),4663n]));
 const shardASignature = await privateKeyToAccount(privateKey).signMessage({ message: { raw: digest } });
 const payload = { target, value: value.toString(), data, nonce: Number(nonce), deadline };
 const cosigned = await cosignTransaction(wallet, { ...payload, shardASignature });
 if (!cosigned.combinedSignatures) throw new Error('The co-signer did not return a complete signature.');
 const result = await broadcastTransaction({ ...payload, walletAddress: wallet, signatures: cosigned.combinedSignatures });
 if (!result.success) throw new Error(`Transaction reverted: ${result.transactionHash}`);
 return result.transactionHash;
}
export async function sendAsset(wallet: Address, privateKey: Hex, token: WalletToken, recipient: Address, amount: bigint) {
 if (amount > await tokenBalance(wallet,token)) throw new Error('Your balance is too low for this transfer.');
 return executeWalletCall(wallet,privateKey,token.native ? recipient : token.address,token.native ? amount : 0n, token.native ? '0x' : encodeFunctionData({abi:erc20Abi,functionName:'transfer',args:[recipient,amount]}));
}
export type SwapQuote = { amountOut: bigint; minOut: bigint; amountIn: bigint; fee: number; venue: 'uniswap-v3' | 'uniswap-v4'; gasEstimate: bigint; pool?: V4Pool; tokenIn: Address; tokenOut: Address; expiresAt: number };
export async function quoteSwap(input: WalletToken, output: WalletToken, amountIn: bigint, slippageBps: number): Promise<SwapQuote> {
 const weth = input.native || output.native ? await chainClient.readContract({address:SWAP_ROUTER,abi:routerAbi,functionName:'WETH9'}) : undefined;
 const tokenIn = input.native ? weth! : input.address;
 const tokenOut = output.native ? weth! : output.address;
 const candidates: Array<{venue:'uniswap-v3'|'uniswap-v4';fee:number;amountOut:bigint;gasEstimate:bigint;pool?:V4Pool}> = [];
 const v3 = await Promise.allSettled(V3_FEE_TIERS.map(async fee => {
  const result=await chainClient.simulateContract({address:V3_QUOTER,abi:v3QuoterAbi,functionName:'quoteExactInputSingle',args:[{tokenIn,tokenOut,amountIn,fee,sqrtPriceLimitX96:0n}]});
  return {venue:'uniswap-v3' as const,fee,amountOut:result.result[0],gasEstimate:BigInt(result.result[3])};
 }));
 for(const result of v3) if(result.status==='fulfilled'&&result.value.amountOut>0n)candidates.push(result.value);
 // The deployed adapter only handles ERC-20 pairs; native ETH uses the V3 router's WETH path.
 if(!input.native&&!output.native&&amountIn<2n**127n) {
  const zeroForOne=BigInt(tokenIn)<BigInt(tokenOut);
  const [currency0,currency1]=zeroForOne?[tokenIn,tokenOut]:[tokenOut,tokenIn];
  const v4=await Promise.allSettled(V4_FEE_TIERS.map(async ({fee,tickSpacing})=>{
   const pool:V4Pool={currency0,currency1,fee,tickSpacing,hooks:NO_HOOKS,zeroForOne};
   const result=await chainClient.simulateContract({address:V4_QUOTER,abi:v4QuoterAbi,functionName:'quoteExactInputSingle',args:[{poolKey:{currency0,currency1,fee,tickSpacing,hooks:NO_HOOKS},zeroForOne,exactAmount:amountIn,hookData:'0x'}]});
   return {venue:'uniswap-v4' as const,fee,amountOut:result.result[0],gasEstimate:result.result[1],pool};
  }));
  for(const result of v4) if(result.status==='fulfilled'&&result.value.amountOut>0n)candidates.push(result.value);
 }
 const best=candidates.reduce<typeof candidates[number]|null>((winner,candidate)=>!winner||candidate.amountOut>winner.amountOut?candidate:winner,null);
 if(!best) throw new Error('No live Uniswap v3 or v4 quote is available for this pair. Try another asset or amount.');
 return {...best,amountIn,tokenIn,tokenOut,minOut:best.amountOut*BigInt(10000-slippageBps)/10000n,expiresAt:Date.now()+60000};
}
export type PlannedCall = { target: Address; value: bigint; data: Hex };
/** The exact calls a swap will sign: an approval when allowance is short, then the swap. Used for review and execution alike. */
export async function planSwapCalls(wallet: Address, input: WalletToken, output: WalletToken, quote: SwapQuote): Promise<{ approval: PlannedCall | null; swap: PlannedCall; deadline?: number }> {
 let approval: PlannedCall | null = null;
 if (!input.native) {
  const spender=quote.venue==='uniswap-v4'?UNISWAP_V4_ADAPTER:SWAP_ROUTER;
  const allowance = await chainClient.readContract({address:input.address,abi:erc20Abi,functionName:'allowance',args:[wallet,spender]});
  if (allowance < quote.amountIn) approval={target:input.address,value:0n,data:encodeFunctionData({abi:erc20Abi,functionName:'approve',args:[spender,quote.amountIn]})};
 }
 if(quote.venue==='uniswap-v4') {
  if(!quote.pool||input.native||output.native)throw new Error('This Uniswap v4 route is not executable for native ETH. Refresh your quote to use Uniswap v3.');
  const {currency0,currency1,fee,tickSpacing,hooks,zeroForOne}=quote.pool;
  return {approval,swap:{target:UNISWAP_V4_ADAPTER,value:0n,data:encodeFunctionData({abi:v4AdapterAbi,functionName:'swapExactIn',args:[{currency0,currency1,fee,tickSpacing,hooks},zeroForOne,quote.amountIn,quote.minOut,wallet]})}};
 }
 const calls: Hex[] = [encodeFunctionData({abi:routerAbi,functionName:'exactInputSingle',args:[{tokenIn:quote.tokenIn,tokenOut:quote.tokenOut,fee:quote.fee,recipient:output.native ? SWAP_ROUTER : wallet,amountIn:quote.amountIn,amountOutMinimum:quote.minOut,sqrtPriceLimitX96:0n}]})];
 if (output.native) calls.push(encodeFunctionData({abi:routerAbi,functionName:'unwrapWETH9',args:[quote.minOut,wallet]}));
 const deadline = Math.floor(quote.expiresAt/1000);
 return {approval,swap:{target:SWAP_ROUTER,value:input.native ? quote.amountIn : 0n,data:encodeFunctionData({abi:routerAbi,functionName:'multicall',args:[BigInt(deadline),calls]})},deadline};
}
export async function performSwap(wallet: Address, key: Hex, input: WalletToken, output: WalletToken, quote: SwapQuote, onStatus: (message: string)=>void) {
 if (Date.now() >= quote.expiresAt) throw new Error('This quote expired. Get a fresh quote before swapping.');
 if (quote.amountIn > await tokenBalance(wallet,input)) throw new Error('Insufficient balance for this swap.');
 const plan = await planSwapCalls(wallet,input,output,quote);
 if (plan.approval) {
  onStatus('Approving token…');
  await executeWalletCall(wallet,key,plan.approval.target,plan.approval.value,plan.approval.data);
 }
 if (Date.now() >= quote.expiresAt) throw new Error('Token approved. Refresh your quote to complete the swap.');
 onStatus('Signing & swapping…');
 return plan.deadline===undefined ? executeWalletCall(wallet,key,plan.swap.target,plan.swap.value,plan.swap.data) : executeWalletCall(wallet,key,plan.swap.target,plan.swap.value,plan.swap.data,plan.deadline);
}
