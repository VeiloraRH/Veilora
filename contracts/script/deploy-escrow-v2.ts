import { createPublicClient, createWalletClient, defineChain, formatEther, getAddress, http, keccak256, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: join(import.meta.dir, "../../backend/.env") });
dotenv.config({ path: join(import.meta.dir, "../.env"), override: false });

const rpcUrl = process.env.ROBINHOOD_CHAIN_RPC || "https://rpc.mainnet.chain.robinhood.com";
const chainId = Number(process.env.ROBINHOOD_CHAIN_ID) || 4663;
const privateKey = process.env.VEILORA_ESCROW_DEPLOYER_PRIVATE_KEY || process.env.RELAYER_PRIVATE_KEY;
if (!privateKey) throw new Error("Set VEILORA_ESCROW_DEPLOYER_PRIVATE_KEY or RELAYER_PRIVATE_KEY in backend/.env.");
if (chainId !== 4663) throw new Error(`Refusing deployment: expected Robinhood Chain 4663, got ${chainId}.`);

const chain = defineChain({
  id: chainId,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
});
const account = privateKeyToAccount(privateKey as Hex);
const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

async function main() {
  if (await publicClient.getChainId() !== chainId) throw new Error("RPC returned an unexpected chain ID.");
  const balance = await publicClient.getBalance({ address: account.address });
  if (balance === 0n) throw new Error(`Deployer ${account.address} has no ETH for gas.`);
  console.log(`Deploying VeiloraEscrowFactoryV2 from ${account.address} (${formatEther(balance)} ETH).`);

  const basename = "contracts_src_VeiloraEscrowFactoryV2_sol_VeiloraEscrowFactoryV2";
  const out = join(import.meta.dir, "../out");
  const abi = JSON.parse(readFileSync(join(out, `${basename}.abi`), "utf8"));
  const bytecode = `0x${readFileSync(join(out, `${basename}.bin`), "utf8").trim()}` as Hex;
  const txHash = await walletClient.deployContract({ abi, bytecode, args: [] });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success" || !receipt.contractAddress) throw new Error("Escrow factory deployment failed.");
  const deployedCode = await publicClient.getCode({ address: receipt.contractAddress });
  if (!deployedCode || deployedCode === "0x") throw new Error("Factory deployment succeeded without runtime code.");

  const manifestPath = join(import.meta.dir, "../deployed.json");
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
  const updated = {
    ...manifest,
    chainId,
    escrowFactoryV2: getAddress(receipt.contractAddress),
    escrowFactoryV2DeploymentTx: txHash,
    escrowFactoryV2RuntimeCodeHash: keccak256(deployedCode),
    escrowFactoryV2Deployer: account.address,
    escrowFactoryV2DeployedAt: new Date().toISOString(),
  };
  writeFileSync(manifestPath, JSON.stringify(updated, null, 2));
  console.log(`Factory: ${receipt.contractAddress}`);
  console.log(`Transaction: ${txHash}`);
  console.log("Deployment manifest updated.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
