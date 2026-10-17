import { expect, test } from 'bun:test';
import { parseExplorerNft } from '../src/lib/nftHoldings';

const contract='0x389f417578d0b3d503c363d6439ea4ec918cfb70';

test('maps indexed ERC-721 metadata to a safe display model',()=>{
 const item=parseExplorerNft({
  id:'42',token_type:'ERC-721',value:'1',token:{address:contract,name:'Collection'},
  metadata:{name:'Edition 42',description:'Artwork',image:'ipfs://bafybeigdyrzt/example.png'},
 });
 expect(item).toMatchObject({tokenId:'42',tokenType:'ERC-721',amount:'1',collectionName:'Collection',name:'Edition 42',description:'Artwork',imageUrl:'https://ipfs.io/ipfs/bafybeigdyrzt/example.png'});
});

test('preserves ERC-1155 quantity and accepts HTTPS images',()=>{
 const item=parseExplorerNft({id:'7',token_type:'ERC-1155',value:'12',token:{address:contract,symbol:'ITEM'},image_url:'https://media.example/item.png'});
 expect(item).toMatchObject({tokenId:'7',tokenType:'ERC-1155',amount:'12',collectionName:'ITEM',imageUrl:'https://media.example/item.png'});
});

test('ignores unsupported token types, invalid addresses, malformed IDs, and unsafe image schemes',()=>{
 expect(parseExplorerNft({id:'1',token_type:'ERC-20',token:{address:contract}})).toBeNull();
 expect(parseExplorerNft({id:'1',token_type:'ERC-721',token:{address:'not-address'}})).toBeNull();
 expect(parseExplorerNft({id:'x',token_type:'ERC-721',token:{address:contract}})).toBeNull();
 expect(parseExplorerNft({id:'1',token_type:'ERC-721',token:{address:contract},image_url:'data:image/svg+xml,<svg/>'})?.imageUrl).toBeUndefined();
});
