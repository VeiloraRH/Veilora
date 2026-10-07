import { Router, type Request, type Response } from "express";
import { formatEther, getAddress, isHex } from "viem";
import {
  CHAIN_ID,
  RPC_URL,
  FACTORY_ADDRESS,
  SHIELDED_POOL_ADDRESS,
  USDG_ADDRESS,
  publicClient,
  relayerAccount,
  relayerClient,
} from "../config";
import { veiloraFactoryAbi, veiloraAccountAbi } from "../abi";
import { query } from "../db/index";

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
        rpcUrl: RPC_URL,
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
        shieldedPool: SHIELDED_POOL_ADDRESS,
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

    const cleanWallet = getAddress(walletAddress);
    const cleanTarget = getAddress(target);
    const numValue = BigInt(value);
    const hexData = (data as `0x${string}`) || "0x";
    const numNonce = BigInt(nonce);
    const numDeadline = BigInt(deadline);
    const hexSignatures = signatures as `0x${string}`;

    if (!isHex(hexSignatures) || hexSignatures.length !== 130 * 2 + 2) {
      res.status(400).json({
        error: `Signatures must be 130 bytes hex (2 x 65 bytes ECDSA). Received length: ${hexSignatures.length}`,
      });
      return;
    }

    // 1. Check if the smart account has been deployed on Robinhood Chain
    const code = await publicClient.getCode({ address: cleanWallet });
    const isDeployed = Boolean(code && code !== "0x");

    if (!isDeployed) {
      // Find wallet shard config from db to deploy via Factory
      const walletRow = await query(`SELECT * FROM wallets WHERE address = $1`, [
        cleanWallet.toLowerCase(),
      ]);

      if (walletRow.rows.length === 0) {
        res.status(400).json({
          error: "Wallet not found in database; cannot auto-deploy",
        });
        return;
      }

      const w = walletRow.rows[0];
      console.log(`[Relayer] Deploying counterfactual wallet ${cleanWallet} on Robinhood Chain...`);

      const deployTx = await relayerClient.writeContract({
        address: FACTORY_ADDRESS,
        abi: veiloraFactoryAbi,
        functionName: "createAccount",
        args: [
          getAddress(w.shard_a_address),
          getAddress(w.shard_b_address),
          getAddress(w.shard_c_address),
          0n,
        ],
      });

      console.log(`[Relayer] Deployment Tx submitted: ${deployTx}`);
      await publicClient.waitForTransactionReceipt({ hash: deployTx });
    }

    // 2. Broadcast executeWithSignatures
    console.log(`[Relayer] Broadcasting executeWithSignatures for ${cleanWallet} to ${cleanTarget}...`);

    const txHash = await relayerClient.writeContract({
      address: cleanWallet,
      abi: veiloraAccountAbi,
      functionName: "executeWithSignatures",
      args: [cleanTarget, numValue, hexData, numNonce, numDeadline, hexSignatures],
    });

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
    res.status(500).json({
      error: error.message || "Failed to broadcast transaction on Robinhood Chain",
    });
  }
});
