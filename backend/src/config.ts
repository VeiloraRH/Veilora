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
  process.env.VEILORA_SHIELDED_POOL_ADDRESS || "0x75c07c0bd9302eb277ee82736c57274a954867d8"
);

export const USDG_ADDRESS = getAddress(
  process.env.USDG_TOKEN_ADDRESS || "0x2b9C8B8B0569Ff81f94A1d48C0879685e8Ac3ebC"
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
