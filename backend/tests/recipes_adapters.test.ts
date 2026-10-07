import { expect, test, describe } from "bun:test";
import request from "supertest";
import { app } from "../src/app";

describe("Execution Plane API (Recipes, Adapters & Relayer)", () => {
  test("GET /v1/recipes returns seeded composable recipes", async () => {
    const res = await request(app).get("/v1/recipes");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.recipes)).toBe(true);
    expect(res.body.recipes.length).toBeGreaterThan(0);

    const recipeIds = res.body.recipes.map((r: any) => r.recipe_id);
    expect(recipeIds).toContain("shield-usdg");
    expect(recipeIds).toContain("shield-swap-stock");
  });

  test("GET /v1/recipes/:id returns specific recipe details", async () => {
    const res = await request(app).get("/v1/recipes/shield-usdg");

    expect(res.status).toBe(200);
    expect(res.body.recipe_id).toBe("shield-usdg");
    expect(res.body.name).toBe("Shield USDG");
    expect(Array.isArray(res.body.steps)).toBe(true);
  });

  test("GET /v1/adapters/status returns active Robinhood Chain operational status", async () => {
    const res = await request(app).get("/v1/adapters/status");

    expect(res.status).toBe(200);
    expect(res.body.activeChain.chainId).toBe(4663);
    expect(res.body.contracts.factory).toBeString();
    expect(res.body.contracts.shieldedPool).toBeString();
  });

  test("GET /v1/relayer/status returns Robinhood Chain network info and relayer readiness", async () => {
    const res = await request(app).get("/v1/relayer/status");

    expect(res.status).toBe(200);
    expect(res.body.network.chainId).toBe(4663);
    expect(res.body.relayer.address).toBeString();
    expect(res.body.relayer.ready).toBe(true);
  });
});
