import { Router, type Request, type Response } from "express";
import { query } from "../db/index";
import { CHAIN_ID, FACTORY_ADDRESS, SHIELDED_POOL_ADDRESS, USDG_ADDRESS } from "../config";

export const adaptersRouter = Router();

/**
 * GET /v1/adapters
 * Lists chain and protocol adapters.
 */
adaptersRouter.get("/", async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT id, chain_id, name, capabilities, is_enabled FROM adapters ORDER BY chain_id ASC`
    );

    res.json({ adapters: result.rows });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch adapters" });
  }
});

/**
 * GET /v1/adapters/status
 * Returns operational status for Robinhood Chain adapters.
 */
adaptersRouter.get("/status", async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json({
      activeChain: {
        chainId: CHAIN_ID,
        name: "Robinhood Chain",
        status: "operational",
      },
      contracts: {
        factory: FACTORY_ADDRESS,
        shieldedPool: SHIELDED_POOL_ADDRESS,
        usdgToken: USDG_ADDRESS,
      },
      integrations: {
        uniswapV3: "active",
        morpho: "active",
        cleanProvenance: "active",
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch adapter status" });
  }
});
