import { randomBytes } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { decodeFunctionData, erc20Abi, getAddress, isAddress, isHex, parseTransaction, recoverMessageAddress, recoverTransactionAddress, type Address, type Hex } from "viem";
import { CHAIN_ID, USDG_ADDRESS, publicClient, relayerClient } from "../config";
import { query } from "../db/index";
import { getFreezeState } from "../freeze";
import { relayerFeeOverrides, reserveGas } from "./relayer";

/**
 * Payment links. Each link is a one-time address whose key exists only in the
 * creator's browser; payers see the link address, never the wallet's own. The
 * backend keeps the public details and relays the link's own signed transfer
 * into the wallet, topping up gas from the wallet's relayer budget when needed.
 */
export const walletPaymentLinksRouter = Router({ mergeParams: true });
export const paymentLinksRouter = Router();

export const MAX_ACTIVE_LINKS = 20;
const MAX_SWEEP_GAS = 200_000n;
const SLUG = /^[a-z0-9]{12}$/;

type Asset = "ETH" | "USDG";
type LinkRow = { slug: string; wallet_address: string; link_address: string; asset: Asset; amount_raw: string | null; note: string; created_at: Date; archived_at: Date | null };

const fail = (status: number, message: string) => Object.assign(new Error(message), { status });
function send(res: Response, error: unknown) {
  const e = error as Error & { status?: number };
  res.status(e.status || 500).json({ error: e.status ? e.message : "Payment link request failed" });
}
const fresh = (value: unknown): number => {
  const timestamp = Number(value);
  if (!Number.isSafeInteger(timestamp) || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) throw fail(400, "A fresh Shard A authorization is required");
  return timestamp;
};
const signature = (value: unknown): Hex => {
  if (typeof value !== "string" || !isHex(value) || value.length !== 132) throw fail(400, "A valid signature is required");
  return value;
};
async function signedBy(expected: string, message: string, sig: Hex) {
  const signer = await recoverMessageAddress({ message, signature: sig });
  if (signer.toLowerCase() !== expected.toLowerCase()) throw fail(403, "Signature does not match");
}
async function loadWallet(req: Request) {
  const address = String(req.params.address);
  if (!isAddress(address)) throw fail(400, "A valid smart account address is required");
  const result = await query<{ address: string; shard_a_address: string }>("SELECT address, shard_a_address FROM wallets WHERE address = $1", [address.toLowerCase()]);
  if (!result.rows.length) throw fail(404, "Wallet not found");
  return { address: getAddress(result.rows[0].address), shardA: result.rows[0].shard_a_address };
}

export const createLinkMessage = (wallet: string, link: string, asset: string, amount: string, note: string, timestamp: number) =>
  `Veilora payment link create\nwallet:${getAddress(wallet)}\nlink:${getAddress(link)}\nasset:${asset}\namount:${amount || "any"}\nnote:${note}\ntimestamp:${timestamp}`;
export const listLinksMessage = (wallet: string, timestamp: number) => `Veilora payment links access\nwallet:${getAddress(wallet)}\ntimestamp:${timestamp}`;
export const archiveLinkMessage = (wallet: string, slug: string, timestamp: number) => `Veilora payment link archive\nwallet:${getAddress(wallet)}\nslug:${slug}\ntimestamp:${timestamp}`;

const toLink = (row: LinkRow) => ({
  slug: row.slug, linkAddress: getAddress(row.link_address), asset: row.asset, amount: row.amount_raw, note: row.note,
  createdAt: row.created_at.toISOString(), archived: !!row.archived_at,
});

walletPaymentLinksRouter.get("/", async (req, res) => {
  try {
    const wallet = await loadWallet(req);
    await signedBy(wallet.shardA, listLinksMessage(wallet.address, fresh(req.header("x-veilora-timestamp"))), signature(req.header("x-veilora-signature")));
    const rows = await query<LinkRow>("SELECT * FROM payment_links WHERE wallet_address = $1 ORDER BY created_at DESC LIMIT 100", [wallet.address.toLowerCase()]);
    res.json({ links: rows.rows.map(toLink) });
  } catch (error) { send(res, error); }
});

walletPaymentLinksRouter.post("/", async (req, res) => {
  try {
    const wallet = await loadWallet(req);
    const { linkAddress, asset, amount = "", note = "", timestamp, shardASignature, linkSignature } = req.body ?? {};
    if (!isAddress(linkAddress) || linkAddress.toLowerCase() === wallet.address.toLowerCase()) throw fail(400, "A valid link address is required");
    if (asset !== "ETH" && asset !== "USDG") throw fail(400, "Payment links accept ETH or USDG");
    if (typeof amount !== "string" || (amount && !/^[1-9]\d{0,40}$/.test(amount))) throw fail(400, "The amount must be a positive whole number of base units");
    if (typeof note !== "string" || note.length > 80 || /[\u0000-\u001f\u007f]/.test(note)) throw fail(400, "The note can be up to 80 characters on one line");
    const message = createLinkMessage(wallet.address, linkAddress, asset, amount, note, fresh(timestamp));
    await signedBy(wallet.shardA, message, signature(shardASignature));
    await signedBy(linkAddress, message, signature(linkSignature));
    if ((await getFreezeState(wallet.address)).frozen) throw fail(403, "This wallet is frozen; unfreeze it before creating payment links");
    const active = await query<{ count: string }>("SELECT count(*)::text AS count FROM payment_links WHERE wallet_address = $1 AND archived_at IS NULL", [wallet.address.toLowerCase()]);
    if (Number(active.rows[0].count) >= MAX_ACTIVE_LINKS) throw fail(429, `You can have up to ${MAX_ACTIVE_LINKS} open payment links. Archive one first.`);
    const slug = randomBytes(9).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "").padEnd(12, "0").slice(0, 12);
    const created = await query<LinkRow>(
      `INSERT INTO payment_links (slug, wallet_address, link_address, asset, amount_raw, note)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (link_address) DO NOTHING RETURNING *`,
      [slug, wallet.address.toLowerCase(), linkAddress.toLowerCase(), asset, amount || null, note],
    );
    if (!created.rows.length) throw fail(409, "This link address is already in use");
    res.status(201).json({ link: toLink(created.rows[0]) });
  } catch (error) { send(res, error); }
});

walletPaymentLinksRouter.post("/:slug/archive", async (req, res) => {
  try {
    const wallet = await loadWallet(req);
    const slug = String(req.params.slug);
    if (!SLUG.test(slug)) throw fail(400, "Unknown payment link");
    await signedBy(wallet.shardA, archiveLinkMessage(wallet.address, slug, fresh(req.body?.timestamp)), signature(req.body?.shardASignature));
    const updated = await query<LinkRow>("UPDATE payment_links SET archived_at = COALESCE(archived_at, now()) WHERE slug = $1 AND wallet_address = $2 RETURNING *", [slug, wallet.address.toLowerCase()]);
    if (!updated.rows.length) throw fail(404, "Unknown payment link");
    res.json({ link: toLink(updated.rows[0]) });
  } catch (error) { send(res, error); }
});

async function loadLink(slug: string): Promise<LinkRow> {
  if (!SLUG.test(slug)) throw fail(404, "Unknown payment link");
  const result = await query<LinkRow>("SELECT * FROM payment_links WHERE slug = $1", [slug]);
  if (!result.rows.length) throw fail(404, "Unknown payment link");
  return result.rows[0];
}

/** Public: what a payer needs. The wallet's own address is never included. */
paymentLinksRouter.get("/:slug", async (req, res) => {
  try {
    res.json({ link: toLink(await loadLink(String(req.params.slug))) });
  } catch (error) { send(res, error); }
});

export type SweepCheck = { kind: Asset; gas: bigint; feePerGas: bigint; value: bigint; amount: bigint };

/**
 * Accept only a transaction signed by the link's own key that moves ETH or USDG
 * into the link owner's wallet. Pure apart from signature recovery.
 */
export async function checkSweepTransaction(linkAddress: string, wallet: string, raw: unknown): Promise<SweepCheck> {
  if (typeof raw !== "string" || !isHex(raw) || raw.length > 4_000) throw fail(400, "A signed transaction is required");
  let tx: ReturnType<typeof parseTransaction>;
  try { tx = parseTransaction(raw as Hex); } catch { throw fail(400, "The transaction could not be read"); }
  const signer = await recoverTransactionAddress({ serializedTransaction: raw as Parameters<typeof recoverTransactionAddress>[0]["serializedTransaction"] }).catch(() => null);
  if (!signer || signer.toLowerCase() !== linkAddress.toLowerCase()) throw fail(403, "The transaction must be signed by this payment link");
  if (tx.chainId !== CHAIN_ID) throw fail(400, "The transaction is for another network");
  const gas = tx.gas ?? 0n;
  const feePerGas = tx.maxFeePerGas ?? tx.gasPrice ?? 0n;
  if (gas <= 0n || gas > MAX_SWEEP_GAS || feePerGas <= 0n) throw fail(400, "The transaction's gas settings are not allowed");
  const to = tx.to?.toLowerCase();
  const data = tx.data ?? "0x";
  const value = tx.value ?? 0n;
  if (to === wallet.toLowerCase() && data === "0x" && value > 0n) return { kind: "ETH", gas, feePerGas, value, amount: value };
  if (to === USDG_ADDRESS.toLowerCase() && value === 0n) {
    let decoded: ReturnType<typeof decodeFunctionData<typeof erc20Abi>>;
    try { decoded = decodeFunctionData({ abi: erc20Abi, data }); } catch { throw fail(403, "Payment links can only move funds into your own account"); }
    const [recipient, amount] = decoded.args as readonly [Address, bigint];
    if (decoded.functionName === "transfer" && recipient.toLowerCase() === wallet.toLowerCase() && amount > 0n) return { kind: "USDG", gas, feePerGas, value, amount };
  }
  throw fail(403, "Payment links can only move funds into your own account");
}

/** Move what a link received into its wallet. Anyone may submit; only the link's key can sign, and only to the owner. */
paymentLinksRouter.post("/:slug/sweep", async (req, res) => {
  try {
    const link = await loadLink(String(req.params.slug));
    const wallet = getAddress(link.wallet_address);
    const linkAddress = getAddress(link.link_address);
    const check = await checkSweepTransaction(linkAddress, wallet, req.body?.rawTransaction);
    const gasCost = check.gas * check.feePerGas;
    const balance = await publicClient.getBalance({ address: linkAddress });
    if (check.kind === "USDG") {
      const held = await publicClient.readContract({ address: USDG_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [linkAddress] });
      if (held < check.amount) throw fail(400, "This link does not hold that much USDG");
      if (balance < gasCost) {
        if (!relayerClient) throw fail(503, "Gas top-ups are not available right now");
        const topUp = gasCost - balance;
        const fees = await relayerFeeOverrides();
        const { reservePrice, ...feeFields } = fees;
        await reserveGas(wallet, topUp + 21_000n * reservePrice);
        const hash = await relayerClient.sendTransaction({ to: linkAddress, value: topUp, gas: 21_000n, ...feeFields } as Parameters<typeof relayerClient.sendTransaction>[0]);
        const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
        if (receipt.status !== "success") throw fail(502, "The gas top-up did not complete; try again");
      }
    } else if (balance < check.value + gasCost) {
      throw fail(400, "This link does not hold enough ETH for that amount plus network gas");
    }
    const transactionHash = await publicClient.sendRawTransaction({ serializedTransaction: req.body.rawTransaction as Hex });
    res.json({ transactionHash, kind: check.kind });
  } catch (error) { send(res, error); }
});
