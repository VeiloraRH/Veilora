import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import {
  getWallet,
  createWallet,
  freezeWallet,
  unfreezeWallet,
  getRelayerStatus,
  getWalletAudit,
  deleteWalletData,
  createShieldedNote as createShieldedNoteRequest,
  getShieldNoteCreationMessage,
  type WalletMetadata,
} from "./api";
import { decryptDeviceKey, encryptDeviceKey } from "./deviceKeyVault";
import { generatePrivateKey, privateKeyToAddress, privateKeyToAccount } from "viem/accounts";
import { getAddress } from "viem";

const STORAGE_KEY = "veilora:wallet_address";
const ENCRYPTED_DEVICE_KEY = "veilora:shardA:encrypted";
const LEGACY_DEVICE_KEY = "veilora:shardA:privateKey";

function deviceKeyMatchesAddress(privateKey: string, address: string): boolean {
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey) || !/^0x[0-9a-fA-F]{40}$/.test(address)) return false;
  try {
    return privateKeyToAddress(privateKey as `0x${string}`).toLowerCase() === getAddress(address).toLowerCase();
  } catch {
    return false;
  }
}

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

interface WalletContextType {
  walletAddress: string;
  wallet: WalletMetadata | null;
  network: NetworkInfo | null;
  loading: boolean;
  error: string | null;
  deviceKeyPresent: boolean;
  latestRecoveryKey: string | null;
  pendingRecoveryDetails: CreatedAccountDetails | null;
  auditTrail: Array<{
    id: string;
    user_op_hash: string;
    status: string;
    created_at: string;
  }>;
  setWalletAddress: (address: string) => void;
  refresh: () => Promise<void>;
  createAccount: (passphrase: string) => Promise<CreatedAccountDetails>;
  unlockDeviceKey: (passphrase: string) => Promise<void>;
  importDeviceKey: (privateKey: string, passphrase: string, expectedAddress?: string) => Promise<void>;
  connectExistingWallet: (address: string, privateKey: string, passphrase: string) => Promise<void>;
  deviceKeyUnlocked: boolean;
  clearLatestRecoveryKey: () => void;
  getStoredDeviceKey: () => string | null;
  freezeAccount: (hours?: number, reason?: string) => Promise<void>;
  unfreezeAccount: () => Promise<void>;
  removeWallet: () => Promise<void>;
  createShieldedNote: (assetSymbol: string, amountWei: string) => Promise<Awaited<ReturnType<typeof createShieldedNoteRequest>>>;
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
    return Boolean(localStorage.getItem(ENCRYPTED_DEVICE_KEY) || localStorage.getItem(LEGACY_DEVICE_KEY));
  });
  const [deviceKey, setDeviceKey] = useState<string | null>(null);
  const [deviceKeyUnlocked, setDeviceKeyUnlocked] = useState(false);
  const [latestRecoveryKey, setLatestRecoveryKey] = useState<string | null>(null);
  const [pendingRecoveryDetails, setPendingRecoveryDetails] = useState<CreatedAccountDetails | null>(null);
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

  const createAccount = async (passphrase: string): Promise<CreatedAccountDetails> => {
    setLoading(true);
    try {
      // Generate user-held keys on this device. Only their public addresses go to the API.
      const shardAPk = generatePrivateKey();
      const shardCPk = generatePrivateKey();
      const shardAAddress = privateKeyToAddress(shardAPk);
      const shardCAddress = privateKeyToAddress(shardCPk);
      const res = await createWallet({ shardAAddress, shardCAddress, deployOnCreate: true });

      localStorage.setItem(ENCRYPTED_DEVICE_KEY, await encryptDeviceKey(shardAPk, passphrase));
      localStorage.setItem("veilora:shardA:address", res.shardA);
      localStorage.removeItem(LEGACY_DEVICE_KEY);
      setDeviceKey(shardAPk);
      setDeviceKeyUnlocked(true);
      setDeviceKeyPresent(true);

      const details: CreatedAccountDetails = {
        address: res.address,
        shardA: res.shardA,
        shardB: res.shardB,
        shardC: res.shardC,
        shardAPrivateKey: shardAPk,
        shardCPrivateKey: shardCPk,
      };
      // Keep the onboarding gate active until the user acknowledges the offline recovery key.
      setLatestRecoveryKey(shardCPk);
      setPendingRecoveryDetails(details);
      setWalletAddress(res.address);
      await loadWallet(res.address);

      return details;
    } finally {
      setLoading(false);
    }
  };

  const clearLatestRecoveryKey = () => {
    setLatestRecoveryKey(null);
    setPendingRecoveryDetails(null);
  };

  const getStoredDeviceKey = () => {
    return deviceKeyUnlocked ? deviceKey : null;
  };

  const unlockDeviceKey = async (passphrase: string) => {
    const encrypted = localStorage.getItem(ENCRYPTED_DEVICE_KEY);
    if (encrypted) {
      const privateKey = await decryptDeviceKey(encrypted, passphrase);
      setDeviceKey(privateKey);
      setDeviceKeyUnlocked(true);
      return;
    }
    const legacyKey = localStorage.getItem(LEGACY_DEVICE_KEY);
    if (legacyKey) {
      localStorage.setItem(ENCRYPTED_DEVICE_KEY, await encryptDeviceKey(legacyKey, passphrase));
      localStorage.removeItem(LEGACY_DEVICE_KEY);
      setDeviceKey(legacyKey);
      setDeviceKeyUnlocked(true);
      setDeviceKeyPresent(true);
      return;
    }
    throw new Error("No device key is stored in this browser.");
  };

  const importDeviceKey = async (privateKey: string, passphrase: string, expectedAddress?: string) => {
    if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) throw new Error("Enter a valid 32-byte private key.");
    if (expectedAddress && !deviceKeyMatchesAddress(privateKey, expectedAddress)) {
      throw new Error("This key does not match the account's registered Shard A.");
    }
    localStorage.setItem(ENCRYPTED_DEVICE_KEY, await encryptDeviceKey(privateKey, passphrase));
    localStorage.removeItem(LEGACY_DEVICE_KEY);
    setDeviceKey(privateKey);
    setDeviceKeyUnlocked(true);
    setDeviceKeyPresent(true);
  };

  const connectExistingWallet = async (address: string, privateKey: string, passphrase: string) => {
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error("Enter a valid smart account address.");
    if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) throw new Error("Enter a valid 32-byte Shard A private key.");
    const metadata = await getWallet(address);
    if (metadata.address.toLowerCase() !== address.toLowerCase()) throw new Error("The backend returned a different wallet address.");
    if (!deviceKeyMatchesAddress(privateKey, metadata.shardA)) {
      throw new Error("This key does not match Shard A registered for that Veilora account.");
    }
    await importDeviceKey(privateKey, passphrase, metadata.shardA);
    setWalletAddress(address);
  };

  const freezeAccount = async (hours = 24, reason = "Emergency freeze") => {
    await freezeWallet(walletAddress, hours, reason);
    await loadWallet(walletAddress);
  };

  const unfreezeAccount = async () => {
    await unfreezeWallet(walletAddress);
    await loadWallet(walletAddress);
  };

  const createWalletOwnedShieldedNote = async (assetSymbol: string, amountWei: string) => {
    if (!walletAddress || !wallet) throw new Error("Connect a Veilora wallet before creating a shielded note.");
    const shardAPrivateKey = getStoredDeviceKey();
    if (!shardAPrivateKey || !deviceKeyMatchesAddress(shardAPrivateKey, wallet.shardA)) {
      throw new Error("Unlock the matching Shard A device key before creating a shielded note.");
    }

    const canonicalAddress = getAddress(walletAddress);
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    const creationRequestId = `0x${Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
    const message = getShieldNoteCreationMessage(canonicalAddress, assetSymbol, amountWei, creationRequestId);
    const signature = await privateKeyToAccount(shardAPrivateKey as `0x${string}`).signMessage({ message });
    return createShieldedNoteRequest(assetSymbol, amountWei, canonicalAddress, creationRequestId, signature);
  };

  const removeWallet = async () => {
    if (!walletAddress) throw new Error("There is no connected wallet to delete.");
    const shardAPrivateKey = getStoredDeviceKey();
    if (!shardAPrivateKey) throw new Error("Unlock Shard A before deleting this wallet's server data.");

    const canonicalAddress = getAddress(walletAddress);
    const deletionMessage = `Veilora account data deletion request: ${canonicalAddress}`;
    const signer = privateKeyToAccount(shardAPrivateKey as `0x${string}`);
    const signature = await signer.signMessage({ message: deletionMessage });
    await deleteWalletData(canonicalAddress, signature);

    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_DEVICE_KEY);
    localStorage.removeItem(ENCRYPTED_DEVICE_KEY);
    localStorage.removeItem("veilora:shardA:address");
    localStorage.removeItem("veilora:onboarded");
    localStorage.removeItem("veilora:notes");
    localStorage.removeItem("veilora:view_keys");
    setWalletAddressState("");
    setWallet(null);
    setDeviceKeyPresent(false);
    setDeviceKey(null);
    setDeviceKeyUnlocked(false);
    setLatestRecoveryKey(null);
    setPendingRecoveryDetails(null);
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
        deviceKeyUnlocked,
        latestRecoveryKey,
        pendingRecoveryDetails,
        setWalletAddress,
        refresh,
        createAccount,
        unlockDeviceKey,
        importDeviceKey,
        connectExistingWallet,
        clearLatestRecoveryKey,
        getStoredDeviceKey,
        freezeAccount,
        unfreezeAccount,
        removeWallet,
        createShieldedNote: createWalletOwnedShieldedNote,
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
