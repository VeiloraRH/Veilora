import { decodeFunctionData, parseAbi, type Address, type Hex } from "viem";

/**
 * The two NFT calls Veilora co-signs: ERC-721 safeTransferFrom(from,to,id) and
 * ERC-1155 safeTransferFrom(from,to,id,amount,data). Both the co-signer policy
 * and the transaction explainer read calls through this one decoder.
 */
export const ERC721_TRANSFER_ABI = parseAbi(["function safeTransferFrom(address from,address to,uint256 tokenId)"]);
export const ERC1155_TRANSFER_ABI = parseAbi(["function safeTransferFrom(address from,address to,uint256 id,uint256 amount,bytes data)"]);
export const ERC721_INTERFACE_ID = "0x80ac58cd";
export const ERC1155_INTERFACE_ID = "0xd9b67a26";

export type NftTransfer = {
  standard: "ERC-721" | "ERC-1155";
  from: Address;
  to: Address;
  tokenId: bigint;
  amount: bigint;
  data: Hex;
};

export function decodeNftTransfer(data: Hex): NftTransfer | null {
  const selector = data.slice(0, 10).toLowerCase();
  try {
    if (selector === "0x42842e0e") {
      const [from, to, tokenId] = decodeFunctionData({ abi: ERC721_TRANSFER_ABI, data }).args;
      return { standard: "ERC-721", from, to, tokenId, amount: 1n, data: "0x" };
    }
    if (selector === "0xf242432a") {
      const [from, to, tokenId, amount, extra] = decodeFunctionData({ abi: ERC1155_TRANSFER_ABI, data }).args;
      return { standard: "ERC-1155", from, to, tokenId, amount, data: extra };
    }
  } catch { /* malformed calldata is not an NFT transfer */ }
  return null;
}
