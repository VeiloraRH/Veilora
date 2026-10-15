import {
  createPublicClient,
  defineChain,
  encodeFunctionData,
  encodeAbiParameters,
  erc20Abi,
  getAddress,
  http,
  isAddress,
  keccak256,
  parseAbi,
  parseUnits,
  stringToHex,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { decryptDeviceKey } from './deviceKeyVault';
import { keyMatches, parseDeviceKeyBackup, unlockBackup, type DeviceKeyBackup } from './recovery';
import { verifyRpcEndpoint } from './rpcSettings';
import { WALLET_TOKENS } from './tokens';

export const EXIT_RPC_DEFAULT = 'https://rpc.mainnet.chain.robinhood.com';
export const EXIT_CHAIN = defineChain({
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [EXIT_RPC_DEFAULT] } },
});

const accountAbi = parseAbi([
  'function shardA() view returns (address)',
  'function shardC() view returns (address)',
  'function nonce() view returns (uint256)',
  'function executeWithSignatures(address target,uint256 value,bytes data,uint256 nonce,uint256 deadline,bytes signatures) returns (bytes result)',
]);
const DEVICE_KEY = 'veilora:shardA:encrypted';
const DEVICE_ADDRESS = 'veilora:shardA:address';

export function createExitClient(rpcUrl: string) {
  return createPublicClient({ chain: EXIT_CHAIN, transport: http(rpcUrl, { timeout: 15_000 }) });
}

export async function unlockLocalShardA(passphrase: string, wallet: Address): Promise<Hex> {
  const encrypted = localStorage.getItem(DEVICE_KEY);
  const address = localStorage.getItem(DEVICE_ADDRESS);
  if (!encrypted || !address) throw new Error('This browser does not have an encrypted Shard A for this wallet. Import your Veilora device-key backup instead.');
  let privateKey: string;
  try { privateKey = await decryptDeviceKey(encrypted, passphrase); }
  catch { throw new Error('Could not unlock the device key. Check the passphrase and try again.'); }
  if (!keyMatches(privateKey, address)) throw new Error('The stored device key does not match its recorded address.');
  const configuredWallet = localStorage.getItem('veilora:wallet_address');
  if (configuredWallet?.toLowerCase() !== wallet.toLowerCase()) throw new Error('The device key stored here belongs to a different Veilora account.');
  return privateKey as Hex;
}

export async function readOnchainOwners(rpcUrl: string, wallet: Address) {
  const verifiedRpc = await verifyRpcEndpoint(rpcUrl);
  const client = createExitClient(verifiedRpc);
  const chainId = await client.getChainId();
  if (chainId !== 4663) throw new Error(`This RPC reports chain ${chainId}; Robinhood Chain (4663) is required.`);
  const [shardA, shardC, nonce] = await Promise.all([
    client.readContract({ address: wallet, abi: accountAbi, functionName: 'shardA' }),
    client.readContract({ address: wallet, abi: accountAbi, functionName: 'shardC' }),
    client.readContract({ address: wallet, abi: accountAbi, functionName: 'nonce' }),
  ]);
  return { client, shardA, shardC, nonce };
}

export async function readExitBalance(rpcUrl: string, wallet: Address, tokenSymbol: string): Promise<bigint> {
  const token = WALLET_TOKENS.find(item => item.symbol === tokenSymbol);
  if (!token) throw new Error('Choose a supported asset.');
  const client = createExitClient(rpcUrl);
  if (token.native) return client.getBalance({ address: wallet });
  return client.readContract({ address: token.address, abi: erc20Abi, functionName: 'balanceOf', args: [wallet] });
}

export function parseExitAmount(amount: string, decimals: number): bigint {
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(amount) || (amount.split('.')[1]?.length ?? 0) > decimals) {
    throw new Error(`Enter an amount with at most ${decimals} decimal places.`);
  }
  const raw = parseUnits(amount, decimals);
  if (raw <= 0n) throw new Error('Enter an amount greater than zero.');
  return raw;
}

export async function prepareExitTransaction(args: {
  rpcUrl: string;
  wallet: Address;
  accountVersion: 1 | 2;
  shardAKey: Hex;
  shardCKey: Hex;
  tokenSymbol: string;
  recipient: Address;
  amount: bigint;
}) {
  const token = WALLET_TOKENS.find(item => item.symbol === args.tokenSymbol);
  if (!token) throw new Error('Choose a supported asset.');
  const { client, shardA, shardC, nonce } = await readOnchainOwners(args.rpcUrl, args.wallet);
  if (privateKeyToAccount(args.shardAKey).address.toLowerCase() !== shardA.toLowerCase()) throw new Error('Shard A does not match this account’s on-chain device key.');
  if (privateKeyToAccount(args.shardCKey).address.toLowerCase() !== shardC.toLowerCase()) throw new Error('Shard C does not match this account’s on-chain recovery key.');
  const balance = token.native
    ? await client.getBalance({ address: args.wallet })
    : await client.readContract({ address: token.address, abi: erc20Abi, functionName: 'balanceOf', args: [args.wallet] });
  if (args.amount > balance) throw new Error(`Insufficient ${token.symbol} balance.`);

  const target = token.native ? args.recipient : token.address;
  const value = token.native ? args.amount : 0n;
  const data = token.native ? '0x' as Hex : encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [args.recipient, args.amount] });
  const deadline = Math.floor(Date.now() / 1000) + 240;
  const type = args.accountVersion === 2
    ? 'VeiloraExecutionV2(address account,address target,uint256 value,bytes data,uint256 nonce,uint256 deadline,uint256 chainId)'
    : 'VeiloraExecution(address target,uint256 value,bytes data,uint256 nonce,uint256 deadline,uint256 chainId)';
  const typeHash = keccak256(stringToHex(type));
  const digest = args.accountVersion === 2
    ? keccak256(encodeAbiParametersV2(typeHash, args.wallet, target, value, data, nonce, deadline))
    : keccak256(encodeAbiParametersV1(typeHash, target, value, data, nonce, deadline));
  const signatureA = await privateKeyToAccount(args.shardAKey).signMessage({ message: { raw: digest } });
  const signatureC = await privateKeyToAccount(args.shardCKey).signMessage({ message: { raw: digest } });
  const signatures = `0x${signatureA.slice(2)}${signatureC.slice(2)}` as Hex;
  const callData = encodeFunctionData({ abi: accountAbi, functionName: 'executeWithSignatures', args: [target, value, data, nonce, BigInt(deadline), signatures] });
  return { callData };
}

// Kept local to this standalone path so it has no imports from the hosted wallet/relay client.
function encodeAbiParametersV1(typeHash: Hex, target: Address, value: bigint, data: Hex, nonce: bigint, deadline: number) {
  return encodeAbiParameters(
    [{ type: 'bytes32' }, { type: 'address' }, { type: 'uint256' }, { type: 'bytes32' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }],
    [typeHash, target, value, keccak256(data), nonce, BigInt(deadline), 4663n],
  );
}
function encodeAbiParametersV2(typeHash: Hex, wallet: Address, target: Address, value: bigint, data: Hex, nonce: bigint, deadline: number) {
  return encodeAbiParameters(
    [{ type: 'bytes32' }, { type: 'address' }, { type: 'address' }, { type: 'uint256' }, { type: 'bytes32' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }],
    [typeHash, wallet, target, value, keccak256(data), nonce, BigInt(deadline), 4663n],
  );
}

export function parseBackupFile(text: string): DeviceKeyBackup { return parseDeviceKeyBackup(text); }
export async function unlockImportedShardA(backup: DeviceKeyBackup, passphrase: string, wallet: Address): Promise<Hex> {
  if (backup.wallet.toLowerCase() !== wallet.toLowerCase()) throw new Error('This backup belongs to a different account address.');
  return unlockBackup(backup, passphrase);
}
export function validateExitInputs(walletText: string, recipientText: string): { wallet: Address; recipient: Address } {
  if (!isAddress(walletText)) throw new Error('Enter a valid Veilora smart-account address.');
  if (!isAddress(recipientText)) throw new Error('Enter a valid destination address.');
  return { wallet: getAddress(walletText), recipient: getAddress(recipientText) };
}
