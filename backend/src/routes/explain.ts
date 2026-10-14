import { Router, type Request, type Response } from "express";
import { getAddress, isAddress } from "viem";
import { explainCall, explainTransaction, type Explanation } from "../txExplain";

/** Plain-language transaction explanations. Everything explained is already public or about to be signed by the caller. */
export const explainRouter = Router();
export const walletExplainRouter = Router({ mergeParams: true });

const worst = (explanations: Explanation[]) =>
  explanations.some((e) => e.flags.some((f) => f.level === "danger")) ? "danger" : explanations.some((e) => e.flags.some((f) => f.level === "warn")) ? "warn" : "info";

/** POST /v1/explain — explain calls before they are signed. */
explainRouter.post("/", (req: Request, res: Response) => {
  const wallet = String(req.body?.walletAddress ?? "");
  const calls = req.body?.calls;
  if (!isAddress(wallet) || !Array.isArray(calls) || calls.length < 1 || calls.length > 6) {
    res.status(400).json({ error: "A wallet address and one to six calls are required" });
    return;
  }
  try {
    const explanations = calls.map((c: any) => {
      if (typeof c?.value !== "string" || !/^(0|[1-9]\d{0,77})$/.test(c.value)) throw new Error("Each call value must be a whole number of wei");
      return explainCall(getAddress(wallet), { target: String(c.target), value: c.value, data: String(c.data) });
    });
    res.json({ level: worst(explanations), explanations });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not explain these calls" });
  }
});

/** GET /v1/wallets/:address/explain/:hash — explain a mined transaction from this wallet's point of view. */
walletExplainRouter.get("/:hash", async (req: Request, res: Response): Promise<void> => {
  const wallet = String(req.params.address);
  const hash = String(req.params.hash);
  if (!isAddress(wallet) || !/^0x[0-9a-fA-F]{64}$/.test(hash)) { res.status(400).json({ error: "A valid wallet and transaction hash are required" }); return; }
  try {
    res.json(await explainTransaction(getAddress(wallet), hash as `0x${string}`));
  } catch {
    res.status(404).json({ error: "That transaction was not found on Robinhood Chain, or is not mined yet" });
  }
});
