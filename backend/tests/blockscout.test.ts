import { expect, test } from "bun:test";
import request from "supertest";
import { app } from "../src/app";
import { buildBlockscoutHistoryUrl } from "../src/blockscout";

test("builds a keyed Blockscout history URL for Robinhood Chain", () => {
  const priorBase = process.env.CHAIN_EXPLORER_API_URL;
  delete process.env.CHAIN_EXPLORER_API_URL;
  try {
    const url = buildBlockscoutHistoryUrl(
      "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
      "token-transfers",
      "test-only-key",
    );
    expect(url.origin).toBe("https://api.blockscout.com");
    expect(url.pathname.toLowerCase()).toBe("/4663/api/v2/addresses/0xd8da6bf26964af9d7eed9e03e53415d37aa96045/token-transfers");
    expect(url.searchParams.get("apikey")).toBe("test-only-key");
    expect(url.searchParams.get("type")).toBe("ERC-20");
  } finally {
    if (priorBase === undefined) delete process.env.CHAIN_EXPLORER_API_URL;
    else process.env.CHAIN_EXPLORER_API_URL = priorBase;
  }
});

test("rejects history cursors that try to replace reserved provider parameters", async () => {
  const cursor = encodeURIComponent(JSON.stringify({ apikey: "attacker-controlled" }));
  const response = await request(app)
    .get(`/v1/wallets/0xd8da6bf26964af9d7eed9e03e53415d37aa96045/transactions?kind=token-transfers&cursor=${cursor}`);
  expect(response.status).toBe(400);
  expect(response.body.error).toBe("Invalid history cursor");
});
