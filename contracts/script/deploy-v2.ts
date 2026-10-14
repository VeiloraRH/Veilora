import { createPublicClient, createWalletClient, defineChain, formatEther, getAddress, http, keccak256, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: join(import.meta.dir, "../../backend/.env") });
dotenv.config({ path: join(import.meta.dir, "../.env"), override: false });

const rpcUrl = process.env.ROBINHOOD_CHAIN_RPC || "https://rpc.mainnet.chain.robinhood.com";
const chainId = Number(process.env.ROBINHOOD_CHAIN_ID) || 4663;
const privateKey = process.env.RELAYER_PRIVATE_KEY as Hex | undefined;
if (!privateKey) throw new Error("RELAYER_PRIVATE_KEY is not configured in backend/.env.");
if (chainId !== 4663) throw new Error(`Refusing V2 deployment: expected Robinhood Chain 4663, got ${chainId}.`);

const chain = defineChain({
  id: chainId,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
});
const account = privateKeyToAccount(privateKey);
const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

async function main() {
  if (await publicClient.getChainId() !== chainId) throw new Error("RPC returned an unexpected chain ID.");
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Deploying the Veilora V2 factory from ${account.address} (${formatEther(balance)} ETH).`);
  if (balance === 0n) throw new Error("The relayer has no ETH for gas.");

  const outDir = join(import.meta.dir, "../out");
  const basename = "contracts_src_VeiloraFactoryV2_sol_VeiloraFactoryV2";
  const abi = JSON.parse(readFileSync(join(outDir, `${basename}.abi`), "utf8"));
  const bytecode = `0x${readFileSync(join(outDir, `${basename}.bin`), "utf8").trim()}` as Hex;
  const entryPoint = getAddress("0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789");
  const txHash = await walletClient.deployContract({ abi, bytecode, args: [entryPoint] });
  console.log(`Deployment transaction: ${txHash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success" || !receipt.contractAddress) throw new Error("V2 factory deployment failed.");

  const code = await publicClient.getCode({ address: receipt.contractAddress });
  if (!code || code === "0x") throw new Error("V2 factory deployment succeeded without runtime code.");
  const manifestPath = join(import.meta.dir, "../deployed.json");
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
  const updated = {
    ...manifest,
    chainId,
    veiloraFactoryV2: getAddress(receipt.contractAddress),
    factoryV2DeploymentTx: txHash,
    factoryV2RuntimeCodeHash: keccak256(code),
    factoryV2Deployer: account.address,
    factoryV2DeployedAt: new Date().toISOString(),
  };
  writeFileSync(manifestPath, JSON.stringify(updated, null, 2));
  console.log(`V2 factory: ${receipt.contractAddress}`);
  console.log("V2 deployment metadata saved to contracts/deployed.json.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
