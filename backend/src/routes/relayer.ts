import { Router, type Request, type Response } from "express";
import { formatEther, getAddress, isHex, parseEther, recoverMessageAddress } from "viem";
import {
  CHAIN_ID,
  RPC_URL,
  FACTORY_ADDRESS,
  LEGACY_FACTORY_ADDRESS,
  V2_FACTORY_ADDRESS,
  USDG_ADDRESS,
  publicClient,
  relayerAccount,
  relayerClient,
} from "../config";
import { veiloraFactoryAbi, veiloraFactoryV2Abi, veiloraAccountAbi } from "../abi";
import { db, query } from "../db/index";
import { computeExecutionDigest, computeExecutionDigestV2 } from "../crypto";
import { getFreezeState } from "../freeze";
import { safeFeeOverrides } from "../feePolicy";
import { settleDailySpend } from "../txPolicy";

const MAX_EXECUTION_GAS = BigInt(process.env.RELAYER_MAX_EXECUTION_GAS || "1500000");
const MAX_DEPLOYMENT_GAS = BigInt(process.env.RELAYER_MAX_DEPLOYMENT_GAS || "4000000");
const DAILY_GAS_COST_LIMIT = parseEther(process.env.RELAYER_DAILY_GAS_BUDGET_ETH || "0.05");
const WALLET_DAILY_GAS_COST_LIMIT = parseEther(process.env.RELAYER_WALLET_DAILY_GAS_BUDGET_ETH || "0.01");
const DAILY_DEPLOYMENT_LIMIT = Math.max(1, Number(process.env.RELAYER_DAILY_DEPLOYMENT_LIMIT) || 10);

export async function relayerFeeOverrides() {
  const block = await publicClient.getBlock({ blockTag: "latest" });
  const estimate = await publicClient.estimateFeesPerGas().catch(async () => ({ gasPrice: await publicClient.getGasPrice() }));
  return safeFeeOverrides(block.baseFeePerGas, estimate);
}

export async function reserveGas(wallet: string, costWei: bigint): Promise<void> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    for (const [key, limit] of [[wallet.toLowerCase(), WALLET_DAILY_GAS_COST_LIMIT], ["__global__", DAILY_GAS_COST_LIMIT]] as const) {
      const result = await client.query(
        `INSERT INTO relayer_daily_gas_budget (wallet_address, utc_day, cost_wei)
         VALUES ($1, (now() AT TIME ZONE 'UTC')::date, $2)
         ON CONFLICT (wallet_address, utc_day) DO UPDATE
           SET cost_wei = relayer_daily_gas_budget.cost_wei + EXCLUDED.cost_wei
           WHERE relayer_daily_gas_budget.cost_wei + EXCLUDED.cost_wei <= $3
         RETURNING cost_wei`,
        [key, costWei.toString(), limit.toString()],
      );
      if (!result.rows.length) throw Object.assign(new Error("Relayer daily gas budget reached; try again tomorrow"), { status: 429 });
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function reserveDeployment(): Promise<void> {
  const result = await query(
    `INSERT INTO relayer_deployment_budget (utc_day, deployment_count)
     VALUES ((now() AT TIME ZONE 'UTC')::date, 1)
     ON CONFLICT (utc_day) DO UPDATE
       SET deployment_count = relayer_deployment_budget.deployment_count + 1
       WHERE relayer_deployment_budget.deployment_count < $1
     RETURNING deployment_count`,
    [DAILY_DEPLOYMENT_LIMIT],
  );
  if (!result.rows.length) throw Object.assign(new Error("Daily sponsored wallet deployment limit reached"), { status: 429 });
}

export const relayerRouter = Router();

/**
 * GET /v1/relayer/status
 * Network health, gas prices, relayer wallet balance, and contract registry.
 */
relayerRouter.get("/status", async (_req: Request, res: Response): Promise<void> => {
  try {
    let blockNumber = 0n;
    let gasPrice = 0n;
    let relayerBalance = 0n;

    try {
      blockNumber = await publicClient.getBlockNumber();
      gasPrice = await publicClient.getGasPrice();
      if (relayerAccount) {
        relayerBalance = await publicClient.getBalance({ address: relayerAccount.address });
      }
    } catch {
      // RPC fallback
    }

    res.json({
      network: {
        chainId: CHAIN_ID,
        rpcHost: (() => { try { return new URL(RPC_URL).host; } catch { return "configured"; } })(),
        blockNumber: blockNumber.toString(),
        gasPriceGwei: formatEther(gasPrice * 1_000_000_000n),
      },
      relayer: {
        address: relayerAccount?.address ?? null,
        balanceEth: formatEther(relayerBalance),
        ready: Boolean(relayerClient && relayerBalance > 0n),
      },
      contracts: {
        factory: FACTORY_ADDRESS,
        legacyFactory: FACTORY_ADDRESS,
        v2Factory: V2_FACTORY_ADDRESS ?? null,
        usdgToken: USDG_ADDRESS,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch relayer status" });
  }
});

/**
 * POST /v1/relayer/broadcast
 * Submits an authorized 2-of-3 threshold execution to Robinhood Chain.
 */
relayerRouter.post("/broadcast", async (req: Request, res: Response): Promise<void> => {
  let reservationWallet: `0x${string}` | undefined;
  let reservationDigest: `0x${string}` | undefined;
  let submittedTransaction = false;
  try {
    if (!relayerClient || !relayerAccount) {
      res.status(503).json({ error: "Backend relayer wallet is not configured" });
      return;
    }

    const {
      walletAddress,
      target,
      value = "0",
      data = "0x",
      nonce,
      deadline,
      signatures,
    } = req.body;

    if (!walletAddress || !target || nonce === undefined || deadline === undefined || !signatures) {
      res.status(400).json({
        error: "Missing required fields: walletAddress, target, nonce, deadline, signatures",
      });
      return;
    }

    if (!isHex(data) || data.length > 24_578 || !/^(0|[1-9]\d*)$/.test(String(value)) ||
        !/^(0|[1-9]\d*)$/.test(String(nonce)) || !/^(0|[1-9]\d*)$/.test(String(deadline))) {
      res.status(400).json({ error: "Invalid value, calldata, nonce or deadline" });
      return;
    }
    const cleanWallet = getAddress(walletAddress);
    const cleanTarget = getAddress(target);
    const numValue = BigInt(value);
    const hexData = (data as `0x${string}`) || "0x";
    const numNonce = BigInt(nonce);
    const numDeadline = BigInt(deadline);
    const hexSignatures = signatures as `0x${string}`;
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (numDeadline <= now || numDeadline > now + 300n) {
      res.status(400).json({ error: "Execution deadline must be within the next five minutes" });
      return;
    }

    if (!isHex(hexSignatures) || hexSignatures.length !== 130 * 2 + 2) {
      res.status(400).json({
        error: `Signatures must be 130 bytes hex (2 x 65 bytes ECDSA). Received length: ${hexSignatures.length}`,
      });
      return;
    }

    const walletResult = await query<{ shard_a_address: string; shard_b_address: string; shard_c_address: string; initial_shard_a_address: string; initial_shard_c_address: string; factory_address: string; account_version: number; salt: string; chain_id: number }>(
      "SELECT shard_a_address, shard_b_address, shard_c_address, COALESCE(initial_shard_a_address, shard_a_address) AS initial_shard_a_address, COALESCE(initial_shard_c_address, shard_c_address) AS initial_shard_c_address, factory_address, account_version, salt::text, chain_id FROM wallets WHERE address = $1",
      [cleanWallet.toLowerCase()],
    );
    const wallet = walletResult.rows[0];
    if (!wallet) { res.status(404).json({ error: "Wallet is not registered with Veilora" }); return; }
    if (Number(wallet.chain_id) !== CHAIN_ID) { res.status(400).json({ error: "Wallet is registered for another chain" }); return; }
    const frozen = (await getFreezeState(cleanWallet)).frozen;

    const accountVersion = Number(wallet.account_version) === 2 ? 2 : 1;
    if (accountVersion === 2 && (!V2_FACTORY_ADDRESS || wallet.factory_address.toLowerCase() !== V2_FACTORY_ADDRESS.toLowerCase())) {
      res.status(503).json({ error: "This V2 wallet is not connected to its configured factory" });
      return;
    }
    const digest = accountVersion === 2
      ? computeExecutionDigestV2(cleanWallet, cleanTarget, numValue, hexData, numNonce, numDeadline, BigInt(CHAIN_ID))
      : computeExecutionDigest(cleanTarget, numValue, hexData, numNonce, numDeadline, BigInt(CHAIN_ID));
    reservationWallet = cleanWallet;
    reservationDigest = digest;
    const firstSignature = `0x${hexSignatures.slice(2, 132)}` as `0x${string}`;
    const secondSignature = `0x${hexSignatures.slice(132)}` as `0x${string}`;
    const [firstSigner, secondSigner] = await Promise.all([
      recoverMessageAddress({ message: { raw: digest }, signature: firstSignature }),
      recoverMessageAddress({ message: { raw: digest }, signature: secondSignature }),
    ]);
    const signers = [firstSigner.toLowerCase(), secondSigner.toLowerCase()];
    const approved = await query<{ metadata: { rotationId?: string; signerShard?: "A" | "C"; allowWhileFrozen?: boolean } | null }>(
      `SELECT metadata FROM cosign_audit WHERE wallet_address = $1 AND user_op_hash = $2 AND status = 'APPROVED' AND shard_b_signature IS NOT NULL LIMIT 1`,
      [cleanWallet.toLowerCase(), digest],
    );
    if (!approved.rows.length) { res.status(403).json({ error: "This transaction has no Shard B co-signer approval" }); return; }
    // A key rotation approved by the co-signer may be signed with the recovery
    // key (replacing a lost device key) and may run while the account is frozen.
    const rotation = approved.rows[0].metadata?.rotationId ? approved.rows[0].metadata : null;
    if (frozen && !rotation?.allowWhileFrozen) { res.status(403).json({ error: "Wallet is frozen; the relayer will not submit transactions" }); return; }
    const userShard = rotation?.signerShard === "C" ? wallet.shard_c_address : wallet.shard_a_address;
    const expectedSigners = [userShard.toLowerCase(), wallet.shard_b_address.toLowerCase()];
    if (signers[0] === signers[1] || !expectedSigners.every((signer) => signers.includes(signer))) {
      res.status(403).json({ error: "Relayer submissions require this wallet's exact Shard A and Shard B signatures" });
      return;
    }

    const factoryAddress = getAddress(wallet.factory_address || LEGACY_FACTORY_ADDRESS);
    const factoryAbi = accountVersion === 2 ? veiloraFactoryV2Abi : veiloraFactoryAbi;
    const salt = BigInt(wallet.salt || "0");
    const expectedWallet = await publicClient.readContract({
      address: factoryAddress, abi: factoryAbi, functionName: "getAddress",
      args: [getAddress(wallet.initial_shard_a_address), getAddress(wallet.shard_b_address), getAddress(wallet.initial_shard_c_address), salt],
    });
    if (expectedWallet.toLowerCase() !== cleanWallet.toLowerCase()) {
      res.status(409).json({ error: "Registered shard configuration does not match the wallet address" });
      return;
    }

    let code = await publicClient.getCode({ address: cleanWallet });
    let isDeployed = Boolean(code && code !== "0x");
    if (!isDeployed) {
      const deployment = { address: factoryAddress, abi: factoryAbi, functionName: "createAccount" as const,
        args: [getAddress(wallet.initial_shard_a_address), getAddress(wallet.shard_b_address), getAddress(wallet.initial_shard_c_address), salt] as const,
        account: relayerAccount.address };
      await publicClient.simulateContract(deployment);
      const deployGas = await publicClient.estimateContractGas(deployment);
      if (deployGas > MAX_DEPLOYMENT_GAS) { res.status(413).json({ error: "Wallet deployment exceeds the relayer gas limit" }); return; }
      const deployFees = await relayerFeeOverrides();
      await reserveGas(cleanWallet, deployGas * deployFees.reservePrice);
      await reserveDeployment();
      const { reservePrice: _deployReservePrice, ...deployFeeFields } = deployFees;
      const deployTx = await relayerClient.writeContract({ ...deployment, gas: deployGas, ...deployFeeFields });
      const deployReceipt = await publicClient.waitForTransactionReceipt({ hash: deployTx });
      if (deployReceipt.status !== "success") throw new Error("Wallet deployment reverted");
      code = await publicClient.getCode({ address: cleanWallet });
      isDeployed = Boolean(code && code !== "0x");
      if (!isDeployed) throw new Error("Wallet deployment produced no account code");
    }

    // 2. Broadcast executeWithSignatures
    console.log(`[Relayer] Broadcasting executeWithSignatures for ${cleanWallet} to ${cleanTarget}...`);

    const execution = {
      address: cleanWallet,
      abi: veiloraAccountAbi,
      functionName: "executeWithSignatures",
      args: [cleanTarget, numValue, hexData, numNonce, numDeadline, hexSignatures],
      account: relayerAccount,
    } as const;
    await publicClient.simulateContract(execution);
    const executionGas = await publicClient.estimateContractGas(execution);
    if (executionGas > MAX_EXECUTION_GAS) { res.status(413).json({ error: "Transaction exceeds the relayer gas limit" }); return; }
    const executionFees = await relayerFeeOverrides();
    await reserveGas(cleanWallet, executionGas * executionFees.reservePrice);
    const { reservePrice: _executionReservePrice, ...executionFeeFields } = executionFees;
    const txHash = await relayerClient.writeContract({ ...execution, gas: executionGas, ...executionFeeFields });
    submittedTransaction = true;

    console.log(`[Relayer] Execution Tx Hash: ${txHash}`);

    // Wait for receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    await settleDailySpend(cleanWallet, digest, receipt.status === "success", txHash);

    res.json({
      success: receipt.status === "success",
      transactionHash: txHash,
      blockNumber: receipt.blockNumber.toString(),
      gasUsed: receipt.gasUsed.toString(),
      walletAddress: cleanWallet,
      target: cleanTarget,
      nonce: numNonce.toString(),
    });
  } catch (error: any) {
    if (reservationWallet && reservationDigest && !submittedTransaction) {
      await settleDailySpend(reservationWallet, reservationDigest, false).catch((settleError) => {
        console.error("[Relayer] Could not release unused spend reservation:", settleError);
      });
    }
    console.error("[Relayer] Broadcast error:", error);
    res.status(error?.status || 500).json({
      error: error.message || "Failed to broadcast transaction on Robinhood Chain",
    });
  }
});
