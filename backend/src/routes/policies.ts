import { Router, type Request, type Response } from "express";
import { evaluatePolicy } from "../policies/engine";
import { query } from "../db/index";

export const policiesRouter = Router();

/**
 * POST /v1/policies/evaluate
 * Evaluates an intent plan and simulation against system policy constraints.
 */
policiesRouter.post("/evaluate", async (req: Request, res: Response): Promise<void> => {
  try {
    const { plan, simulation } = req.body;
    if (!plan || !simulation) {
      res.status(400).json({ error: "Both 'plan' and 'simulation' objects are required" });
      return;
    }

    const evaluation = await evaluatePolicy(plan, simulation);
    res.json(evaluation);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to evaluate policies" });
  }
});

/**
 * GET /v1/policies
 * Lists active system policies and guardrails.
 */
policiesRouter.get("/", async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT id, name, version, max_fee_bps, min_gas_reserve_wei, require_clean_provenance, allowed_assets, is_active
       FROM policies
       ORDER BY version DESC`
    );
    res.json({ policies: result.rows });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch policies" });
  }
});
