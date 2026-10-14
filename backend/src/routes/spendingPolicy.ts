import { Router, type Request, type Response } from "express";
import { getAddress, isAddress, isHex, recoverMessageAddress } from "viem";
import { query } from "../db/index";

export const spendingPolicyRouter = Router({ mergeParams: true });
const fresh = (value: unknown): number => {
  const timestamp = Number(value);
  if (!Number.isSafeInteger(timestamp) || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) throw Object.assign(new Error("A fresh Shard A authorization is required"), { status: 400 });
  return timestamp;
};
const signature = (value: unknown): `0x${string}` => {
  if (typeof value !== "string" || !isHex(value) || value.length !== 132) throw Object.assign(new Error("A valid Shard A signature is required"), { status: 400 });
  return value;
};
async function load(req: Request) {
  const address = String(req.params.address);
  if (!isAddress(address)) throw Object.assign(new Error("A valid smart account address is required"), { status: 400 });
  const result = await query("SELECT address, shard_a_address FROM wallets WHERE address = $1", [address.toLowerCase()]);
  if (!result.rows.length) throw Object.assign(new Error("Wallet not found"), { status: 404 });
  return { address: String(result.rows[0].address), shardA: String(result.rows[0].shard_a_address).toLowerCase() };
}
async function authorize(wallet: Awaited<ReturnType<typeof load>>, message: string, sig: `0x${string}`) {
  const signer = await recoverMessageAddress({ message, signature: sig });
  if (signer.toLowerCase() !== wallet.shardA) throw Object.assign(new Error("Signature does not match this wallet's Shard A"), { status: 403 });
}
async function consume(wallet: string, sig: string) {
  const result = await query("INSERT INTO wallet_rule_authorizations (signature, wallet_address) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING signature", [sig.toLowerCase(), wallet]);
  if (!result.rows.length) throw Object.assign(new Error("This authorization has already been used"), { status: 409 });
}
function send(res: Response, error: unknown) {
  const e = error as Error & { status?: number };
  res.status(e.status || 500).json({ error: e.message || "Could not update spending limits" });
}
const accessMessage = (wallet: string, timestamp: number) => `Veilora spending limits access\nwallet:${getAddress(wallet)}\ntimestamp:${timestamp}`;
const updateMessage = (wallet: string, perTx: number, daily: number, timestamp: number) => `Veilora spending limits update\nwallet:${getAddress(wallet)}\nperTransactionPercent:${perTx}\ndailyTotalPercent:${daily}\ntimestamp:${timestamp}`;

spendingPolicyRouter.get("/", async (req, res) => {
  try {
    const wallet = await load(req);
    const timestamp = fresh(req.header("x-veilora-timestamp"));
    await authorize(wallet, accessMessage(wallet.address, timestamp), signature(req.header("x-veilora-signature")));
    const result = await query("SELECT per_transaction_percent, daily_total_percent FROM wallet_spending_policies WHERE wallet_address = $1", [wallet.address]);
    const spend = await query("SELECT asset_address, amount_wei::text, daily_balance_wei::text FROM wallet_daily_spend WHERE wallet_address = $1 AND utc_day = (now() AT TIME ZONE 'UTC')::date", [wallet.address]);
    res.json({ perTransactionPercent: result.rows[0]?.per_transaction_percent ?? 20, dailyTotalPercent: result.rows[0]?.daily_total_percent ?? 20,
      dailySpend: Object.fromEntries(spend.rows.map((row) => [String(row.asset_address).toLowerCase(), { spent: String(row.amount_wei), balance: row.daily_balance_wei == null ? null : String(row.daily_balance_wei) }])) });
  } catch (error) { send(res, error); }
});

spendingPolicyRouter.put("/", async (req, res) => {
  try {
    const wallet = await load(req);
    const timestamp = fresh(req.body.timestamp);
    const sig = signature(req.body.shardASignature);
    const perTx = req.body.perTransactionPercent;
    const daily = req.body.dailyTotalPercent;
    if (!Number.isInteger(perTx) || perTx < 1 || perTx > 100 || !Number.isInteger(daily) || daily < 1 || daily > 100) throw Object.assign(new Error("Both limits must be whole percentages from 1 to 100"), { status: 400 });
    await authorize(wallet, updateMessage(wallet.address, perTx, daily, timestamp), sig);
    await consume(wallet.address, sig);
    const result = await query(`INSERT INTO wallet_spending_policies (wallet_address, per_transaction_percent, daily_total_percent)
      VALUES ($1, $2, $3) ON CONFLICT (wallet_address) DO UPDATE SET
      per_transaction_percent = EXCLUDED.per_transaction_percent,
      daily_total_percent = EXCLUDED.daily_total_percent, updated_at = now()
      RETURNING per_transaction_percent, daily_total_percent`, [wallet.address, perTx, daily]);
    res.json({ perTransactionPercent: result.rows[0].per_transaction_percent, dailyTotalPercent: result.rows[0].daily_total_percent });
  } catch (error) { send(res, error); }
});

export { accessMessage as spendingPolicyAccessMessage, updateMessage as spendingPolicyUpdateMessage };
