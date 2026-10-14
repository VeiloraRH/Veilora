import { expect, test, describe } from "bun:test";
import { safeFeeOverrides } from "../src/feePolicy";

describe("relayer fee policy", () => {
  test("raises a stale legacy gas estimate above the current base fee", () => {
    const fees = safeFeeOverrides(22_282_000n, { gasPrice: 22_058_000n });
    expect("maxFeePerGas" in fees).toBe(true);
    if ("maxFeePerGas" in fees) {
      expect(fees.maxFeePerGas).toBeGreaterThan(22_282_000n);
      expect(fees.reservePrice).toBe(fees.maxFeePerGas);
    }
  });

  test("preserves a sufficient legacy gas estimate", () => {
    const fees = safeFeeOverrides(20n, { gasPrice: 25n });
    expect(fees).toEqual({ gasPrice: 25n, reservePrice: 25n });
  });

  test("adds base-fee headroom to EIP-1559 estimates", () => {
    const fees = safeFeeOverrides(100n, { maxFeePerGas: 150n, maxPriorityFeePerGas: 5n });
    expect(fees).toEqual({ maxFeePerGas: 205n, maxPriorityFeePerGas: 5n, reservePrice: 205n });
  });
});
