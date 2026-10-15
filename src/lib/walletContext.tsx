import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import {
  getWallet,
  createWallet,
  freezeWallet,
  getWalletAudit,
  deleteWalletData,
  type WalletMetadata,
} from "./api";
import { decryptDeviceKey, encryptDeviceKey } from "./deviceKeyVault";
import { getAutoLockSettings, lockDue, type LockReason } from "./autoLock";
import { removePasskeyRecord, unlockWithPasskey } from "./passkeyUnlock";
import { clearWatchList } from "./watchList";
import { clearBlockedAddresses } from "./addressBlocklist";
import { clearBridgeNotifications } from "./bridgeTracking";
import { generatePrivateKey, privateKeyToAddress, privateKeyToAccount } from "viem/accounts";
import { getAddress } from "viem";

const STORAGE_KEY = "veilora:wallet_address";
const ACCOUNT_VERSION_KEY = (address: string) => `veilora:account-version:${address.toLowerCase()}`;
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
  completeAccountCreation: () => Promise<void>;
  unlockDeviceKey: (passphrase: string) => Promise<void>;
  /** Unlock with Face ID / Touch ID, if set up in this browser. */
  unlockDeviceKeyWithPasskey: () => Promise<void>;
  importDeviceKey: (privateKey: string, passphrase: string, expectedAddress?: string) => Promise<void>;
  connectExistingWallet: (address: string, privateKey: string, passphrase: string) => Promise<void>;
  deviceKeyUnlocked: boolean;
  /** Why the device key was last locked, for the unlock screen. */
  lockReason: LockReason | null;
  lockDeviceKey: (reason?: LockReason) => void;
  clearLatestRecoveryKey: () => void;
  getStoredDeviceKey: () => string | null;
  freezeAccount: (hours?: number, reason?: string) => Promise<void>;
  removeWallet: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [walletAddress, setWalletAddressState] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) || "";
  });
  const [wallet, setWallet] = useState<WalletMetadata | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [deviceKeyPresent, setDeviceKeyPresent] = useState<boolean>(() => {
    return Boolean(localStorage.getItem(ENCRYPTED_DEVICE_KEY) || localStorage.getItem(LEGACY_DEVICE_KEY));
  });
  const [deviceKey, setDeviceKey] = useState<string | null>(null);
  const [deviceKeyUnlocked, setDeviceKeyUnlocked] = useState(false);
  const [lockReason, setLockReason] = useState<LockReason | null>(null);
  const [latestRecoveryKey, setLatestRecoveryKey] = useState<string | null>(null);
  const [pendingRecoveryDetails, setPendingRecoveryDetails] = useState<CreatedAccountDetails | null>(null);
  const [pendingRegistration, setPendingRegistration] = useState<{
    shardAPk: `0x${string}`; shardCPrivateKey: `0x${string}`; shardAAddress: string; shardCAddress: string;
    requestId: string; timestamp: number; shardASignature: string;
  } | null>(null);
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
      localStorage.setItem(ACCOUNT_VERSION_KEY(addr), String(data.accountVersion ?? 1));
      const audit = deviceKey ? await getWalletAudit(addr, deviceKey as `0x${string}`).catch(() => ({ records: [] })) : { records: [] };
      setAuditTrail(audit.records || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load account");
    } finally {
      setLoading(false);
    }
  }, [deviceKey]);

  const refresh = useCallback(async () => {
    await loadWallet(walletAddress);
  }, [loadWallet, walletAddress]);

  useEffect(() => {
    loadWallet(walletAddress);
  }, [loadWallet, walletAddress]);

  const createAccount = async (passphrase: string): Promise<CreatedAccountDetails> => {
    setLoading(true);
    try {
      // Generate user-held keys on this device. Only their public addresses go to the API.
      const shardAPk = generatePrivateKey();
      const shardCPk = generatePrivateKey();
      const shardAAddress = privateKeyToAddress(shardAPk);
      const shardCAddress = privateKeyToAddress(shardCPk);
      const requestId = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
      const timestamp = Math.floor(Date.now() / 1000);
      const message = `Veilora wallet registration\nversion:2\nshardA:${getAddress(shardAAddress)}\nshardC:${getAddress(shardCAddress)}\nsalt:0\ndeploy:true\ntimestamp:${timestamp}\nrequest:${requestId}`;
      const shardASignature = await privateKeyToAccount(shardAPk).signMessage({ message });
      // Persist Shard A locally before any backend registration or deployment.
      localStorage.setItem(ENCRYPTED_DEVICE_KEY, await encryptDeviceKey(shardAPk, passphrase));
      localStorage.setItem("veilora:shardA:address", getAddress(shardAAddress));
      localStorage.removeItem(LEGACY_DEVICE_KEY);
      setDeviceKey(shardAPk);
      setDeviceKeyUnlocked(true);
    setLockReason(null);
      setDeviceKeyPresent(true);
      const details: CreatedAccountDetails = {
        address: "",
        shardA: getAddress(shardAAddress),
        shardB: "",
        shardC: getAddress(shardCAddress),
        shardAPrivateKey: shardAPk,
        shardCPrivateKey: shardCPk,
      };
      setPendingRegistration({ shardAPk, shardCPrivateKey: shardCPk, shardAAddress, shardCAddress, requestId, timestamp, shardASignature });
      setLatestRecoveryKey(shardCPk);
      setPendingRecoveryDetails(details);
      return details;
    } finally {
      setLoading(false);
    }
  };

  const completeAccountCreation = async () => {
    if (!pendingRegistration) throw new Error("The pending account setup has expired. Start account creation again.");
    if (!pendingRecoveryDetails?.shardCPrivateKey) throw new Error("The recovery key is no longer available. Start account creation again.");
    setLoading(true);
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const message = `Veilora wallet registration\nversion:2\nshardA:${getAddress(pendingRegistration.shardAAddress)}\nshardC:${getAddress(pendingRegistration.shardCAddress)}\nsalt:0\ndeploy:true\ntimestamp:${timestamp}\nrequest:${pendingRegistration.requestId}`;
      const shardASignature = await privateKeyToAccount(pendingRegistration.shardAPk).signMessage({ message });
      const pending = { ...pendingRegistration, timestamp, shardASignature };
      setPendingRegistration(pending);
      const res = await createWallet({ accountVersion: 2, shardAAddress: pending.shardAAddress, shardCAddress: pending.shardCAddress, deployOnCreate: true, requestId: pending.requestId, timestamp, shardASignature });
      localStorage.setItem("veilora:shardA:address", res.shardA);
      localStorage.setItem(ACCOUNT_VERSION_KEY(res.address), String(res.accountVersion));
      const details = { ...pendingRecoveryDetails, address: res.address, shardA: res.shardA, shardB: res.shardB, shardC: res.shardC };
      setPendingRecoveryDetails(details);
      setWalletAddress(res.address);
      await loadWallet(res.address);
    } finally {
      setLoading(false);
    }
  };

  const clearLatestRecoveryKey = () => {
    setLatestRecoveryKey(null);
    setPendingRecoveryDetails(null);
    setPendingRegistration(null);
  };

  /** Wipe the decrypted device key from memory. The encrypted copy stays on this device. */
  const lockDeviceKey = useCallback((reason: LockReason = "manual") => {
    setDeviceKey(null);
    setDeviceKeyUnlocked(false);
    setLockReason(reason);
  }, []);

  // Auto-lock: track activity only while the key is unlocked, and check often
  // enough that a laptop waking from sleep locks straight away.
  const lastActivity = useRef(Date.now());
  const hiddenSince = useRef<number | null>(null);
  useEffect(() => {
    if (!deviceKeyUnlocked) return;
    lastActivity.current = Date.now();
    hiddenSince.current = document.visibilityState === "hidden" ? Date.now() : null;
    const touch = () => { lastActivity.current = Date.now(); };
    const check = () => {
      const reason = lockDue(getAutoLockSettings(), Date.now(), lastActivity.current, hiddenSince.current);
      if (reason) lockDeviceKey(reason);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") { hiddenSince.current = Date.now(); return; }
      check();
      hiddenSince.current = null;
      touch();
    };
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    document.addEventListener("visibilitychange", onVisibility);
    const timer = window.setInterval(check, 15_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(timer);
    };
  }, [deviceKeyUnlocked, lockDeviceKey]);

  const getStoredDeviceKey = () => {
    return deviceKeyUnlocked ? deviceKey : null;
  };

  const unlockDeviceKey = async (passphrase: string) => {
    const encrypted = localStorage.getItem(ENCRYPTED_DEVICE_KEY);
    if (encrypted) {
      const privateKey = await decryptDeviceKey(encrypted, passphrase);
      setDeviceKey(privateKey);
      setDeviceKeyUnlocked(true);
    setLockReason(null);
      return;
    }
    const legacyKey = localStorage.getItem(LEGACY_DEVICE_KEY);
    if (legacyKey) {
      localStorage.setItem(ENCRYPTED_DEVICE_KEY, await encryptDeviceKey(legacyKey, passphrase));
      localStorage.removeItem(LEGACY_DEVICE_KEY);
      setDeviceKey(legacyKey);
      setDeviceKeyUnlocked(true);
    setLockReason(null);
      setDeviceKeyPresent(true);
      return;
    }
    throw new Error("No device key is stored in this browser.");
  };

  const unlockDeviceKeyWithPasskey = async () => {
    if (!walletAddress) throw new Error("No wallet is connected in this browser.");
    const privateKey = await unlockWithPasskey(walletAddress);
    const expected = wallet?.shardA || localStorage.getItem("veilora:shardA:address");
    if (expected && !deviceKeyMatchesAddress(privateKey, expected)) {
      removePasskeyRecord(walletAddress);
      throw new Error("The passkey opened a key that does not match this wallet. Unlock with your passphrase and set up Face ID / Touch ID again.");
    }
    setDeviceKey(privateKey);
    setDeviceKeyUnlocked(true);
    setLockReason(null);
  };

  const importDeviceKey = async (privateKey: string, passphrase: string, expectedAddress?: string) => {
    if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) throw new Error("Enter a valid 32-byte private key.");
    if (expectedAddress && !deviceKeyMatchesAddress(privateKey, expectedAddress)) {
      throw new Error("This key does not match the account's registered Shard A.");
    }
    localStorage.setItem(ENCRYPTED_DEVICE_KEY, await encryptDeviceKey(privateKey, passphrase));
    localStorage.removeItem(LEGACY_DEVICE_KEY);
    if (walletAddress) removePasskeyRecord(walletAddress);
    setDeviceKey(privateKey);
    setDeviceKeyUnlocked(true);
    setLockReason(null);
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
    localStorage.setItem(ACCOUNT_VERSION_KEY(metadata.address), String(metadata.accountVersion ?? 1));
    await importDeviceKey(privateKey, passphrase, metadata.shardA);
    setWalletAddress(address);
  };

  const freezeAccount = async (hours = 24, reason = "Emergency freeze") => {
    if (!wallet || !deviceKey || !deviceKeyMatchesAddress(deviceKey, wallet.shardA)) throw new Error("Unlock the matching Shard A device key first.");
    const timestamp = Math.floor(Date.now() / 1000);
    const message = `Veilora account security action\nwallet:${getAddress(walletAddress)}\naction:freeze\nhours:${hours}\nreason:${reason}\ntimestamp:${timestamp}`;
    const signature = await privateKeyToAccount(deviceKey as `0x${string}`).signMessage({ message });
    await freezeWallet(walletAddress, hours, reason, timestamp, signature);
    await loadWallet(walletAddress);
  };

  const removeWallet = async () => {
    if (!walletAddress) throw new Error("There is no connected wallet to delete.");
    const shardAPrivateKey = getStoredDeviceKey();
    if (!shardAPrivateKey) throw new Error("Unlock Shard A before deleting this wallet's server data.");

    const canonicalAddress = getAddress(walletAddress);
    const timestamp = Math.floor(Date.now() / 1000);
    const deletionMessage = `Veilora account data deletion request\nwallet:${canonicalAddress}\ntimestamp:${timestamp}`;
    const signer = privateKeyToAccount(shardAPrivateKey as `0x${string}`);
    const signature = await signer.signMessage({ message: deletionMessage });
    await deleteWalletData(canonicalAddress, timestamp, signature);

    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ACCOUNT_VERSION_KEY(walletAddress));
    localStorage.removeItem(LEGACY_DEVICE_KEY);
    localStorage.removeItem(ENCRYPTED_DEVICE_KEY);
    localStorage.removeItem("veilora:shardA:address");
    localStorage.removeItem("veilora:onboarded");
    localStorage.removeItem("veilora:notes");
    localStorage.removeItem("veilora:rpc:url");
    localStorage.removeItem("veilora:view_keys");
    localStorage.removeItem(`veilora:veily:credential:${walletAddress.toLowerCase()}`);
    localStorage.removeItem(`veilora:veily:history:${walletAddress.toLowerCase()}`);
    const bridgeTrackingKey = `veilora:bridge:tracking:${walletAddress.toLowerCase()}`;
    localStorage.removeItem(bridgeTrackingKey);
    clearBridgeNotifications(walletAddress);
    localStorage.removeItem(`veilora:contacts:${walletAddress.toLowerCase()}`);
    clearBlockedAddresses(walletAddress);
    clearWatchList(walletAddress);
    removePasskeyRecord(walletAddress);
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
        loading,
        error,
        auditTrail,
        deviceKeyPresent,
        deviceKeyUnlocked,
        lockReason,
        lockDeviceKey,
        latestRecoveryKey,
        pendingRecoveryDetails,
        setWalletAddress,
        refresh,
        createAccount,
        completeAccountCreation,
        unlockDeviceKey,
        unlockDeviceKeyWithPasskey,
        importDeviceKey,
        connectExistingWallet,
        clearLatestRecoveryKey,
        getStoredDeviceKey,
        freezeAccount,
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
