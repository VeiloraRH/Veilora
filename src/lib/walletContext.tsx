import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import {
  getWallet,
  createWallet,
  freezeWallet,
  unfreezeWallet,
  getRelayerStatus,
  getWalletAudit,
  type WalletMetadata,
} from "./api";

const DEFAULT_WALLET = "0x5e4ae3b279fcC9c470dF26875906D808BdE5B163";
const STORAGE_KEY = "veilora:wallet_address";

interface NetworkInfo {
  blockNumber: string;
  gasPriceGwei: string;
  relayerAddress: string | null;
  relayerReady: boolean;
  contracts: {
    factory: string;
    shieldedPool: string;
    usdgToken: string;
  };
}

interface WalletContextType {
  walletAddress: string;
  wallet: WalletMetadata | null;
  network: NetworkInfo | null;
  loading: boolean;
  error: string | null;
  auditTrail: Array<{
    id: string;
    user_op_hash: string;
    status: string;
    created_at: string;
  }>;
  setWalletAddress: (address: string) => void;
  refresh: () => Promise<void>;
  createAccount: () => Promise<{ address: string; shardA: string; shardB: string; shardC: string }>;
  freezeAccount: (hours?: number, reason?: string) => Promise<void>;
  unfreezeAccount: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [walletAddress, setWalletAddressState] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_WALLET;
  });
  const [wallet, setWallet] = useState<WalletMetadata | null>(null);
  const [network, setNetwork] = useState<NetworkInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [auditTrail, setAuditTrail] = useState<Array<{
    id: string;
    user_op_hash: string;
    status: string;
    created_at: string;
  }>>([]);

  const setWalletAddress = (addr: string) => {
    localStorage.setItem(STORAGE_KEY, addr);
    setWalletAddressState(addr);
  };

  const loadNetwork = useCallback(async () => {
    try {
      const res = await getRelayerStatus();
      setNetwork({
        blockNumber: res.network.blockNumber,
        gasPriceGwei: res.network.gasPriceGwei,
        relayerAddress: res.relayer.address,
        relayerReady: res.relayer.ready,
        contracts: res.contracts,
      });
    } catch {
      // Network status fetch fallback
    }
  }, []);

  const loadWallet = useCallback(async (addr: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getWallet(addr);
      setWallet(data);
      const audit = await getWalletAudit(addr).catch(() => ({ records: [] }));
      setAuditTrail(audit.records || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load account");
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([loadWallet(walletAddress), loadNetwork()]);
  }, [loadWallet, loadNetwork, walletAddress]);

  useEffect(() => {
    loadNetwork();
    loadWallet(walletAddress);
  }, [loadNetwork, loadWallet, walletAddress]);

  const createAccount = async () => {
    setLoading(true);
    try {
      const res = await createWallet({});
      setWalletAddress(res.address);
      await loadWallet(res.address);
      return {
        address: res.address,
        shardA: res.shardA,
        shardB: res.shardB,
        shardC: res.shardC,
      };
    } finally {
      setLoading(false);
    }
  };

  const freezeAccount = async (hours = 24, reason = "Emergency freeze") => {
    await freezeWallet(walletAddress, hours, reason);
    await loadWallet(walletAddress);
  };

  const unfreezeAccount = async () => {
    await unfreezeWallet(walletAddress);
    await loadWallet(walletAddress);
  };

  return (
    <WalletContext.Provider
      value={{
        walletAddress,
        wallet,
        network,
        loading,
        error,
        auditTrail,
        setWalletAddress,
        refresh,
        createAccount,
        freezeAccount,
        unfreezeAccount,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
