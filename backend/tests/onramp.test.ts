import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import request from "supertest";
import { getAddress } from "viem";
import { app } from "../src/app";
import { generateShardKey } from "../src/crypto";
import { query } from "../src/db/index";
import { onrampRelay, readOnrampConfig, routeFor, signWidgetUrl, summarizeRelayRequests } from "../src/onramp";

const ENV_KEYS = ["MOONPAY_ENV", "MOONPAY_PUBLISHABLE_KEY", "MOONPAY_SECRET_KEY", "ONRAMP_DIRECT_CURRENCIES", "ONRAMP_REFUND_ADDRESS", "ONRAMP_RELAY_FALLBACK", "RELAY_LINK_API_KEY"];
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
const refund = getAddress(generateShardKey().address);
function setEnv(values: Record<string, string | undefined>) {
  for (const key of ENV_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(values)) if (value !== undefined) process.env[key] = value;
}
const sandbox = { MOONPAY_ENV: "sandbox", MOONPAY_PUBLISHABLE_KEY: "pk_test_abc", MOONPAY_SECRET_KEY: "sk_test_secret" };

describe("on-ramp configuration and signing", () => {
  afterEach(() => setEnv(saved as Record<string, string | undefined>));

  test("signs widget URLs exactly as MoonPay's published test vector", () => {
    const url = signWidgetUrl("https://buy-sandbox.moonpay.com", {
      apiKey: "pk_test_DocsVector00", currencyCode: "eth", walletAddress: "0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe",
    }, "sk_test_DocsVector00");
    expect(url.endsWith("&signature=oIJxSghyzll%2FBLhUFdQZhkxf7DAS8REFaWr%2FibO%2BK8Q%3D")).toBe(true);
  });

  test("is off without keys and refuses mixed sandbox and live keys", () => {
    setEnv({});
    expect(readOnrampConfig()).toBeNull();
    setEnv({ ...sandbox, MOONPAY_SECRET_KEY: "sk_live_x" });
    expect(() => readOnrampConfig()).toThrow("MOONPAY_ENV must match");
  });

  test("prefers direct Robinhood Chain delivery and only falls back to Relay with a refund address", () => {
    setEnv({ ...sandbox, ONRAMP_DIRECT_CURRENCIES: "USDG=usdg_robinhood" });
    const direct = readOnrampConfig()!;
    expect(routeFor(direct, "USDG")).toEqual({ asset: "USDG", kind: "direct", currencyCode: "usdg_robinhood", network: "Robinhood Chain" });
    expect(routeFor(direct, "ETH")).toBeNull();

    setEnv({ ...sandbox, RELAY_LINK_API_KEY: "relay" });
    expect(routeFor(readOnrampConfig()!, "ETH")).toBeNull();

    setEnv({ ...sandbox, RELAY_LINK_API_KEY: "relay", ONRAMP_REFUND_ADDRESS: refund });
    const relay = routeFor(readOnrampConfig()!, "USDG");
    expect(relay?.kind).toBe("relay");
    expect(relay?.currencyCode).toBe("usdc_base");
  });

  test("maps Relay request states to delivery states", () => {
    const rows = summarizeRelayRequests({ requests: [
      { id: "0x1", status: "success", data: { outTxs: [{ hash: "0xabc" }], metadata: { currencyOut: { amount: "99" } } } },
      { id: "0x2", status: "pending" },
      { id: "0x3", status: "refund" },
    ] });
    expect(rows.map((r: { state: string }) => r.state)).toEqual(["delivered", "delivering", "refunded"]);
    expect(rows[0].outTxHash).toBe("0xabc");
  });
});

describe("on-ramp API", () => {
  const wallet = getAddress(generateShardKey().address);
  const deposit = getAddress(generateShardKey().address);
  const realRelay = onrampRelay.request;

  beforeAll(async () => {
    await query(
      `INSERT INTO wallets (address, factory_address, chain_id, shard_a_address, shard_b_address, shard_b_encrypted, shard_c_address, api_key_hash)
       VALUES ($1, $2, 4663, $3, $4, 'test', $5, 'test')`,
      [wallet.toLowerCase(), "0xf86bea538ea756048f8df9be4bcd88aeb4d65376", generateShardKey().address.toLowerCase(),
        generateShardKey().address.toLowerCase(), generateShardKey().address.toLowerCase()],
    );
  });
  afterAll(async () => {
    onrampRelay.request = realRelay;
    setEnv(saved as Record<string, string | undefined>);
    await query("DELETE FROM wallets WHERE address = $1", [wallet.toLowerCase()]);
  });

  test("reports disabled and refuses sessions when not configured", async () => {
    setEnv({});
    expect((await request(app).get("/v1/onramp/config")).body.enabled).toBe(false);
    expect((await request(app).post("/v1/onramp/session").send({ walletAddress: wallet, asset: "USDG" })).status).toBe(503);
  });

  test("direct route delivers to the smart account itself", async () => {
    setEnv({ ...sandbox, ONRAMP_DIRECT_CURRENCIES: "USDG=usdg_robinhood" });
    const res = await request(app).post("/v1/onramp/session").send({ walletAddress: wallet, asset: "USDG", fiatAmount: 50 });
    expect(res.status).toBe(201);
    const url = new URL(res.body.url);
    expect(url.origin).toBe("https://buy-sandbox.moonpay.com");
    expect(url.searchParams.get("walletAddress")).toBe(wallet);
    expect(url.searchParams.get("currencyCode")).toBe("usdg_robinhood");
    expect(url.searchParams.get("baseCurrencyAmount")).toBe("50.00");
    expect(url.searchParams.get("externalTransactionId")).toBe(res.body.sessionId);
    expect(url.searchParams.get("signature")).toBeString();
  });

  test("Relay route sends MoonPay to a verified deposit address, never the account address on Base", async () => {
    setEnv({ ...sandbox, RELAY_LINK_API_KEY: "relay", ONRAMP_REFUND_ADDRESS: refund });
    let quoteBody: any;
    onrampRelay.request = async (path: string, body?: unknown) => {
      if (path === "/quote/v2") {
        quoteBody = body;
        return {
          steps: [{ id: "deposit", depositAddress: deposit, requestId: "0x" + "ab".repeat(32) }],
          details: {
            recipient: wallet, timeEstimate: 30,
            currencyIn: { currency: { chainId: 8453, address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" } },
            currencyOut: { currency: { chainId: 4663, address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168" } },
          },
        };
      }
      return { requests: [{ id: "0x9", status: "success", data: { outTxs: [{ hash: "0xdef" }] } }] };
    };
    const res = await request(app).post("/v1/onramp/session").send({ walletAddress: wallet, asset: "USDG" });
    expect(res.status).toBe(201);
    expect(quoteBody).toMatchObject({ useDepositAddress: true, recipient: wallet, destinationChainId: 4663, refundTo: refund });
    expect(new URL(res.body.url).searchParams.get("walletAddress")).toBe(deposit);
    expect(res.body.route).toBe("relay");

    const status = await request(app).get(`/v1/onramp/session/${res.body.sessionId}`);
    expect(status.body.deliveries[0]).toMatchObject({ state: "delivered", outTxHash: "0xdef" });
  });

  test("rejects a Relay deposit address bound to someone else", async () => {
    setEnv({ ...sandbox, RELAY_LINK_API_KEY: "relay", ONRAMP_REFUND_ADDRESS: refund });
    onrampRelay.request = async () => ({
      steps: [{ depositAddress: deposit }],
      details: {
        recipient: refund,
        currencyIn: { currency: { chainId: 8453, address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" } },
        currencyOut: { currency: { chainId: 4663, address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168" } },
      },
    });
    expect((await request(app).post("/v1/onramp/session").send({ walletAddress: wallet, asset: "USDG" })).status).toBe(502);
  });

  test("validates wallet, amount and freeze state", async () => {
    setEnv({ ...sandbox, ONRAMP_DIRECT_CURRENCIES: "USDG=usdg_robinhood" });
    expect((await request(app).post("/v1/onramp/session").send({ walletAddress: wallet, asset: "DOGE" })).status).toBe(400);
    expect((await request(app).post("/v1/onramp/session").send({ walletAddress: wallet, asset: "USDG", fiatAmount: 5 })).status).toBe(400);
    expect((await request(app).post("/v1/onramp/session").send({ walletAddress: getAddress(generateShardKey().address), asset: "USDG" })).status).toBe(404);
    await query("UPDATE wallets SET is_frozen = true, frozen_until = now() + interval '1 hour' WHERE address = $1", [wallet.toLowerCase()]);
    expect((await request(app).post("/v1/onramp/session").send({ walletAddress: wallet, asset: "USDG" })).status).toBe(403);
    await query("UPDATE wallets SET is_frozen = false, frozen_until = NULL WHERE address = $1", [wallet.toLowerCase()]);
  });
});
