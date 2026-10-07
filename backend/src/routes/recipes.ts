import { Router, type Request, type Response } from "express";
import { query } from "../db/index";

export const recipesRouter = Router();

/**
 * GET /v1/recipes
 * Lists all active composable shielded DeFi recipes.
 */
recipesRouter.get("/", async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT recipe_id, name, description, steps, supported_assets, max_slippage_bps, requires_clean_provenance
       FROM recipes
       WHERE is_active = true
       ORDER BY recipe_id ASC`
    );
    res.json({ recipes: result.rows });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch recipes" });
  }
});

/**
 * GET /v1/recipes/:id
 * Retrieves details for a specific recipe.
 */
recipesRouter.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const result = await query(
      `SELECT recipe_id, name, description, steps, supported_assets, max_slippage_bps, requires_clean_provenance
       FROM recipes
       WHERE recipe_id = $1 AND is_active = true`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Recipe not found" });
      return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch recipe" });
  }
});
