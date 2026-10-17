import { encodeFunctionData, erc20Abi, getAddress, hexToBytes, type Address, type Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { API_BASE } from './api';
import { chainClient } from './walletChain';
import { ROBINHOOD_TOKEN_REGISTRY } from './tokens';

/**
 * Payment links: a one-time address someone can pay without seeing this
 * wallet's address. The link's key is made here and stored only on this device,
 * encrypted with a key derived from the unlocked device key (Shard A). Veilora
 * keeps the link's public details and relays the link's own transfer into the
 * wallet. Until moved, funds at a link are guarded only by that local key.
 */
export type PaymentAsset = 'ETH' | 'USDG';
export type PaymentLink = { slug: string; linkAddress: Address; asset: PaymentAsset; amount: string | null; note: string; createdAt: string; archived: boolean };
export const USDG = ROBINHOOD_TOKEN_REGISTRY.USDG;
export const assetDecimals = (asset: PaymentAsset) => asset === 'ETH' ? 18 : USDG.decimals;

const STORE = (wallet: string) => `veilora:payment-links:${wallet.toLowerCase()}`;
const KEY_MESSAGE = 'Veilora payment link key v1\nThis signature encrypts payment link keys on this device.';
const now = () => Math.floor(Date.now() / 1000);
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (text: string) => Uint8Array.from(atob(text), c => c.charCodeAt(0));

export const createLinkMessage = (wallet: string, link: string, asset: string, amount: string, note: string, timestamp: number) =>
 `Veilora payment link create\nwallet:${getAddress(wallet)}\nlink:${getAddress(link)}\nasset:${asset}\namount:${amount || 'any'}\nnote:${note}\ntimestamp:${timestamp}`;
const listLinksMessage = (wallet: string, timestamp: number) => `Veilora payment links access\nwallet:${getAddress(wallet)}\ntimestamp:${timestamp}`;
const archiveLinkMessage = (wallet: string, slug: string, timestamp: number) => `Veilora payment link archive\nwallet:${getAddress(wallet)}\nslug:${slug}\ntimestamp:${timestamp}`;

/** Deterministic: the same device key always signs the same bytes, so it always derives the same AES key. */
async function cipherKey(deviceKey: Hex): Promise<CryptoKey> {
 const signature = await privateKeyToAccount(deviceKey).signMessage({ message: KEY_MESSAGE });
 const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(hexToBytes(signature)));
 return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

function readStore(wallet: string): Record<string, { iv: string; ct: string }> {
 try { const parsed = JSON.parse(localStorage.getItem(STORE(wallet)) || '{}'); return parsed && typeof parsed === 'object' ? parsed : {}; } catch { return {}; }
}

export async function storeLinkKey(wallet: string, deviceKey: Hex, linkKey: Hex) {
 const iv = crypto.getRandomValues(new Uint8Array(12));
 const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await cipherKey(deviceKey), new TextEncoder().encode(linkKey)));
 const address = privateKeyToAccount(linkKey).address.toLowerCase();
 localStorage.setItem(STORE(wallet), JSON.stringify({ ...readStore(wallet), [address]: { iv: b64(iv), ct: b64(ct) } }));
}

export async function readLinkKey(wallet: string, deviceKey: Hex, linkAddress: string): Promise<Hex | null> {
 const entry = readStore(wallet)[linkAddress.toLowerCase()];
 if (!entry) return null;
 try {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(entry.iv) }, await cipherKey(deviceKey), unb64(entry.ct));
  const key = new TextDecoder().decode(plain) as Hex;
  return privateKeyToAccount(key).address.toLowerCase() === linkAddress.toLowerCase() ? key : null;
 } catch { return null; }
}

export const hasLinkKey = (wallet: string, linkAddress: string) => !!readStore(wallet)[linkAddress.toLowerCase()];

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
 const response = await fetch(`${API_BASE}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } });
 const body = await response.json().catch(() => ({}));
 if (!response.ok) throw new Error(body.error || `Request failed with status ${response.status}`);
 return body as T;
}

export async function createPaymentLink(wallet: string, deviceKey: Hex, input: { asset: PaymentAsset; amount: string; note: string }): Promise<PaymentLink> {
 const linkKey = generatePrivateKey();
 const linkAccount = privateKeyToAccount(linkKey);
 // Keep the key before the server knows the address, so a paid link is never unrecoverable.
 await storeLinkKey(wallet, deviceKey, linkKey);
 const timestamp = now();
 const message = createLinkMessage(wallet, linkAccount.address, input.asset, input.amount, input.note, timestamp);
 const { link } = await request<{ link: PaymentLink }>(`/v1/wallets/${wallet}/payment-links`, { method: 'POST', body: JSON.stringify({
  linkAddress: linkAccount.address, asset: input.asset, amount: input.amount, note: input.note, timestamp,
  shardASignature: await privateKeyToAccount(deviceKey).signMessage({ message }), linkSignature: await linkAccount.signMessage({ message }),
 }) });
 return link;
}

export async function listPaymentLinks(wallet: string, deviceKey: Hex): Promise<PaymentLink[]> {
 const timestamp = now();
 const signature = await privateKeyToAccount(deviceKey).signMessage({ message: listLinksMessage(wallet, timestamp) });
 return (await request<{ links: PaymentLink[] }>(`/v1/wallets/${wallet}/payment-links`, { headers: { 'x-veilora-timestamp': String(timestamp), 'x-veilora-signature': signature } })).links;
}

export async function archivePaymentLink(wallet: string, deviceKey: Hex, slug: string): Promise<PaymentLink> {
 const timestamp = now();
 const shardASignature = await privateKeyToAccount(deviceKey).signMessage({ message: archiveLinkMessage(wallet, slug, timestamp) });
 return (await request<{ link: PaymentLink }>(`/v1/wallets/${wallet}/payment-links/${slug}/archive`, { method: 'POST', body: JSON.stringify({ timestamp, shardASignature }) })).link;
}

export const fetchPublicLink = async (slug: string) => (await request<{ link: PaymentLink }>(`/v1/payment-links/${encodeURIComponent(slug)}`)).link;
export const paymentLinkUrl = (slug: string) => `${window.location.origin}/pay/${slug}`;

export async function linkBalances(linkAddress: Address) {
 const [eth, usdg] = await Promise.all([
  chainClient.getBalance({ address: linkAddress }),
  chainClient.readContract({ address: USDG.address, abi: erc20Abi, functionName: 'balanceOf', args: [linkAddress] }),
 ]);
 return { eth, usdg };
}

const USDG_TRANSFER_GAS = 90_000n;
const ETH_TRANSFER_GAS = 21_000n;

/** Move everything a link holds into the wallet: USDG first (Veilora tops up its gas), then any ETH left above the fee. */
export async function moveLinkFunds(wallet: string, deviceKey: Hex, link: PaymentLink, onStatus: (message: string) => void = () => {}): Promise<Hex[]> {
 const linkKey = await readLinkKey(wallet, deviceKey, link.linkAddress);
 if (!linkKey) throw new Error('This link’s key is not on this device, so its funds can only be moved from the device that created it.');
 const account = privateKeyToAccount(linkKey);
 const to = getAddress(wallet);
 const hashes: Hex[] = [];
 const fees = await chainClient.estimateFeesPerGas();
 const maxFeePerGas = fees.maxFeePerGas * 2n;
 const maxPriorityFeePerGas = fees.maxPriorityFeePerGas ?? 0n;
 const sweep = async (tx: { to: Address; value: bigint; data?: Hex; gas: bigint }) => {
  const nonce = await chainClient.getTransactionCount({ address: account.address, blockTag: 'pending' });
  const rawTransaction = await account.signTransaction({ type: 'eip1559', chainId: 4663, nonce, maxFeePerGas, maxPriorityFeePerGas, ...tx });
  const { transactionHash } = await request<{ transactionHash: Hex }>(`/v1/payment-links/${link.slug}/sweep`, { method: 'POST', body: JSON.stringify({ rawTransaction }) });
  const receipt = await chainClient.waitForTransactionReceipt({ hash: transactionHash, timeout: 90_000 });
  if (receipt.status !== 'success') throw new Error(`The transfer reverted: ${transactionHash}`);
  hashes.push(transactionHash);
 };
 const first = await linkBalances(link.linkAddress);
 if (first.usdg > 0n) {
  onStatus('Moving USDG into your account…');
  await sweep({ to: USDG.address, value: 0n, gas: USDG_TRANSFER_GAS, data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [to, first.usdg] }) });
 }
 const { eth } = await linkBalances(link.linkAddress);
 const fee = ETH_TRANSFER_GAS * maxFeePerGas;
 if (eth > fee * 2n) {
  onStatus('Moving ETH into your account…');
  await sweep({ to, value: eth - fee, gas: ETH_TRANSFER_GAS });
 }
 if (!hashes.length) throw new Error(eth > 0n ? 'This link only holds a little ETH, less than the network fee to move it.' : 'Nothing has been paid to this link yet.');
 return hashes;
}
