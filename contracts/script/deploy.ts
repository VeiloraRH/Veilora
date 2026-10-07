import { createPublicClient, createWalletClient, defineChain, formatEther, getAddress, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: join(import.meta.dir, "../.env") });

const rpcUrl = process.env.ROBINHOOD_CHAIN_RPC || "https://rpc.mainnet.chain.robinhood.com";
const chainId = Number(process.env.ROBINHOOD_CHAIN_ID) || 4663;
const privateKey = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`;

if (!privateKey) {
  console.error("❌ DEPLOYER_PRIVATE_KEY is not defined in contracts/.env");
  process.exit(1);
}

const robinhoodChain = defineChain({
  id: chainId,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
});

const account = privateKeyToAccount(privateKey);
const publicClient = createPublicClient({ chain: robinhoodChain, transport: http(rpcUrl) });
const walletClient = createWalletClient({ account, chain: robinhoodChain, transport: http(rpcUrl) });

async function main() {
  console.log("==================================================");
  console.log("🛡️  Veilora Contracts Deployer");
  console.log("==================================================");
  console.log(`Network:     Robinhood Chain (Chain ID: ${chainId})`);
  console.log(`RPC URL:     ${rpcUrl}`);
  console.log(`Deployer:    ${account.address}`);

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Balance:     ${formatEther(balance)} ETH`);
  console.log("--------------------------------------------------");

  if (balance === 0n) {
    console.log("⚠️  Deployer has 0 ETH on Robinhood Chain.");
    console.log(`👉 Please fund this deployer address on Robinhood Chain:`);
    console.log(`\n    ${account.address}\n`);
    console.log(`Once funded with gas ETH (e.g. 0.005 ETH), run:`);
    console.log(`    bun run contracts/script/deploy.ts`);
    console.log("==================================================");
    return;
  }

  const outDir = join(import.meta.dir, "../out");

  // 1. Deploy or reuse VeiloraFactory
  let factoryAddress: `0x${string}` = "0x210f310f150c0df3224d61ca7dcaf3e1ad578bd7";
  const existingCode = await publicClient.getCode({ address: factoryAddress });

  if (existingCode && existingCode !== "0x") {
    console.log(`ℹ️  VeiloraFactory already deployed at: ${factoryAddress}`);
  } else {
    console.log("🚀 Deploying VeiloraFactory (CREATE2 deterministic wallet factory)...");
    const factoryBin = readFileSync(
      join(outDir, "contracts_src_VeiloraFactory_sol_VeiloraFactory.bin"),
      "utf8"
    ).trim();
    const factoryAbi = JSON.parse(
      readFileSync(
        join(outDir, "contracts_src_VeiloraFactory_sol_VeiloraFactory.abi"),
        "utf8"
      )
    );

    const entryPointAddress = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

    const factoryHash = await walletClient.deployContract({
      abi: factoryAbi,
      bytecode: `0x${factoryBin}`,
      args: [entryPointAddress],
    });
    console.log(`   Tx Hash: ${factoryHash}`);
    const factoryReceipt = await publicClient.waitForTransactionReceipt({ hash: factoryHash });
    factoryAddress = factoryReceipt.contractAddress!;
    console.log(`✅ VeiloraFactory deployed at: ${factoryAddress}`);
  }

  // 2. Deploy VeiloraShieldedPool (USDG note deposit/unshield pool)
  console.log("\n🚀 Deploying VeiloraShieldedPool (USDG Shielded Note Pool)...");
  const poolBin = readFileSync(
    join(outDir, "contracts_src_VeiloraShieldedPool_sol_VeiloraShieldedPool.bin"),
    "utf8"
  ).trim();
  const poolAbi = JSON.parse(
    readFileSync(
      join(outDir, "contracts_src_VeiloraShieldedPool_sol_VeiloraShieldedPool.abi"),
      "utf8"
    )
  );

  // Robinhood Chain USDG address
  const rawUsdgAddress = process.env.USDG_TOKEN_ADDRESS || "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
  const usdgTokenAddress = getAddress(rawUsdgAddress);

  const poolHash = await walletClient.deployContract({
    abi: poolAbi,
    bytecode: `0x${poolBin}`,
    args: [usdgTokenAddress],
  });
  console.log(`   Tx Hash: ${poolHash}`);
  const poolReceipt = await publicClient.waitForTransactionReceipt({ hash: poolHash });
  const poolAddress = poolReceipt.contractAddress!;
  console.log(`✅ VeiloraShieldedPool deployed at: ${poolAddress}`);

  // Save deployed addresses
  const deployed = {
    chainId,
    deployer: account.address,
    veiloraFactory: factoryAddress,
    veiloraShieldedPool: poolAddress,
    usdgToken: usdgTokenAddress,
    deployedAt: new Date().toISOString(),
  };

  const deployedPath = join(import.meta.dir, "../deployed.json");
  writeFileSync(deployedPath, JSON.stringify(deployed, null, 2));
  console.log(`\n💾 Saved deployment metadata to contracts/deployed.json`);
  console.log("==================================================");
}

main().catch((err) => {
  console.error("❌ Deployment failed:", err);
  process.exit(1);
});
