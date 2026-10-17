import { getAddress, isAddress } from 'viem';

export interface WalletNft {
 id:string;
 contractAddress:`0x${string}`;
 tokenId:string;
 tokenType:'ERC-721'|'ERC-1155';
 amount:string;
 collectionName:string;
 name:string;
 description?:string;
 imageUrl?:string;
}
export interface ExplorerNft {
 id?:unknown;token_type?:unknown;value?:unknown;is_unique?:unknown;image_url?:unknown;
 metadata?:{name?:unknown;description?:unknown;image?:unknown;image_url?:unknown}|null;
 token?:{address?:unknown;address_hash?:unknown;name?:unknown;symbol?:unknown}|null;
}
const stringValue=(value:unknown):string|undefined=>typeof value==='string'&&value.trim()?value.trim():undefined;

function resolveNftImage(value:unknown):string|undefined {
 const image=stringValue(value);
 if(!image)return;
 if(image.startsWith('ipfs://'))return `https://ipfs.io/ipfs/${image.slice('ipfs://'.length).replace(/^ipfs\//,'')}`;
 if(image.startsWith('https://'))return image;
 if(image.startsWith('ar://'))return `https://arweave.net/${image.slice('ar://'.length)}`;
 return;
}

export function parseExplorerNft(item:ExplorerNft):WalletNft|null {
 const tokenType=item.token_type;
 const tokenId=stringValue(item.id);
 const address=stringValue(item.token?.address)||stringValue(item.token?.address_hash);
 if((tokenType!=='ERC-721'&&tokenType!=='ERC-1155')||!tokenId||!address||!isAddress(address)||!/^\d+$/.test(tokenId))return null;
 const contractAddress=getAddress(address);
 const metadata=item.metadata;
 const collectionName=stringValue(item.token?.name)||stringValue(item.token?.symbol)||'Unknown collection';
 return {
  id:`${contractAddress.toLowerCase()}:${tokenId}:${tokenType}`,
  contractAddress,
  tokenId,
  tokenType,
  amount:stringValue(item.value)||'1',
  collectionName,
  name:stringValue(metadata?.name)||`${collectionName} #${tokenId}`,
  description:stringValue(metadata?.description),
  imageUrl:resolveNftImage(item.image_url)||resolveNftImage(metadata?.image_url)||resolveNftImage(metadata?.image),
 };
}
