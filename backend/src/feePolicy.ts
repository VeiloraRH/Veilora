export type FeeEstimate = {
  gasPrice?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
};

export type FeeOverrides =
  | { gasPrice: bigint; reservePrice: bigint }
  | { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint; reservePrice: bigint };

/** Ensure the relayer's fee cap stays above the current EIP-1559 base fee. */
export function safeFeeOverrides(baseFeePerGas: bigint | null | undefined, estimate: FeeEstimate): FeeOverrides {
  if (estimate.maxFeePerGas !== undefined) {
    const priority = estimate.maxPriorityFeePerGas ?? 0n;
    const headroom = baseFeePerGas == null ? estimate.maxFeePerGas : baseFeePerGas * 2n + priority;
    const maxFeePerGas = estimate.maxFeePerGas > headroom ? estimate.maxFeePerGas : headroom;
    return { maxFeePerGas, maxPriorityFeePerGas: priority, reservePrice: maxFeePerGas };
  }

  const gasPrice = estimate.gasPrice ?? 0n;
  if (baseFeePerGas == null || gasPrice >= baseFeePerGas) {
    return { gasPrice, reservePrice: gasPrice };
  }

  // Legacy gas-price estimates can lag the base fee on Robinhood Chain.
  const priority = baseFeePerGas / 20n > 1_000_000n ? baseFeePerGas / 20n : 1_000_000n;
  const maxFeePerGas = baseFeePerGas * 2n + priority;
  return { maxFeePerGas, maxPriorityFeePerGas: priority, reservePrice: maxFeePerGas };
}
