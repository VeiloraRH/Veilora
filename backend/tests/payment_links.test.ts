import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import request from "supertest";
import { encodeFunctionData, erc20Abi, getAddress, parseEther, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { app } from "../src/app";
import { query } from "../src/db/index";
import { archiveLinkMessage, checkSweepTransaction, createLinkMessage, listLinksMessage } from "../src/routes/paymentLinks";

const device = privateKeyToAccount(generatePrivateKey());
const link = privateKeyToAccount(generatePrivateKey());
const stranger = privateKeyToAccount(generatePrivateKey());
const wallet = getAddress("0x5555555555555555555555555555555555555555");
const USDG = getAddress("0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168");
const base = `/v1/wallets/${wallet}/payment-links`;
const now = () => Math.floor(Date.now() / 1000);

async function create(body: Partial<{ linkAddress: string; asset: string; amount: string; note: string }> = {}, signers = { shardA: device, link }) {
  const payload = { linkAddress: link.address, asset: "USDG", amount: "25000000", note: "Design invoice #12", ...body };
  const t = now();
  const message = createLinkMessage(wallet, payload.linkAddress, payload.asset, payload.amount, payload.note, t);
  return request(app).post(base).send({ ...payload, timestamp: t, shardASignature: await signers.shardA.signMessage({ message }), linkSignature: await signers.link.signMessage({ message }) });
}

describe("payment links", () => {
  beforeAll(async () => {
    await query(
      `INSERT INTO wallets (address, factory_address, chain_id, shard_a_address, shard_b_address, shard_b_encrypted, shard_c_address, api_key_hash)
       VALUES ($1, $2, 4663, $3, $4, 'test', $5, 'test') ON CONFLICT (address) DO NOTHING`,
      [wallet.toLowerCase(), "0xf86bea538ea756048f8df9be4bcd88aeb4d65376", device.address.toLowerCase(), stranger.address.toLowerCase(), stranger.address.toLowerCase()],
    );
  });
  afterAll(async () => {
    await query("DELETE FROM wallets WHERE address = $1", [wallet.toLowerCase()]);
  });

  let slug = "";
  test("creating needs the device key and proof of the link key", async () => {
    expect((await create({}, { shardA: stranger, link })).status).toBe(403);
    expect((await create({}, { shardA: device, link: stranger })).status).toBe(403);
    expect((await create({ asset: "NVDA" })).status).toBe(400);
    expect((await create({ note: "line one\nline two" })).status).toBe(400);
    expect((await create({ amount: "1.5" })).status).toBe(400);
    const created = await create();
    expect(created.status).toBe(201);
    expect(created.body.link).toMatchObject({ linkAddress: link.address, asset: "USDG", amount: "25000000", note: "Design invoice #12", archived: false });
    slug = created.body.link.slug;
    expect(slug).toMatch(/^[a-z0-9]{12}$/);
    expect((await create()).status).toBe(409);
  });

  test("the public view shows what to pay, never the wallet", async () => {
    const res = await request(app).get(`/v1/payment-links/${slug}`);
    expect(res.status).toBe(200);
    expect(res.body.link.linkAddress).toBe(link.address);
    expect(JSON.stringify(res.body).toLowerCase()).not.toContain(wallet.slice(2).toLowerCase());
    expect((await request(app).get("/v1/payment-links/nope")).status).toBe(404);
  });

  test("listing and archiving are signed by the device key", async () => {
    const t = now();
    expect((await request(app).get(base).set("x-veilora-timestamp", String(t)).set("x-veilora-signature", await stranger.signMessage({ message: listLinksMessage(wallet, t) }))).status).toBe(403);
    const listed = await request(app).get(base).set("x-veilora-timestamp", String(t)).set("x-veilora-signature", await device.signMessage({ message: listLinksMessage(wallet, t) }));
    expect(listed.body.links.map((l: { slug: string }) => l.slug)).toEqual([slug]);
    const archived = await request(app).post(`${base}/${slug}/archive`).send({ timestamp: t, shardASignature: await device.signMessage({ message: archiveLinkMessage(wallet, slug, t) }) });
    expect(archived.body.link.archived).toBe(true);
  });

  test("moving funds accepts only the link's own transfer into the wallet", async () => {
    const sign = (account = link, tx: Record<string, unknown> = {}) => account.signTransaction({ type: "eip1559", chainId: 4663, nonce: 0, gas: 60_000n, maxFeePerGas: 1_000_000n, maxPriorityFeePerGas: 1n, to: wallet, value: parseEther("0.01"), ...tx } as Parameters<typeof link.signTransaction>[0]) as Promise<Hex>;
    const usdgTo = (to: Hex) => ({ to: USDG, value: 0n, data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [to, 25_000_000n] }) });

    expect(await checkSweepTransaction(link.address, wallet, await sign())).toMatchObject({ kind: "ETH", amount: parseEther("0.01") });
    expect(await checkSweepTransaction(link.address, wallet, await sign(link, usdgTo(wallet)))).toMatchObject({ kind: "USDG", amount: 25_000_000n });

    await expect(checkSweepTransaction(link.address, wallet, await sign(stranger))).rejects.toThrow("signed by this payment link");
    await expect(checkSweepTransaction(link.address, wallet, await sign(link, { to: stranger.address }))).rejects.toThrow("into your own account");
    await expect(checkSweepTransaction(link.address, wallet, await sign(link, usdgTo(stranger.address)))).rejects.toThrow("into your own account");
    await expect(checkSweepTransaction(link.address, wallet, await sign(link, { ...usdgTo(wallet), data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [stranger.address, 1n] }) }))).rejects.toThrow("into your own account");
    await expect(checkSweepTransaction(link.address, wallet, await sign(link, { chainId: 1 }))).rejects.toThrow("another network");
    await expect(checkSweepTransaction(link.address, wallet, await sign(link, { gas: 5_000_000n }))).rejects.toThrow("gas settings");
    await expect(checkSweepTransaction(link.address, wallet, "0x1234")).rejects.toThrow();
  });
});
