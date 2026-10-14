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
  process.env.VEILORA_FACTORY_ADDRESS || "0xf86bea538ea756048f8df9be4bcd88aeb4d65376"
);

export const USDG_ADDRESS = getAddress(
  process.env.USDG_TOKEN_ADDRESS || "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168"
);

export const RELAY_LINK_API_KEY = process.env.RELAY_LINK_API_KEY;

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
