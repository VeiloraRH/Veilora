import { Router, type Request, type Response } from "express";
import { formatEther, getAddress, isHex, parseEther, recoverMessageAddress } from "viem";
import {
  CHAIN_ID,
  RPC_URL,
  FACTORY_ADDRESS,
  USDG_ADDRESS,
  publicClient,
  relayerAccount,
  relayerClient,
} from "../config";
import { veiloraFactoryAbi, veiloraAccountAbi } from "../abi";
import { db, query } from "../db/index";
import { computeExecutionDigest } from "../crypto";
import { getFreezeState } from "../freeze";

const MAX_EXECUTION_GAS = BigInt(process.env.RELAYER_MAX_EXECUTION_GAS || "1500000");
const MAX_DEPLOYMENT_GAS = BigInt(process.env.RELAYER_MAX_DEPLOYMENT_GAS || "4000000");
const DAILY_GAS_COST_LIMIT = parseEther(process.env.RELAYER_DAILY_GAS_BUDGET_ETH || "0.05");
const WALLET_DAILY_GAS_COST_LIMIT = parseEther(process.env.RELAYER_WALLET_DAILY_GAS_BUDGET_ETH || "0.01");
const DAILY_DEPLOYMENT_LIMIT = Math.max(1, Number(process.env.RELAYER_DAILY_DEPLOYMENT_LIMIT) || 10);

async function reserveGas(wallet: string, costWei: bigint): Promise<void> {
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

    const walletResult = await query<{ shard_a_address: string; shard_b_address: string; shard_c_address: string; factory_address: string; salt: string; chain_id: number }>(
      "SELECT shard_a_address, shard_b_address, shard_c_address, factory_address, salt::text, chain_id FROM wallets WHERE address = $1",
      [cleanWallet.toLowerCase()],
    );
    const wallet = walletResult.rows[0];
    if (!wallet) { res.status(404).json({ error: "Wallet is not registered with Veilora" }); return; }
    if (Number(wallet.chain_id) !== CHAIN_ID) { res.status(400).json({ error: "Wallet is registered for another chain" }); return; }
    if ((await getFreezeState(cleanWallet)).frozen) { res.status(403).json({ error: "Wallet is frozen; the relayer will not submit transactions" }); return; }

    const digest = computeExecutionDigest(cleanTarget, numValue, hexData, numNonce, numDeadline, BigInt(CHAIN_ID));
    const firstSignature = `0x${hexSignatures.slice(2, 132)}` as `0x${string}`;
    const secondSignature = `0x${hexSignatures.slice(132)}` as `0x${string}`;
    const [firstSigner, secondSigner] = await Promise.all([
      recoverMessageAddress({ message: { raw: digest }, signature: firstSignature }),
      recoverMessageAddress({ message: { raw: digest }, signature: secondSignature }),
    ]);
    const signers = [firstSigner.toLowerCase(), secondSigner.toLowerCase()];
    const expectedSigners = [wallet.shard_a_address.toLowerCase(), wallet.shard_b_address.toLowerCase()];
    if (signers[0] === signers[1] || !expectedSigners.every((signer) => signers.includes(signer))) {
      res.status(403).json({ error: "Relayer submissions require this wallet's exact Shard A and Shard B signatures" });
      return;
    }
    const approved = await query(
      `SELECT id FROM cosign_audit WHERE wallet_address = $1 AND user_op_hash = $2 AND status = 'APPROVED' AND shard_b_signature IS NOT NULL LIMIT 1`,
      [cleanWallet.toLowerCase(), digest],
    );
    if (!approved.rows.length) { res.status(403).json({ error: "This transaction has no Shard B co-signer approval" }); return; }

    const factoryAddress = getAddress(wallet.factory_address || FACTORY_ADDRESS);
    const salt = BigInt(wallet.salt || "0");
    const expectedWallet = await publicClient.readContract({
      address: factoryAddress, abi: veiloraFactoryAbi, functionName: "getAddress",
      args: [getAddress(wallet.shard_a_address), getAddress(wallet.shard_b_address), getAddress(wallet.shard_c_address), salt],
    });
    if (expectedWallet.toLowerCase() !== cleanWallet.toLowerCase()) {
      res.status(409).json({ error: "Registered shard configuration does not match the wallet address" });
      return;
    }

    let code = await publicClient.getCode({ address: cleanWallet });
    let isDeployed = Boolean(code && code !== "0x");
    if (!isDeployed) {
      const deployment = { address: factoryAddress, abi: veiloraFactoryAbi, functionName: "createAccount" as const,
        args: [getAddress(wallet.shard_a_address), getAddress(wallet.shard_b_address), getAddress(wallet.shard_c_address), salt] as const,
        account: relayerAccount.address };
      await publicClient.simulateContract(deployment);
      const deployGas = await publicClient.estimateContractGas(deployment);
      if (deployGas > MAX_DEPLOYMENT_GAS) { res.status(413).json({ error: "Wallet deployment exceeds the relayer gas limit" }); return; }
      const deployGasPrice = await publicClient.getGasPrice();
      await reserveGas(cleanWallet, deployGas * deployGasPrice);
      await reserveDeployment();
      const deployTx = await relayerClient.writeContract({ ...deployment, gas: deployGas, gasPrice: deployGasPrice });
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
    const executionGasPrice = await publicClient.getGasPrice();
    await reserveGas(cleanWallet, executionGas * executionGasPrice);
    const txHash = await relayerClient.writeContract({ ...execution, gas: executionGas, gasPrice: executionGasPrice });

    console.log(`[Relayer] Execution Tx Hash: ${txHash}`);

    // Wait for receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

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
    console.error("[Relayer] Broadcast error:", error);
    res.status(error?.status || 500).json({
      error: error.message || "Failed to broadcast transaction on Robinhood Chain",
    });
  }
});
