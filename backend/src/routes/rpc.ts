import { Router, type Request, type Response } from "express";
import { RPC_URL } from "../config";

export const rpcRouter = Router();

const ALLOWED_METHODS = new Set([
  "eth_chainId",
  "eth_blockNumber",
  "eth_getBalance",
  "eth_getTransactionCount",
  "eth_getCode",
  "eth_call",
  "eth_getBlockByNumber",
  "eth_getBlockByHash",
  "eth_getTransactionByHash",
  "eth_getTransactionReceipt",
  "eth_gasPrice",
  "eth_maxPriorityFeePerGas",
  "eth_feeHistory",
  "eth_estimateGas",
  "eth_getStorageAt",
]);

const CALL_LIMIT = 360;
const WINDOW_MS = 60_000;
const callWindows = new Map<string, { startedAt: number; count: number }>();

function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

function validCall(value: unknown): value is { jsonrpc: "2.0"; id?: string | number | null; method: string; params: unknown[] } {
  if (!value || typeof value !== "object") return false;
  const call = value as Record<string, unknown>;
  return call.jsonrpc === "2.0" && typeof call.method === "string" && ALLOWED_METHODS.has(call.method) &&
    Array.isArray(call.params) && call.params.length <= 20 &&
    (call.id === undefined || call.id === null || typeof call.id === "string" || typeof call.id === "number");
}

function consumeRateLimit(request: Request, cost: number) {
  const key = request.ip || request.socket.remoteAddress || "unknown";
  const now = Date.now();
  const current = callWindows.get(key);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    callWindows.set(key, { startedAt: now, count: cost });
    if (callWindows.size > 10_000) {
      for (const [client, window] of callWindows) if (now - window.startedAt >= WINDOW_MS) callWindows.delete(client);
    }
    return true;
  }
  if (current.count + cost > CALL_LIMIT) return false;
  current.count += cost;
  return true;
}

rpcRouter.post("/", async (request, response) => {
  const body = request.body;
  const calls = Array.isArray(body) ? body : [body];
  if (!calls.length || calls.length > 30 || calls.some((call) => !validCall(call))) {
    response.status(400).json(rpcError(null, -32600, "Invalid or unsupported JSON-RPC request."));
    return;
  }
  if (Buffer.byteLength(JSON.stringify(body)) > 128 * 1024) {
    response.status(413).json(rpcError(null, -32600, "JSON-RPC request is too large."));
    return;
  }
  if (!consumeRateLimit(request, calls.length)) {
    response.status(429).json(rpcError(null, -32005, "RPC request limit reached. Try again shortly."));
    return;
  }

  try {
    const upstream = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await upstream.json().catch(() => null);
    if (!upstream.ok || payload == null) {
      response.status(502).json(Array.isArray(body)
        ? calls.map((call) => rpcError(call.id, -32000, "Robinhood Chain RPC is temporarily unavailable."))
        : rpcError(calls[0]?.id, -32000, "Robinhood Chain RPC is temporarily unavailable."));
      return;
    }
    response.status(200).json(payload);
  } catch {
    response.status(502).json(Array.isArray(body)
      ? calls.map((call) => rpcError(call.id, -32000, "Robinhood Chain RPC is temporarily unavailable."))
      : rpcError(calls[0]?.id, -32000, "Robinhood Chain RPC is temporarily unavailable."));
  }
});
