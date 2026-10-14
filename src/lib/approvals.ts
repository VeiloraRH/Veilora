import { encodeFunctionData, erc20Abi, getAddress, maxUint256, type Address, type Hex } from 'viem';
import { WALLET_TOKENS, type WalletToken } from './tokens';
import { chainClient, executeWalletCall, SWAP_ROUTER, UNISWAP_V4_ADAPTER } from './walletChain';

/** Contracts Veilora's co-signer lets the account approve. Approvals to anything else cannot be created through Veilora. */
export const KNOWN_SPENDERS: { address: Address; label: string; purpose: string }[] = [
 { address: SWAP_ROUTER, label: 'Uniswap v3 router', purpose: 'Swaps' },
 { address: UNISWAP_V4_ADAPTER, label: 'Uniswap v4 adapter', purpose: 'Swaps' },
 { address: getAddress('0x4cd00e387622c35bddb9b4c962c136462338bc31'), label: 'Relay bridge', purpose: 'Bridging' },
];
// Deployed at the same address on most EVM chains, including Robinhood Chain.
const MULTICALL3 = getAddress('0xcA11bde05977b3631167028862bE2a173976CA11');
const UNLIMITED = maxUint256 / 2n;

export type TokenApproval = { token: WalletToken; spender: (typeof KNOWN_SPENDERS)[number]; amount: bigint; unlimited: boolean };

/** Every open allowance from this account to a known spender, read in one call. */
export async function readApprovals(wallet: Address): Promise<TokenApproval[]> {
 const tokens = WALLET_TOKENS.filter(t => !t.native);
 const pairs = tokens.flatMap(token => KNOWN_SPENDERS.map(spender => ({ token, spender })));
 const results = await chainClient.multicall({
  multicallAddress: MULTICALL3,
  allowFailure: true,
  contracts: pairs.map(p => ({ address: p.token.address, abi: erc20Abi, functionName: 'allowance' as const, args: [wallet, p.spender.address] as const })),
 });
 if (results.every(r => r.status === 'failure')) throw new Error('Approvals could not be read from Robinhood Chain. Try again shortly.');
 return pairs.flatMap((p, i) => {
  const r = results[i];
  if (r.status !== 'success' || (r.result as bigint) === 0n) return [];
  const amount = r.result as bigint;
  return [{ ...p, amount, unlimited: amount >= UNLIMITED }];
 });
}

export const revokeCall = (approval: TokenApproval) => ({
 target: approval.token.address,
 value: 0n,
 data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [approval.spender.address, 0n] }) as Hex,
});

/** Set the allowance to zero, signed by the device key and co-signer like any other action. */
export async function revokeApproval(wallet: Address, key: Hex, approval: TokenApproval): Promise<string> {
 const call = revokeCall(approval);
 return executeWalletCall(wallet, key, call.target, call.value, call.data);
}
