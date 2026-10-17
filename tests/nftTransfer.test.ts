import { expect, test } from 'bun:test';
import { decodeFunctionData, getAddress, parseAbi } from 'viem';
import type { WalletNft } from '../src/lib/nftHoldings';
import { nftHeld, nftTransferCall, nftTransfersLeft } from '../src/lib/nftTransfer';

const wallet = getAddress('0x4444444444444444444444444444444444444444');
const friend = getAddress('0x2222222222222222222222222222222222222222');
const nft = (tokenType: WalletNft['tokenType'], amount = '1'): WalletNft => ({ id: 'x', contractAddress: getAddress('0x6666666666666666666666666666666666666666'), tokenId: '42', tokenType, amount, collectionName: 'Test', name: 'Test #42' });

test('builds the exact transfer calls the co-signer accepts', () => {
 const single = nftTransferCall(wallet, nft('ERC-721'), friend);
 expect(single.target).toBe(getAddress('0x6666666666666666666666666666666666666666'));
 expect(single.value).toBe(0n);
 expect(single.data.slice(0, 10)).toBe('0x42842e0e');
 expect(decodeFunctionData({ abi: parseAbi(['function safeTransferFrom(address,address,uint256)']), data: single.data }).args).toEqual([wallet, friend, 42n]);

 const multi = nftTransferCall(wallet, nft('ERC-1155', '5'), friend, 3n);
 expect(multi.data.slice(0, 10)).toBe('0xf242432a');
 expect(decodeFunctionData({ abi: parseAbi(['function safeTransferFrom(address,address,uint256,uint256,bytes)']), data: multi.data }).args).toEqual([wallet, friend, 42n, 3n, '0x']);
});

test('counts copies held and transfers left today', () => {
 expect(nftHeld(nft('ERC-721', '1'))).toBe(1n);
 expect(nftHeld(nft('ERC-1155', '12'))).toBe(12n);
 expect(nftTransfersLeft(undefined)).toBeNull();
 expect(nftTransfersLeft({ dailySpend: {} })).toBe(5);
 expect(nftTransfersLeft({ nftDailyLimit: 5, dailySpend: { nft: { spent: '2' } } })).toBe(3);
 expect(nftTransfersLeft({ nftDailyLimit: 5, dailySpend: { nft: { spent: '9' } } })).toBe(0);
});
