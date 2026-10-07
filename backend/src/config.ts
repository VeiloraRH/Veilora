import { createPublicClient, createWalletClient, defineChain, getAddress, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import dotenv from "dotenv";

dotenv.config();

export const CHAIN_ID = Number(process.env.ROBINHOOD_CHAIN_ID) || 4663;
export const RPC_URL = process.env.ROBINHOOD_CHAIN_RPC || "https://rpc.mainnet.chain.robinhood.com";

export const robinhoodChain = defineChain({
  id: CHAIN_ID,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] },
  },
});

export const FACTORY_ADDRESS = getAddress(
  process.env.VEILORA_FACTORY_ADDRESS || "0x210f310f150c0df3224d61ca7dcaf3e1ad578bd7"
);

export const SHIELDED_POOL_ADDRESS = getAddress(
  process.env.VEILORA_SHIELDED_POOL_ADDRESS || "0x5e4e2bec80528b0dd30182a7a956dc0e53826b80"
);

export const USDG_ADDRESS = getAddress(
  process.env.USDG_TOKEN_ADDRESS || "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168"
);

export const publicClient = createPublicClient({
  chain: robinhoodChain,
  transport: http(RPC_URL),
});

const relayerPrivateKey = process.env.RELAYER_PRIVATE_KEY as `0x${string}` | undefined;

export const relayerAccount = relayerPrivateKey
  ? privateKeyToAccount(relayerPrivateKey)
  : undefined;

export const relayerClient = relayerAccount
  ? createWalletClient({
      account: relayerAccount,
      chain: robinhoodChain,
      transport: http(RPC_URL),
    })
  : undefined;
