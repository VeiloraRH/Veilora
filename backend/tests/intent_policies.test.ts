import { expect, test, describe } from "bun:test";
import request from "supertest";
import { app } from "../src/app";

describe("Intent Parsing, Simulation & Policies API", () => {
  let planId: string;
  let parsedPlan: any;
  let planSimulation: any;

  test("POST /v1/intent/parse parses natural language goal into structured plan", async () => {
    const res = await request(app)
      .post("/v1/intent/parse")
      .send({
        goal: "Buy 250 USDG of NVDA exposure under 0.5% fee with 0.05 ETH reserved for gas",
      });

    expect(res.status).toBe(201);
    expect(res.body.action).toBe("shield_swap");
    expect(res.body.assetIn).toBe("USDG");
    expect(res.body.amountIn).toBe("250");
    expect(res.body.assetOut).toBe("NVDA");
    expect(res.body.constraints.maxTotalFeeBps).toBe(50);
    expect(res.body.constraints.preserveGas).toBe("0.05 ETH");

    planId = res.body.id;
    parsedPlan = res.body;
  });

  test("POST /v1/intent/simulate calculates balance diffs, route, and disclosures", async () => {
    const res = await request(app)
      .post("/v1/intent/simulate")
      .send({
        plan: parsedPlan,
        currentPublicUSDG: 1000,
        currentGasEth: 0.12,
      });

    expect(res.status).toBe(200);
    expect(res.body.simulation.status).toBe("eligible");
    expect(res.body.simulation.route.length).toBeGreaterThan(0);
    expect(res.body.simulation.balanceDiffs.length).toBeGreaterThan(0);
    expect(res.body.simulation.disclosures.length).toBeGreaterThan(0);
    expect(res.body.simulation.gasReserveStatus.isPreserved).toBe(true);

    planSimulation = res.body.simulation;
  });

  test("POST /v1/policies/evaluate confirms compliance with fee and reserve limits", async () => {
    const res = await request(app)
      .post("/v1/policies/evaluate")
      .send({
        plan: parsedPlan,
        simulation: planSimulation,
      });

    expect(res.status).toBe(200);
    expect(res.body.passed).toBe(true);
    expect(res.body.checks.feeCeilingOk).toBe(true);
    expect(res.body.checks.gasReserveOk).toBe(true);
    expect(res.body.checks.assetAllowed).toBe(true);
  });

  test("GET /v1/policies returns active system policies", async () => {
    const res = await request(app).get("/v1/policies");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.policies)).toBe(true);
  });
});
