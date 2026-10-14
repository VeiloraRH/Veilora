import { Router } from "express";
import { RELAY_LINK_API_KEY } from "../config";
import { bridgeDestinations, bridgeSourceAssets, parseBridgeInput, relayRequest, validateRelayQuote } from "../bridge";

export const bridgeRouter = Router();

bridgeRouter.get("/config", (_req, res) => {
  res.json({
    success: true,
    enabled: Boolean(RELAY_LINK_API_KEY),
    originChainId: 4663,
    sourceAssets: bridgeSourceAssets,
    destinations: bridgeDestinations,
  });
});

bridgeRouter.post("/quote", async (req, res) => {
  let input;
  try {
    input = parseBridgeInput(req.body);
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : "Invalid bridge request." });
    return;
  }
  if (!RELAY_LINK_API_KEY) {
    res.status(503).json({ success: false, error: "Cross-chain transfers are temporarily unavailable." });
    return;
  }
  try {
    const startedAt = Date.now();
    const raw = await relayRequest("/quote/v2", {
      user: input.ownerAddress,
      recipient: input.recipient,
      originChainId: 4663,
      destinationChainId: input.destinationChainId,
      originCurrency: input.originCurrency,
      destinationCurrency: input.destination.currency,
      amount: input.amount,
      tradeType: "EXACT_INPUT",
      slippageTolerance: "50",
      ttl: 120,
      usePermit: false,
      explicitDeposit: true,
      refundTo: input.ownerAddress,
    });
    const quote = validateRelayQuote(raw, input, startedAt);
    res.json({ success: true, quote });
  } catch (error) {
    console.warn("[bridge] Relay quote unavailable or invalid", error instanceof Error ? error.message : "unknown error");
    res.status(502).json({ success: false, error: "No supported route is available for this selection and amount. Try another amount or try again shortly." });
  }
});

bridgeRouter.get("/status/:requestId", async (req, res) => {
  const requestId = String(req.params.requestId);
  if (!/^0x[\da-f]{64}$/i.test(requestId)) {
    res.status(400).json({ success: false, error: "Invalid bridge reference." });
    return;
  }
  if (!RELAY_LINK_API_KEY) {
    res.status(503).json({ success: false, error: "Delivery tracking is temporarily unavailable." });
    return;
  }
  try {
    const raw = await relayRequest(`/intents/status/v3?requestId=${encodeURIComponent(requestId)}`);
    const hashes = (...values: unknown[]) => [...new Set(values.flatMap((value) =>
      Array.isArray(value) ? value.filter((hash): hash is string => typeof hash === "string" && /^0x[\da-f]{64}$/i.test(hash)) : [],
    ))];
    const updatedAt = typeof raw.updatedAt === "number" && Number.isFinite(raw.updatedAt)
      ? new Date(raw.updatedAt).toISOString()
      : typeof raw.updatedAt === "string" ? raw.updatedAt : null;
    res.json({
      success: true,
      status: {
        status: typeof raw.status === "string" ? raw.status : "unknown",
        inTxHashes: hashes(raw.inTxHashes),
        // Relay v3 uses `txHashes` for destination transactions.
        outTxHashes: hashes(raw.outTxHashes, raw.txHashes),
        refundTxHashes: hashes(raw.refundTxHashes),
        updatedAt,
      },
    });
  } catch (error) {
    console.warn("[bridge] Relay status unavailable", error instanceof Error ? error.message : "unknown error");
    res.status(502).json({ success: false, error: "Delivery status is temporarily unavailable. Retry tracking; do not submit the transfer again." });
  }
});
