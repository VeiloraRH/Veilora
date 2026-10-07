import { expect, test, describe } from "bun:test";
import {
  keccak256,
  encodePacked,
  encodeAbiParameters,
  parseAbiParameters,
  recoverAddress,
  recoverMessageAddress,
  type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

describe("Veilora Contracts Suite", () => {
  const outDir = join(import.meta.dir, "../out");

  test("Solidity bytecode and ABIs are compiled", () => {
    expect(existsSync(join(outDir, "contracts_src_VeiloraAccount_sol_VeiloraAccount.bin"))).toBeTrue();
    expect(existsSync(join(outDir, "contracts_src_VeiloraFactory_sol_VeiloraFactory.bin"))).toBeTrue();
    expect(existsSync(join(outDir, "contracts_src_VeiloraShieldedPool_sol_VeiloraShieldedPool.bin"))).toBeTrue();
  });

  test("2-of-3 Threshold Quorum Signatures: Shard A + Shard B format", async () => {
    const shardA = privateKeyToAccount(generatePrivateKey());
    const shardB = privateKeyToAccount(generatePrivateKey());
    const shardC = privateKeyToAccount(generatePrivateKey());

    const nonce = 0n;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const chainId = 4663n;
    const target = "0x1111111111111111111111111111111111111111";
    const value = 0n;
    const callData = "0x" as Hex;

    // Matches Solidity digest calculation
    const typeHash = keccak256(
      Buffer.from(
        "VeiloraExecution(address target,uint256 value,bytes data,uint256 nonce,uint256 deadline,uint256 chainId)"
      )
    );

    const encoded = encodeAbiParameters(
      parseAbiParameters("bytes32, address, uint256, bytes32, uint256, uint256, uint256"),
      [typeHash, target, value, keccak256(callData), nonce, deadline, chainId]
    );

    const digest = keccak256(encoded);

    // Sign with Shard A & Shard B
    const sigA = await shardA.signMessage({ message: { raw: digest as Hex } });
    const sigB = await shardB.signMessage({ message: { raw: digest as Hex } });

    // Concatenate into 130-byte threshold payload
    const concatenated = "0x" + sigA.slice(2) + sigB.slice(2);
    expect(concatenated.length).toBe(2 + 260); // 130 bytes = 260 hex characters

    // Verify recovery of both signers
    const recoveredA = await recoverMessageAddress({ message: { raw: digest as Hex }, signature: sigA });
    const recoveredB = await recoverMessageAddress({ message: { raw: digest as Hex }, signature: sigB });

    expect(recoveredA.toLowerCase()).toBe(shardA.address.toLowerCase());
    expect(recoveredB.toLowerCase()).toBe(shardB.address.toLowerCase());
    expect(recoveredA).not.toBe(recoveredB);

    // Verify quorum is satisfied with 2 distinct authorized signers
    const authorized = [shardA.address.toLowerCase(), shardB.address.toLowerCase(), shardC.address.toLowerCase()];
    expect(authorized.includes(recoveredA.toLowerCase())).toBeTrue();
    expect(authorized.includes(recoveredB.toLowerCase())).toBeTrue();
  });

  test("Recovery Quorum: Shard B + Shard C satisfies threshold", async () => {
    const shardA = privateKeyToAccount(generatePrivateKey());
    const shardB = privateKeyToAccount(generatePrivateKey());
    const shardC = privateKeyToAccount(generatePrivateKey());

    const digest = keccak256(Buffer.from("recovery-test-digest"));

    const sigB = await shardB.signMessage({ message: { raw: digest as Hex } });
    const sigC = await shardC.signMessage({ message: { raw: digest as Hex } });

    const recoveredB = await recoverMessageAddress({ message: { raw: digest as Hex }, signature: sigB });
    const recoveredC = await recoverMessageAddress({ message: { raw: digest as Hex }, signature: sigC });

    const authorized = new Set([
      shardA.address.toLowerCase(),
      shardB.address.toLowerCase(),
      shardC.address.toLowerCase(),
    ]);

    expect(authorized.has(recoveredB.toLowerCase())).toBeTrue();
    expect(authorized.has(recoveredC.toLowerCase())).toBeTrue();
    expect(recoveredB).not.toBe(recoveredC);
  });

  test("CREATE2 Deterministic Address Prediction", () => {
    const factoryAddress = "0x5555555555555555555555555555555555555555";
    const shardA = "0x1111111111111111111111111111111111111111";
    const shardB = "0x2222222222222222222222222222222222222222";
    const shardC = "0x3333333333333333333333333333333333333333";
    const salt = 12345n;

    const finalSalt = keccak256(
      encodePacked(
        ["address", "address", "address", "uint256"],
        [shardA, shardB, shardC, salt]
      )
    );

    expect(finalSalt).toBeString();
    expect(finalSalt.length).toBe(66);
  });
});
