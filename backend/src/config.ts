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

/** Factory retained for Legacy v1 wallets. New registrations only use V2. */
export const LEGACY_FACTORY_ADDRESS = getAddress(
  process.env.VEILORA_LEGACY_FACTORY_ADDRESS || process.env.VEILORA_FACTORY_ADDRESS || "0xf86bea538ea756048f8df9be4bcd88aeb4d65376"
);
/** Verified V2 factory; an environment override supports deliberate future upgrades. */
export const V2_FACTORY_ADDRESS = process.env.VEILORA_V2_FACTORY_ADDRESS
  ? getAddress(process.env.VEILORA_V2_FACTORY_ADDRESS)
  : getAddress("0xBB073C1c441e9793f8eFf49A35BDEafbCD6d475c");
/** Compatibility alias for existing operational/status code. */
export const FACTORY_ADDRESS = LEGACY_FACTORY_ADDRESS;

export const USDG_ADDRESS = getAddress(
  process.env.USDG_TOKEN_ADDRESS || "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168"
);

export const ESCROW_FACTORY_ADDRESS = process.env.VEILORA_ESCROW_FACTORY_ADDRESS
  ? getAddress(process.env.VEILORA_ESCROW_FACTORY_ADDRESS)
  : undefined;

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
