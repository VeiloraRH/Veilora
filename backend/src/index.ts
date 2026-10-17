import "dotenv/config";
import { assertEncryptionKeyConfigured } from "./crypto";
import { app } from "./app";
import { migrate } from "./db/migrate";
import { startRulesEvaluator } from "./rules/evaluator";
import { startAlertsEvaluator } from "./alerts/evaluator";
import { startPriceSampler } from "./priceHistory";

const port = Number(process.env.PORT ?? 3001);

assertEncryptionKeyConfigured();

async function start() {
  try {
    if (process.env.SKIP_MIGRATIONS !== "true" && process.env.DATABASE_URL) {
      await migrate();
    }
  } catch (error) {
    console.error("[db] Migration error during startup:", error);
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }
  }

  app.listen(port, () => {
    console.log(`[veilora-backend] API server listening on http://localhost:${port}`);
  });

  if (process.env.DATABASE_URL && process.env.RULES_EVALUATOR !== "off") {
    startRulesEvaluator();
    console.log("[veilora-backend] Wallet Rules evaluator started");
  }
  if (process.env.DATABASE_URL && process.env.ALERTS_EVALUATOR !== "off") {
    startAlertsEvaluator();
    console.log("[veilora-backend] Alerts evaluator started");
  }
  if (process.env.DATABASE_URL && process.env.PRICE_SAMPLER !== "off") {
    startPriceSampler();
    console.log("[veilora-backend] Price sampler started");
  }
}

void start();
