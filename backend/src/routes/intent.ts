import { Router, type Request, type Response } from "express";
import { parseIntent, type StructuredPlan } from "../intent/parser";
import { simulatePlan } from "../simulation/engine";
import { query } from "../db/index";

export const intentRouter = Router();

/**
 * POST /v1/intent/parse
 * Parses a user prompt or goal into a deterministic structured plan.
 */
intentRouter.post("/parse", async (req: Request, res: Response): Promise<void> => {
  try {
    const { goal, constraints } = req.body;
    if (!goal || typeof goal !== "string") {
      res.status(400).json({ error: "Field 'goal' is required" });
      return;
    }

    const plan = parseIntent(goal, constraints);

    await query(
      `INSERT INTO plans (id, goal, constraints, status)
       VALUES ($1, $2, $3, 'draft')
       ON CONFLICT (id) DO UPDATE SET
         goal = EXCLUDED.goal,
         constraints = EXCLUDED.constraints,
         updated_at = now()`,
      [plan.id, plan.goal, JSON.stringify(plan.constraints)]
    );

    res.status(201).json(plan);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to parse intent" });
  }
});

/**
 * POST /v1/intent/simulate
 * Simulates balance deltas, routing, gas reserves, and disclosure surfaces.
 */
intentRouter.post("/simulate", async (req: Request, res: Response): Promise<void> => {
  try {
    let plan: StructuredPlan;

    if (req.body.plan) {
      plan = req.body.plan;
    } else if (req.body.goal) {
      plan = parseIntent(req.body.goal, req.body.constraints);
    } else {
      res.status(400).json({ error: "Either 'plan' object or 'goal' string is required" });
      return;
    }

    const currentPublicUSDG = req.body.currentPublicUSDG !== undefined ? Number(req.body.currentPublicUSDG) : undefined;
    const currentGasEth = req.body.currentGasEth !== undefined ? Number(req.body.currentGasEth) : undefined;
    const walletAddress = req.body.walletAddress || plan.constraints?.destinationAddress;

    const simulation = await simulatePlan(plan, currentPublicUSDG, currentGasEth, walletAddress);

    // Save simulation in database if plan exists
    if (plan.id) {
      await query(
        `UPDATE plans
         SET simulation = $1,
             route = $2,
             status = 'simulated',
             updated_at = now()
         WHERE id = $3`,
        [JSON.stringify(simulation), JSON.stringify(simulation.route), plan.id]
      );
    }

    res.json({
      plan,
      simulation,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to simulate intent" });
  }
});

/**
 * GET /v1/intent/plans/:id
 * Retrieve stored plan details and simulation.
 */
intentRouter.get("/plans/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const result = await query(`SELECT * FROM plans WHERE id = $1`, [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch plan" });
  }
});
