import { encodeFunctionData, getAddress, parseAbi, type Address, type Hex } from 'viem';
import type { WalletNft } from './nftHoldings';

/** Mirrors the co-signer: only these two calls move an NFT, and only out of the account. */
const ERC721 = parseAbi(['function safeTransferFrom(address from,address to,uint256 tokenId)']);
const ERC1155 = parseAbi(['function safeTransferFrom(address from,address to,uint256 id,uint256 amount,bytes data)']);
export const NFT_DAILY_TRANSFER_LIMIT = 5;

export function nftHeld(nft: WalletNft): bigint {
 try { return nft.tokenType === 'ERC-1155' ? BigInt(nft.amount) : 1n; } catch { return 1n; }
}

export function nftTransferCall(wallet: Address, nft: WalletNft, recipient: Address, amount = 1n): { target: Address; value: bigint; data: Hex } {
 const from = getAddress(wallet);
 const to = getAddress(recipient);
 const tokenId = BigInt(nft.tokenId);
 const data = nft.tokenType === 'ERC-721'
  ? encodeFunctionData({ abi: ERC721, functionName: 'safeTransferFrom', args: [from, to, tokenId] })
  : encodeFunctionData({ abi: ERC1155, functionName: 'safeTransferFrom', args: [from, to, tokenId, amount, '0x'] });
 return { target: getAddress(nft.contractAddress), value: 0n, data };
}

/** NFT transfers left today under the co-signer's daily count, from the spending-policy response. */
export function nftTransfersLeft(policy: { nftDailyLimit?: number; dailySpend: Record<string, { spent: string }> } | undefined): number | null {
 if (!policy) return null;
 const limit = policy.nftDailyLimit ?? NFT_DAILY_TRANSFER_LIMIT;
 const used = Number(policy.dailySpend.nft?.spent ?? '0');
 return Math.max(0, limit - used);
}
