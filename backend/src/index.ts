import "dotenv/config";
import { assertEncryptionKeyConfigured } from "./crypto";
import { app } from "./app";
import { migrate } from "./db/migrate";

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
}

void start();
