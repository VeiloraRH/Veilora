import { expect, test } from "bun:test";
import request from "supertest";
import { app } from "../src/app";

test("GET /health returns 200 and service metadata", async () => {
  const response = await request(app)
    .get("/health")
    .set("x-request-id", "test-request-id");

  expect(response.status).toBe(200);
  expect(response.body.status).toBe("ok");
  expect(response.body.timestamp).toBeString();
  expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);
  expect(response.body.version).toBeString();
  expect(response.headers["x-request-id"]).toBe("test-request-id");
});
