import express from "express";
import { randomUUID } from "node:crypto";
import { healthRouter } from "./routes/health";
import { walletsRouter } from "./routes/wallets";
import { relayerRouter } from "./routes/relayer";
import { rulesRouter } from "./routes/rules";
import { alertsRouter } from "./routes/alerts";
import { rotationsRouter } from "./routes/rotations";
import { spendingPolicyRouter } from "./routes/spendingPolicy";
import { quorumRouter } from "./routes/quorum";
import { onrampRouter } from "./routes/onramp";
import { explainRouter, walletExplainRouter } from "./routes/explain";
import { veilyRouter } from "./routes/veily";
import { bridgeRouter } from "./routes/bridge";
import { rpcRouter } from "./routes/rpc";
import { paymentLinksRouter, walletPaymentLinksRouter } from "./routes/paymentLinks";
import { authenticatorRouter } from "./routes/authenticator";
import { pricesRouter } from "./priceHistory";

export const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));

app.use((request, response, next) => {
  const requestId = request.header("x-request-id") ?? randomUUID();
  const startedAt = performance.now();
  response.setHeader("x-request-id", requestId);
  // RPC payloads can reveal wallet interests and addresses; do not persist request metadata for them.
  if (request.path !== "/v1/rpc") {
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
  }
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

  if (origin) {
    if (!trustedOrigins.has(origin.replace(/\/$/, ""))) {
      response.status(403).json({ error: "Origin is not allowed" });
      return;
    }
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
    response.setHeader("Access-Control-Allow-Credentials", "true");
  }

  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-request-id, x-veilora-timestamp, x-veilora-signature");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }
  next();
});

// Mount Routes
app.use("/health", healthRouter);
app.use("/v1/wallets/:address/rules", rulesRouter);
app.use("/v1/wallets/:address/alerts", alertsRouter);
app.use("/v1/wallets/:address/rotations", rotationsRouter);
app.use("/v1/wallets/:address/spending-policy", spendingPolicyRouter);
app.use("/v1/wallets/:address/quorum", quorumRouter);
app.use("/v1/wallets/:address/payment-links", walletPaymentLinksRouter);
app.use("/v1/payment-links", paymentLinksRouter);
app.use("/v1/wallets/:address/authenticator", authenticatorRouter);
app.use("/v1/onramp", onrampRouter);
app.use("/v1/explain", explainRouter);
app.use("/v1/wallets/:address/explain", walletExplainRouter);
app.use("/v1/wallets", walletsRouter);
app.use("/v1/relayer", relayerRouter);
app.use("/v1/veily", veilyRouter);
app.use("/v1/bridge", bridgeRouter);
app.use("/v1/rpc", rpcRouter);
app.use("/v1/prices", pricesRouter);
