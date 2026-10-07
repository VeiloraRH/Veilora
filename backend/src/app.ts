import express from "express";
import { randomUUID } from "node:crypto";
import { healthRouter } from "./routes/health";
import { walletsRouter } from "./routes/wallets";
import { intentRouter } from "./routes/intent";
import { policiesRouter } from "./routes/policies";
import { privacyRouter } from "./routes/privacy";
import { recipesRouter } from "./routes/recipes";
import { relayerRouter } from "./routes/relayer";
import { adaptersRouter } from "./routes/adapters";

export const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

app.use((request, response, next) => {
  const requestId = request.header("x-request-id") ?? randomUUID();
  const startedAt = performance.now();
  response.setHeader("x-request-id", requestId);
  response.on("finish", () => {
    console.info(
      JSON.stringify({
        duration_ms: Math.round(performance.now() - startedAt),
        method: request.method,
        path: request.path,
        request_id: requestId,
        status: response.statusCode,
      })
    );
  });
  next();
});

app.use((request, response, next) => {
  const origin = request.headers.origin;
  const configuredOrigin = process.env.FRONTEND_URL?.replace(/\/$/, "");
  const trustedOrigins = new Set(
    [
      configuredOrigin,
      "https://veilorarh.com",
      "https://www.veilorarh.com",
      "http://localhost:5173",
      "http://localhost:3000",
    ].filter(Boolean)
  );

  if (origin && trustedOrigins.has(origin.replace(/\/$/, ""))) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  } else if (origin) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  } else {
    response.setHeader("Access-Control-Allow-Origin", "*");
  }

  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-request-id");
  response.setHeader("Access-Control-Allow-Credentials", "true");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }
  next();
});

// Mount Routes
app.use("/health", healthRouter);
app.use("/v1/wallets", walletsRouter);
app.use("/v1/intent", intentRouter);
app.use("/v1/policies", policiesRouter);
app.use("/v1/privacy", privacyRouter);
app.use("/v1/recipes", recipesRouter);
app.use("/v1/relayer", relayerRouter);
app.use("/v1/adapters", adaptersRouter);
