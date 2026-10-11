import { createPublicClient, createWalletClient, defineChain, formatEther, getAddress, http, keccak256, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: join(import.meta.dir, "../../backend/.env") });
dotenv.config({ path: join(import.meta.dir, "../.env"), override: false });

const rpcUrl = process.env.ROBINHOOD_CHAIN_RPC || "https://rpc.mainnet.chain.robinhood.com";
const chainId = Number(process.env.ROBINHOOD_CHAIN_ID) || 4663;
const privateKey = process.env.RELAYER_PRIVATE_KEY as `0x${string}`;

if (!privateKey) {
  console.error("RELAYER_PRIVATE_KEY is not configured in backend/.env");
  process.exit(1);
}

if (chainId !== 4663) {
  console.error(`Refusing deployment: expected Robinhood Chain 4663, got ${chainId}`);
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
  const actualChainId = await publicClient.getChainId();
  if (actualChainId !== chainId) throw new Error(`RPC is connected to chain ${actualChainId}, expected ${chainId}`);
  console.log("==================================================");
  console.log("🛡️  Veilora Contracts Deployer");
  console.log("==================================================");
  console.log(`Network:     Robinhood Chain (Chain ID: ${chainId})`);
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
  const deployedPath = join(import.meta.dir, "../deployed.json");
  let priorDeployment: Record<string, unknown> = {};
  if (existsSync(deployedPath)) {
    try { priorDeployment = JSON.parse(readFileSync(deployedPath, "utf8")); } catch { priorDeployment = {}; }
  }

  // 1. Deploy or reuse VeiloraFactory
  const legacyFactoryFallback = "0x210f310f150c0DF3224D61Ca7dCaf3e1ad578bd7";
  const configuredFactoryAddress = (priorDeployment.veiloraFactory as string | undefined)
    ? getAddress(priorDeployment.veiloraFactory as string)
    : getAddress(process.env.VEILORA_FACTORY_ADDRESS || legacyFactoryFallback);

  let factoryAddress: `0x${string}` = configuredFactoryAddress;
  const existingCode = await publicClient.getCode({ address: factoryAddress });
  let factoryDeploymentTx: Hex | null = null;

  if (process.env.DEPLOY_NEW_FACTORY !== "true" && existingCode && existingCode !== "0x") {
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
    if (factoryReceipt.status !== "success" || !factoryReceipt.contractAddress) {
      throw new Error("Factory deployment transaction failed or returned no contract address");
    }
    factoryDeploymentTx = factoryHash;
    factoryAddress = factoryReceipt.contractAddress;
    const deployedCode = await publicClient.getCode({ address: factoryAddress });
    if (!deployedCode || deployedCode === "0x") throw new Error("Factory deployment succeeded without deployed code");
    console.log(`✅ VeiloraFactory deployed at: ${factoryAddress}`);
  }

  const factoryCode = await publicClient.getCode({ address: factoryAddress });
  if (!factoryCode || factoryCode === "0x") throw new Error("Configured factory address has no code");

  // USDG remains a registry token; Veilora no longer deploys a proofless pool.
  const rawUsdgAddress = process.env.USDG_TOKEN_ADDRESS || "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
  const usdgTokenAddress = getAddress(rawUsdgAddress);

  // Save deployed addresses
  const deployed = {
    chainId,
    deployer: account.address,
    previousFactory: factoryDeploymentTx
      ? configuredFactoryAddress
      : ((priorDeployment.previousFactory as string | undefined)
          ? getAddress(priorDeployment.previousFactory as string)
          : legacyFactoryFallback),
    veiloraFactory: factoryAddress,
    factoryDeploymentTx: factoryDeploymentTx ?? (priorDeployment.factoryDeploymentTx as Hex | undefined) ?? null,
    factoryRuntimeCodeHash: keccak256(factoryCode),
    usdgToken: usdgTokenAddress,
    deployedAt: factoryDeploymentTx ? new Date().toISOString() : ((priorDeployment.deployedAt as string | undefined) ?? new Date().toISOString()),
  };

  writeFileSync(deployedPath, JSON.stringify(deployed, null, 2));
  console.log(`\n💾 Saved deployment metadata to contracts/deployed.json`);
  console.log("==================================================");
}

main().catch((err) => {
  console.error("❌ Deployment failed:", err);
  process.exit(1);
});
