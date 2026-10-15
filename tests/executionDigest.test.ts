import { describe, expect, test } from 'bun:test';
import { encodeFunctionData, parseAbi } from 'viem';
import { executionDigest } from '../src/lib/walletChain';
import { computeExecutionDigest, computeExecutionDigestV2 } from '../backend/src/crypto';

const wallet = '0xeFE2268BcC784301A939DAaee7393ab81af4CC53';
const data = encodeFunctionData({ abi: parseAbi(['function rotateShardA(address newShardA)']), functionName: 'rotateShardA', args: ['0x2222222222222222222222222222222222222222'] });

describe('execution digest', () => {
  test('frontend and co-signer compute the same digest for v1 and v2 accounts', () => {
    expect(executionDigest(wallet, 2, wallet, 0n, data, 7n, 1_900_000_000)).toBe(computeExecutionDigestV2(wallet, wallet, 0n, data, 7n, 1_900_000_000n, 4663n));
    expect(executionDigest(wallet, 1, wallet, 5n, data, 7n, 1_900_000_000)).toBe(computeExecutionDigest(wallet, 5n, data, 7n, 1_900_000_000n, 4663n));
  });
});
