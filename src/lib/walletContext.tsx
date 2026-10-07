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

export interface CreatedAccountDetails {
  address: string;
  shardA: string;
  shardB: string;
  shardC: string;
  shardAPrivateKey?: string;
  shardCPrivateKey?: string;
}

export function downloadRecoveryBackup(data: {
  smartAccount: string;
  shardA: string;
  shardB: string;
  shardC: string;
  shardCPrivateKey: string;
}) {
  const payload = {
    app: "Veilora",
    type: "2-of-3 Threshold Recovery Key",
    smartAccount: data.smartAccount,
    network: "Robinhood Chain",
    createdAt: new Date().toISOString(),
    instructions:
      "This is Shard C of your 2-of-3 threshold smart account. Store this file securely in an encrypted backup or offline vault. Never share your private key.",
    shards: {
      shardA_deviceKey: {
        role: "Primary Device Signer",
        address: data.shardA,
        storage: "Stored locally in your primary browser",
      },
      shardB_coSigner: {
        role: "Veilora HSM Guardrail",
        address: data.shardB,
        storage: "Managed by Veilora with policy safety rules",
      },
      shardC_recoveryKey: {
        role: "Offline Recovery Shard",
        address: data.shardC,
        privateKey: data.shardCPrivateKey,
        storage: "Offline backup (this file)",
      },
    },
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `veilora-recovery-${data.smartAccount.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface WalletContextType {
  walletAddress: string;
  wallet: WalletMetadata | null;
  network: NetworkInfo | null;
  loading: boolean;
  error: string | null;
  deviceKeyPresent: boolean;
  latestRecoveryKey: string | null;
  auditTrail: Array<{
    id: string;
    user_op_hash: string;
    status: string;
    created_at: string;
  }>;
  setWalletAddress: (address: string) => void;
  refresh: () => Promise<void>;
  createAccount: () => Promise<CreatedAccountDetails>;
  clearLatestRecoveryKey: () => void;
  getStoredDeviceKey: () => string | null;
  freezeAccount: (hours?: number, reason?: string) => Promise<void>;
  unfreezeAccount: () => Promise<void>;
  removeWallet: () => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [walletAddress, setWalletAddressState] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) || "";
  });
  const [wallet, setWallet] = useState<WalletMetadata | null>(null);
  const [network, setNetwork] = useState<NetworkInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [deviceKeyPresent, setDeviceKeyPresent] = useState<boolean>(() => {
    return Boolean(localStorage.getItem("veilora:shardA:privateKey"));
  });
  const [latestRecoveryKey, setLatestRecoveryKey] = useState<string | null>(null);
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
    if (!addr) {
      setWallet(null);
      setAuditTrail([]);
      setLoading(false);
      return;
    }
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

  const createAccount = async (): Promise<CreatedAccountDetails> => {
    setLoading(true);
    try {
      const res = await createWallet({});
      setWalletAddress(res.address);
      await loadWallet(res.address);

      const shardAPk = res.generatedShards?.shardA?.privateKey;
      const shardCPk = res.generatedShards?.shardC?.privateKey;

      // RULE: Only store Shard A in browser local storage.
      // NEVER store Shard C in local storage.
      if (shardAPk) {
        localStorage.setItem("veilora:shardA:privateKey", shardAPk);
        localStorage.setItem("veilora:shardA:address", res.shardA);
        setDeviceKeyPresent(true);
      }

      // Shard C is held ONLY in memory for backup download
      if (shardCPk) {
        setLatestRecoveryKey(shardCPk);
      }

      return {
        address: res.address,
        shardA: res.shardA,
        shardB: res.shardB,
        shardC: res.shardC,
        shardAPrivateKey: shardAPk,
        shardCPrivateKey: shardCPk,
      };
    } finally {
      setLoading(false);
    }
  };

  const clearLatestRecoveryKey = () => {
    setLatestRecoveryKey(null);
  };

  const getStoredDeviceKey = () => {
    return localStorage.getItem("veilora:shardA:privateKey");
  };

  const freezeAccount = async (hours = 24, reason = "Emergency freeze") => {
    await freezeWallet(walletAddress, hours, reason);
    await loadWallet(walletAddress);
  };

  const unfreezeAccount = async () => {
    await unfreezeWallet(walletAddress);
    await loadWallet(walletAddress);
  };

  const removeWallet = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("veilora:shardA:privateKey");
    localStorage.removeItem("veilora:shardA:address");
    localStorage.removeItem("veilora:onboarded");
    localStorage.removeItem("veilora:notes");
    setWalletAddressState("");
    setWallet(null);
    setDeviceKeyPresent(false);
    setLatestRecoveryKey(null);
    setAuditTrail([]);
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
        deviceKeyPresent,
        latestRecoveryKey,
        setWalletAddress,
        refresh,
        createAccount,
        clearLatestRecoveryKey,
        getStoredDeviceKey,
        freezeAccount,
        unfreezeAccount,
        removeWallet,
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
