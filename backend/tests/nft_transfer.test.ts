import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { encodeFunctionData, getAddress, type Hex } from "viem";
import { query } from "../src/db/index";
import { ERC1155_TRANSFER_ABI, ERC721_TRANSFER_ABI, decodeNftTransfer } from "../src/nftTransfer";
import { explainCall } from "../src/txExplain";
import { NFT_ASSET, NFT_DAILY_TRANSFER_LIMIT, checkNftTransfer, reserveNftTransfer, settleDailySpend } from "../src/txPolicy";

const wallet = getAddress("0x4444444444444444444444444444444444444444");
const friend = getAddress("0x2222222222222222222222222222222222222222");
const collection = getAddress("0x6666666666666666666666666666666666666666");
const USDG = getAddress("0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168");
const zero = getAddress("0x0000000000000000000000000000000000000000");

const erc721 = (from: Hex, to: Hex, id = 7n) => encodeFunctionData({ abi: ERC721_TRANSFER_ABI, functionName: "safeTransferFrom", args: [from, to, id] });
const erc1155 = (from: Hex, to: Hex, amount = 2n, data: Hex = "0x") => encodeFunctionData({ abi: ERC1155_TRANSFER_ABI, functionName: "safeTransferFrom", args: [from, to, 9n, amount, data] });
const digest = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as Hex;
const deadline = () => BigInt(Math.floor(Date.now() / 1000) + 240);

describe("NFT transfer decoding", () => {
  test("reads both standards and ignores other calls", () => {
    expect(decodeNftTransfer(erc721(wallet, friend))).toMatchObject({ standard: "ERC-721", from: wallet, to: friend, tokenId: 7n, amount: 1n });
    expect(decodeNftTransfer(erc1155(wallet, friend, 3n))).toMatchObject({ standard: "ERC-1155", tokenId: 9n, amount: 3n, data: "0x" });
    expect(decodeNftTransfer("0xdeadbeef")).toBeNull();
    expect(decodeNftTransfer("0x42842e0e1234")).toBeNull();
  });
});

describe("co-signer NFT shape checks", () => {
  test("accepts a single NFT leaving the account", () => {
    expect(checkNftTransfer(wallet, collection, 0n, erc721(wallet, friend))?.standard).toBe("ERC-721");
    expect(checkNftTransfer(wallet, collection, 0n, erc1155(wallet, friend))?.amount).toBe(2n);
    expect(checkNftTransfer(wallet, collection, 0n, "0xdeadbeef")).toBeNull();
  });

  test("refuses transfers Veilora should not sign", () => {
    expect(() => checkNftTransfer(wallet, collection, 0n, erc721(friend, wallet))).toThrow("out of your own account");
    expect(() => checkNftTransfer(wallet, collection, 0n, erc721(wallet, zero))).toThrow("destroy the NFT");
    expect(() => checkNftTransfer(wallet, collection, 0n, erc721(wallet, collection))).toThrow("destroy the NFT");
    expect(() => checkNftTransfer(wallet, collection, 0n, erc721(wallet, wallet))).toThrow("does nothing");
    expect(() => checkNftTransfer(wallet, collection, 1n, erc721(wallet, friend))).toThrow("Shard B policy denied");
    expect(() => checkNftTransfer(wallet, wallet, 0n, erc721(wallet, friend))).toThrow("Shard B policy denied");
    expect(() => checkNftTransfer(wallet, USDG, 0n, erc721(wallet, friend))).toThrow("Shard B policy denied");
    expect(() => checkNftTransfer(wallet, collection, 0n, erc1155(wallet, friend, 0n))).toThrow("Shard B policy denied");
    expect(() => checkNftTransfer(wallet, collection, 0n, erc1155(wallet, friend, 1n, "0x01"))).toThrow("Shard B policy denied");
  });
});

describe("daily NFT transfer limit", () => {
  beforeAll(async () => {
    await query(
      `INSERT INTO wallets (address, factory_address, chain_id, shard_a_address, shard_b_address, shard_b_encrypted, shard_c_address, api_key_hash)
       VALUES ($1, $2, 4663, $3, $4, 'test', $5, 'test') ON CONFLICT (address) DO NOTHING`,
      [wallet.toLowerCase(), "0xf86bea538ea756048f8df9be4bcd88aeb4d65376", friend.toLowerCase(), collection.toLowerCase(), USDG.toLowerCase()],
    );
  });
  afterAll(async () => {
    await query("DELETE FROM wallets WHERE address = $1", [wallet.toLowerCase()]);
  });

  test(`allows ${NFT_DAILY_TRANSFER_LIMIT} a day, counts mined and pending transfers, and reuses a retried signature`, async () => {
    for (let i = 1; i < NFT_DAILY_TRANSFER_LIMIT; i++) await reserveNftTransfer(wallet, digest(i), deadline());
    await settleDailySpend(wallet, digest(1), true, digest(101));
    await settleDailySpend(wallet, digest(2), false);
    await reserveNftTransfer(wallet, digest(NFT_DAILY_TRANSFER_LIMIT), deadline());
    await reserveNftTransfer(wallet, digest(NFT_DAILY_TRANSFER_LIMIT + 1), deadline());
    await reserveNftTransfer(wallet, digest(3), deadline());
    await expect(reserveNftTransfer(wallet, digest(99), deadline())).rejects.toThrow(`up to ${NFT_DAILY_TRANSFER_LIMIT} NFTs a day and have used ${NFT_DAILY_TRANSFER_LIMIT} today`);
    const spent = await query<{ amount_wei: string }>("SELECT amount_wei::text FROM wallet_daily_spend WHERE wallet_address = $1 AND asset_address = $2", [wallet.toLowerCase(), NFT_ASSET]);
    expect(spent.rows[0].amount_wei).toBe("1");
  });
});

describe("explaining NFT transfers", () => {
  test("names the NFT and recipient instead of an unrecognized call", () => {
    const one = explainCall(wallet, { target: collection, value: 0n, data: erc721(wallet, friend) });
    expect(one.kind).toBe("nft-send");
    expect(one.title).toBe("Send NFT #7");
    expect(one.effects[0]).toMatchObject({ direction: "out", amount: "1", counterparty: friend });
    expect(one.flags).toEqual([]);
    expect(explainCall(wallet, { target: collection, value: 0n, data: erc1155(wallet, friend, 3n) }).title).toBe("Send 3 × NFT #9");
    expect(explainCall(wallet, { target: collection, value: 0n, data: erc721(friend, wallet) }).flags.map((f) => f.code)).toEqual(["foreign-owner"]);
  });
});
