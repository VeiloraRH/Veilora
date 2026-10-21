import { useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, Bot, Check, History, KeyRound, LoaderCircle, MessageSquare, Plus, Send, Settings2, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
import { getAddress, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { motion, useReducedMotion } from "framer-motion";
import { askVeily, createVeilyPermission, listVeilyPermissions, revokeVeilyPermission, type VeilyAction, type VeilyMessage, type VeilyMode, type VeilyProvider, type VeilySessionPermission } from "@/lib/api";
import { encryptDeviceKey, decryptDeviceKey } from "@/lib/deviceKeyVault";
import { useWallet } from "@/lib/walletContext";
import { useHoldings } from "@/lib/walletQueries";
import { downloadReceipt, type VeilyReceipt } from "@/lib/veilyReceipt";
import { getWalletContacts, labelAddresses, substituteContactNames } from "@/lib/contacts";
import { VeilyReceiptPanel } from "./VeilyReceiptPanel";
import { VeilyAddressCheck, addressIn } from "./VeilyAddressCheck";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const KEY_PREFIX = "veilora:veily:credential:";
const HISTORY_PREFIX = "veilora:veily:history:";
const MAX_CONVERSATIONS = 40;
const DEFAULT_MODE: VeilyMode = "hosted";
const models: Record<VeilyProvider, string> = { groq: "qwen/qwen3.8-27b", openai: "gpt-4o-mini", anthropic: "claude-3-5-haiku-latest" };
const bridgeChainNames: Record<number, string> = { 1: "Ethereum", 56: "BNB Chain", 137: "Polygon", 8453: "Base" };
const initialMessages: VeilyMessage[] = [{ role: "assistant", content: "Hi, I’m Veily. I can help you understand your wallet and find your way around Veilora. I can’t sign or execute transactions for you." }];
type VeilyConversation = { id: string; title: string; updatedAt: number; permissionId: string | null; messages: VeilyMessage[] };
const VeilyMarkdown = lazy(() => import("./VeilyMarkdown").then(module => ({ default: module.VeilyMarkdown })));

function readConversations(address: string): VeilyConversation[] {
  try {
    const value = JSON.parse(localStorage.getItem(`${HISTORY_PREFIX}${address.toLowerCase()}`) || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is VeilyConversation => item && typeof item.id === "string" && typeof item.title === "string" &&
      typeof item.updatedAt === "number" && (item.permissionId === null || typeof item.permissionId === "string") &&
      Array.isArray(item.messages) && item.messages.every((message: unknown) => {
        const entry = message as VeilyMessage;
        return entry && (entry.role === "user" || entry.role === "assistant") && typeof entry.content === "string" && entry.content.length <= 12000;
      })).slice(0, MAX_CONVERSATIONS);
  } catch { return []; }
}

export function VeilyAssistant() {
  const { walletAddress, wallet, getStoredDeviceKey } = useWallet();
  const navigate = useNavigate();
  const reduceMotion = Boolean(useReducedMotion());
  const holdings = useHoldings();
  const storageKey = `${KEY_PREFIX}${walletAddress.toLowerCase()}`;
  const [historyAddress, setHistoryAddress] = useState(walletAddress.toLowerCase());
  const [conversations, setConversations] = useState<VeilyConversation[]>(() => readConversations(walletAddress));
  const [activeConversationId, setActiveConversationId] = useState(() => readConversations(walletAddress)[0]?.id ?? "");
  const [historyOpen, setHistoryOpen] = useState(false);
  const readSavedCredential = () => {
    try { return JSON.parse(localStorage.getItem(storageKey) || "null") as { provider: VeilyProvider; model: string; encryptedKey: string } | null; }
    catch { return null; }
  };
  const [saved, setSaved] = useState(readSavedCredential);
  const [mode, setMode] = useState<VeilyMode>(DEFAULT_MODE);
  const [provider, setProvider] = useState<VeilyProvider>(saved?.provider ?? "groq");
  const [model, setModel] = useState(saved?.model ?? models.groq);
  const [apiKey, setApiKey] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [credentialNotice, setCredentialNotice] = useState("");
  const [messages, setMessages] = useState<VeilyMessage[]>(initialMessages);
  const [receiptView, setReceiptView] = useState<VeilyReceipt | null>(null);
  // Contact names are added on this device only; they are never sent to the AI provider.
  const contacts = useMemo(() => getWalletContacts(walletAddress), [walletAddress, messages]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [permissions, setPermissions] = useState<VeilySessionPermission[]>([]);
  const [activePermissionId, setActivePermissionId] = useState("");
  const [permissionPurpose, setPermissionPurpose] = useState("");
  const [permissionDuration, setPermissionDuration] = useState(60);
  const [permissionScopes, setPermissionScopes] = useState<VeilySessionPermission["scopes"]>(["wallet:read"]);
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [permissionNotice, setPermissionNotice] = useState("");
  const sessionPermission = permissions.find(p => p.id === activePermissionId && p.status === "active" && Date.parse(p.expires_at) > Date.now()) ?? null;
  const activeConversation = conversations.find(conversation => conversation.id === activeConversationId) ?? null;
  const conversationCanContinue = (activeConversation?.permissionId ?? null) === (sessionPermission?.id ?? null);
  useEffect(() => { setSaved(readSavedCredential()); setApiKey(""); }, [storageKey]);
  useEffect(() => {
    const address = walletAddress.toLowerCase();
    const next = readConversations(address);
    setHistoryAddress(address);
    setConversations(next);
    setActiveConversationId(next[0]?.id ?? "");
    setMessages(next[0]?.messages ?? initialMessages);
    setHistoryOpen(false);
  }, [walletAddress]);
  useEffect(() => {
    const onUniversalSearchPrompt = (event: Event) => {
      const prompt = (event as CustomEvent<{ prompt?: unknown }>).detail?.prompt;
      if (typeof prompt !== "string" || !prompt.trim()) return;
      setSettingsOpen(false);
      setHistoryOpen(false);
      setDraft(prompt.trim());
      setError("");
      setPanelOpen(true);
    };
    window.addEventListener("veilora:veily-prompt", onUniversalSearchPrompt);
    return () => window.removeEventListener("veilora:veily-prompt", onUniversalSearchPrompt);
  }, []);
  useEffect(() => {
    try { localStorage.setItem(`${HISTORY_PREFIX}${historyAddress}`, JSON.stringify(conversations.slice(0, MAX_CONVERSATIONS))); }
    catch { /* Conversation history is a convenience; chat still works when storage is unavailable. */ }
  }, [conversations, historyAddress]);
  useEffect(() => {
    setPermissions([]);
    setActivePermissionId("");
    setMessages(initialMessages);
    setPermissionNotice("");
  }, [walletAddress]);

  async function signPermissionMessage(message: string) {
    const shardA = getStoredDeviceKey();
    if (!shardA) throw new Error("Unlock Shard A before changing Veily permissions.");
    return privateKeyToAccount(shardA as `0x${string}`).signMessage({ message });
  }

  useEffect(() => {
    if (!settingsOpen) return;
    let cancelled = false;
    void (async () => {
      try {
        const timestamp = Math.floor(Date.now() / 1000);
        const requestId = crypto.randomUUID();
        const address = getAddress(walletAddress);
        const body = { walletAddress: address, requestId, timestamp };
        const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(body))));
        const hash = Array.from(digest, b => b.toString(16).padStart(2, "0")).join("");
        const shardASignature = await signPermissionMessage(`Veily permissions list\nwallet:${address}\ntimestamp:${timestamp}\nrequest:${requestId}\npayload:${hash}`);
        const result = await listVeilyPermissions({ ...body, shardASignature });
        if (!cancelled) setPermissions(result.permissions);
      } catch (e) {
        if (!cancelled) setPermissionNotice(e instanceof Error ? e.message : "Could not load Veily permissions.");
      }
    })();
    return () => { cancelled = true; };
  }, [settingsOpen, walletAddress]);

  const walletContext = useMemo(() => {
    const assets = (holdings.data ?? []).map(({ token, raw, error: failed }) =>
      `${token.symbol}: ${failed || raw === null ? "unavailable" : formatUnits(raw, token.decimals)}`,
    ).join("\n");
    return `Live balances on Robinhood Chain (raw token amounts, not USD values):\n${assets || "Balances are loading or unavailable."}`;
  }, [holdings.data]);

  function startConversation(permissionId: string | null = sessionPermission?.id ?? null) {
    const conversation: VeilyConversation = { id: crypto.randomUUID(), title: "New conversation", updatedAt: Date.now(), permissionId, messages: initialMessages };
    setConversations(current => [conversation, ...current].slice(0, MAX_CONVERSATIONS));
    setActiveConversationId(conversation.id);
    setMessages(initialMessages);
    setHistoryOpen(false);
    setError("");
  }

  function selectConversation(conversation: VeilyConversation) {
    setActiveConversationId(conversation.id);
    setMessages(conversation.messages);
    setHistoryOpen(false);
    setError("");
  }

  function updateConversation(conversationId: string, permissionId: string | null, nextMessages: VeilyMessage[]) {
    setConversations(current => {
      const existing = current.find(conversation => conversation.id === conversationId);
      const first = nextMessages.find(message => message.role === "user");
      const firstUserMessage = (first?.display ?? first?.content)?.trim();
      const title = existing?.title !== "New conversation" ? existing?.title : firstUserMessage?.slice(0, 48) || "New conversation";
      const updated: VeilyConversation = { id: conversationId, title: title ?? "New conversation", updatedAt: Date.now(), permissionId, messages: nextMessages.slice(-24) };
      return [updated, ...current.filter(conversation => conversation.id !== conversationId)].slice(0, MAX_CONVERSATIONS);
    });
  }

  function deleteConversation(conversationId: string) {
    const remaining = conversations.filter(conversation => conversation.id !== conversationId);
    setConversations(remaining);
    if (activeConversationId === conversationId) {
      setActiveConversationId(remaining[0]?.id ?? "");
      setMessages(remaining[0]?.messages ?? initialMessages);
    }
  }

  async function saveCredential() {
    setCredentialNotice("");
    try {
      if (!apiKey.trim()) throw new Error("Enter the provider API key first.");
      if (passphrase.length < 12) throw new Error("Enter your device passphrase (at least 12 characters).");
      const encryptedKey = await encryptDeviceKey(apiKey.trim(), passphrase);
      const record = { provider, model: model.trim(), encryptedKey };
      localStorage.setItem(storageKey, JSON.stringify(record));
      setSaved(record);
      setPassphrase("");
      setCredentialNotice("Provider key encrypted and saved on this device.");
    } catch (e) { setCredentialNotice(e instanceof Error ? e.message : "Could not save the provider key."); }
  }

  async function unlockCredential() {
    setCredentialNotice("");
    try {
      if (!saved) throw new Error("No encrypted provider key is saved for this wallet on this device.");
      if (!passphrase) throw new Error("Enter your device passphrase.");
      setApiKey(await decryptDeviceKey(saved.encryptedKey, passphrase));
      setProvider(saved.provider); setModel(saved.model); setCredentialNotice("Provider key unlocked in memory for this session."); setPassphrase("");
    } catch (e) { setCredentialNotice(e instanceof Error ? e.message : "Could not unlock the provider key."); }
  }

  function clearCredential() {
    localStorage.removeItem(storageKey); setSaved(null); setApiKey(""); setPassphrase(""); setCredentialNotice("Encrypted provider key removed from this device.");
  }

  async function grantPermission(event: React.FormEvent) {
    event.preventDefault();
    setPermissionNotice("");
    setPermissionBusy(true);
    try {
      const shardA = getStoredDeviceKey();
      if (!shardA || !wallet) throw new Error("Unlock Shard A before granting Veily access.");
      const timestamp = Math.floor(Date.now() / 1000);
      const requestId = crypto.randomUUID();
      const normalizedScopes = [...permissionScopes].sort() as VeilySessionPermission["scopes"];
      const expiresAt = new Date(Date.now() + permissionDuration * 60_000).toISOString();
      const purpose = permissionPurpose.trim();
      if (purpose.length < 3) throw new Error("Describe what you want Veily to help with.");
      const address = getAddress(walletAddress);
      const message = `Veilora Veily session permission\nchain:4663\nwallet:${address}\ntimestamp:${timestamp}\nrequest:${requestId}\npurpose:${purpose}\nscopes:${normalizedScopes.join(",")}\nexpires:${expiresAt}`;
      const shardASignature = await privateKeyToAccount(shardA as `0x${string}`).signMessage({ message });
      const result = await createVeilyPermission({ walletAddress: address, requestId, timestamp, purpose, requestedScopes: normalizedScopes, expiresAt, shardASignature });
      setPermissions(current => [result.permission, ...current]);
      setActivePermissionId(result.permission.id);
      setPermissionPurpose("");
      startConversation(result.permission.id);
      setPermissionNotice("Permission granted. Veily can use only the selected tools until it expires or you revoke it.");
    } catch (e) { setPermissionNotice(e instanceof Error ? e.message : "Could not grant Veily permission."); }
    finally { setPermissionBusy(false); }
  }

  async function revokePermission(permissionId: string) {
    setPermissionNotice("");
    setPermissionBusy(true);
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const requestId = crypto.randomUUID();
      const address = getAddress(walletAddress);
      const message = `Veilora Veily permission revocation\nchain:4663\nwallet:${address}\npermission:${permissionId}\ntimestamp:${timestamp}\nrequest:${requestId}`;
      const shardASignature = await signPermissionMessage(message);
      const result = await revokeVeilyPermission(permissionId, { walletAddress: address, requestId, timestamp, shardASignature });
      setPermissions(current => current.map(p => p.id === permissionId ? result.permission : p));
      if (activePermissionId === permissionId) {
        setActivePermissionId("");
        startConversation(null);
      }
      setPermissionNotice("Permission revoked. New Veily requests can no longer use it.");
    } catch (e) { setPermissionNotice(e instanceof Error ? e.message : "Could not revoke this permission."); }
    finally { setPermissionBusy(false); }
  }

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    const permission = permissions.find(p => p.id === activePermissionId && p.status === "active" && Date.parse(p.expires_at) > Date.now()) ?? null;
    if (activePermissionId && !permission) setActivePermissionId("");
    const shardA = getStoredDeviceKey();
    if (!shardA || !wallet || !wallet.shardA) { setError("Unlock the wallet's Shard A key before using Veily."); return; }
    if (mode === "byok" && !apiKey) { setSettingsOpen(true); setError("Unlock or enter your provider key in Veily settings first."); return; }
    const permissionKey = permission?.id ?? null;
    const canContinue = activeConversation && activeConversation.permissionId === permissionKey;
    const conversationId = canContinue ? activeConversation.id : crypto.randomUUID();
    const conversation = canContinue ? messages : initialMessages;
    if (!canContinue) {
      const fresh: VeilyConversation = { id: conversationId, title: "New conversation", updatedAt: Date.now(), permissionId: permissionKey, messages: initialMessages };
      setConversations(current => [fresh, ...current].slice(0, MAX_CONVERSATIONS));
      setActiveConversationId(conversationId);
    }
    // Contact names stay on this device: Veily receives their addresses instead.
    const outgoing = substituteContactNames(text, getWalletContacts(walletAddress));
    const userMessage: VeilyMessage = { role: "user", content: outgoing, ...(outgoing !== text ? { display: text } : {}) };
    const next: VeilyMessage[] = [...conversation, userMessage].slice(-24);
    setMessages(next);
    updateConversation(conversationId, permissionKey, next);
    const payload: Omit<Parameters<typeof askVeily>[0], "shardASignature"> = {
      walletAddress: getAddress(walletAddress), requestId: crypto.randomUUID(), timestamp: Math.floor(Date.now() / 1000),
      ...(permission ? { permissionId: permission.id } : {}),
      mode, messages: next.map(({ receipt: _receipt, display: _display, ...m }) => m), context: permission?.scopes.includes("wallet:read") ? walletContext : "",
      ...(mode === "byok" ? { provider, model: model.trim(), apiKey } : {}),
    };
    const canonical = JSON.stringify(payload);
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical)));
    const hash = Array.from(digest, b => b.toString(16).padStart(2, "0")).join("");
    const signedMessage = `Veily request\nwallet:${getAddress(walletAddress)}\ntimestamp:${payload.timestamp}\nrequest:${payload.requestId}\npayload:${hash}`;
    const shardASignature = await privateKeyToAccount(shardA as `0x${string}`).signMessage({ message: signedMessage });
    setDraft(""); setBusy(true); setError("");
    try {
      const result = await askVeily({ ...payload, shardASignature });
      const completed = [...next, { role: "assistant" as const, content: result.answer || "I couldn't form a response. Please try again.", actions: result.actions ?? [], ...(result.receipt ? { receipt: result.receipt } : {}) }];
      setMessages(completed);
      updateConversation(conversationId, permissionKey, completed);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Veily could not respond.";
      if (/permission.*(?:revoked|expired)/i.test(message)) {
        setActivePermissionId("");
        setMessages(initialMessages);
        startConversation(null);
      } else { setMessages(messages); updateConversation(conversationId, permissionKey, messages); }
      setDraft(text);
      setError(message);
    } finally { setBusy(false); }
  }

  const activePermissions = permissions.filter(p => p.status === "active" && Date.parse(p.expires_at) > Date.now());
  const scopeOptions = [["wallet:read", "Wallet balances & spending limits"], ["activity:read", "Activity history, totals & transaction details"], ["navigation:prepare", "Open screens & prepare swaps or bridge drafts"]] as const;
  const shortcuts = ["What can I spend today?", "Show my recent activity", "Find NVDA"];

  function openAction(action: VeilyAction) {
    if (action.screen === "dashboard") void navigate({ to: "/app" });
    else if (action.screen === "market") void navigate({ to: "/app/market", search: { q: "" } });
    else if (action.screen === "swap") void navigate({ to: "/app/swap", search: { buy: action.token ?? "NVDA" } });
    else if (action.screen === "bridge") void navigate({ to: "/app/bridge", search: { sourceAsset: action.sourceAsset, destinationChainId: action.destinationChainId, destinationSymbol: action.destinationAsset, amount: action.amount, recipient: action.recipient } });
    else if (action.screen === "history") void navigate({ to: "/app/activity", search: action.query ? { q: action.query } : {} });
    else if (action.screen === "security") void navigate({ to: "/app/security" });
    else void navigate({ to: "/app/rules" });
  }

  return <div className="veily-dock fixed bottom-24 right-4 z-[80] sm:bottom-6 sm:right-6">
    {panelOpen && <motion.section initial={reduceMotion?false:{opacity:0,y:14,scale:.97}} animate={{opacity:1,y:0,scale:1}} exit={reduceMotion?{}:{opacity:0,y:12,scale:.98}} transition={{duration:reduceMotion?0:.18}} aria-label="Veily assistant" className="wallet-panel absolute bottom-16 right-0 flex h-[min(78vh,700px)] w-[min(94vw,440px)] flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl dark:border-ink-700 dark:bg-ink-900">
      <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-ink-700">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#f0ac5e]/15 text-[#bb762e]"><Sparkles size={18}/></span>
        <div className="min-w-0 flex-1"><h2 className="text-sm font-semibold text-slate-900 dark:text-cream">{settingsOpen ? "Veily settings" : historyOpen ? "Your conversations" : "Veily"}</h2><p className="truncate text-[11px] text-slate-500 dark:text-mist">{settingsOpen ? "Choose how Veily works for you" : historyOpen ? "Saved on this device for this wallet" : mode === "hosted" ? "Hosted testing mode" : `${provider} · your own key`}</p></div>
        {(settingsOpen || historyOpen) && <button className="wallet-icon-button !h-9 !w-9" aria-label="Back to conversation" onClick={()=>{setSettingsOpen(false);setHistoryOpen(false);}}><ArrowLeft size={17}/></button>}
        {!settingsOpen&&!historyOpen&&<><button className="wallet-icon-button !h-9 !w-9" aria-label="Conversation history" onClick={()=>{setHistoryOpen(true);setSettingsOpen(false);}}><History size={17}/></button><button className="wallet-icon-button !h-9 !w-9" aria-label="Start new conversation" onClick={()=>startConversation()}><Plus size={18}/></button><button className="wallet-icon-button !h-9 !w-9" aria-label="Veily settings" onClick={()=>{setSettingsOpen(true);setHistoryOpen(false);}}><Settings2 size={17}/></button></>}
        <button className="wallet-icon-button !h-9 !w-9" aria-label="Close Veily" onClick={()=>setPanelOpen(false)}><X size={17}/></button>
      </header>

      {settingsOpen ? <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <section className="rounded-2xl border border-slate-200 p-4 dark:border-ink-700">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-mist">AI mode</p>
          <div className="grid grid-cols-2 gap-2">
            {([ ["hosted", "Hosted testing", "Use Veilora’s hosted model"], ["byok", "Your own key", "Connect your AI provider"] ] as const).map(([value,title,description])=><button key={value} type="button" onClick={()=>{setMode(value);setError("");}} className={`rounded-xl border p-3 text-left ${mode===value?"border-[#f0ac5e] bg-[#f0ac5e]/10":"border-slate-200 dark:border-ink-700"}`}><strong className="block text-xs font-semibold">{title}</strong><span className="mt-1 block text-[10px] leading-relaxed text-slate-500 dark:text-mist">{description}</span></button>)}
          </div>
        </section>

        {mode === "byok" && <section className="rounded-2xl border border-slate-200 p-4 dark:border-ink-700">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold"><KeyRound size={15}/>Provider connection</div>
          <div className="grid gap-2">
            <select aria-label="AI provider" className="wallet-select w-full" value={provider} onChange={e=>{const p=e.target.value as VeilyProvider;setProvider(p);setModel(models[p]);}}><option value="groq">Groq</option><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option></select>
            <input className="wallet-select w-full" aria-label="AI model" value={model} onChange={e=>setModel(e.target.value)} placeholder="Model ID"/>
            <input className="wallet-select w-full" aria-label="Provider API key" type="password" autoComplete="off" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder={saved?"Provider key unlocked for this session":"Provider API key"}/>
            <input className="wallet-select w-full" aria-label="Device passphrase" type="password" autoComplete="current-password" value={passphrase} onChange={e=>setPassphrase(e.target.value)} placeholder="Device passphrase"/>
          </div>
          <div className="mt-3 flex flex-wrap gap-2"><button className="wallet-soft-button" onClick={()=>void saveCredential()}>Encrypt and save</button>{saved&&<button className="wallet-soft-button" onClick={()=>void unlockCredential()}>Unlock saved key</button>}{saved&&<button className="wallet-soft-button text-rose-600" onClick={clearCredential}>Remove key</button>}</div>
          {credentialNotice&&<p role="status" className="mt-2 text-[11px] text-slate-600 dark:text-mist">{credentialNotice}</p>}
          <details className="mt-3 text-[11px] leading-relaxed text-slate-500 dark:text-mist"><summary className="cursor-pointer font-medium">How your key and chats are handled</summary><p className="mt-2">Your key is encrypted in this browser using your device passphrase. During a chat, the decrypted key and prompt pass through Veilora’s backend to your provider over HTTPS. Veilora does not save the key or conversation on its server. Conversation history stays in this browser and is removed when you disconnect this wallet.</p></details>
        </section>}

        <section className="rounded-2xl border border-slate-200 p-4 dark:border-ink-700">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold"><ShieldCheck size={15}/>Wallet access</div>
          <p className="mb-3 text-[11px] leading-relaxed text-slate-500 dark:text-mist">Grant only the tools needed for one task. Access expires within 24 hours and can be revoked. Veily cannot sign or execute transactions.</p>
          <form onSubmit={grantPermission} className="grid gap-2">
            <input className="wallet-select w-full" aria-label="Permission purpose" value={permissionPurpose} onChange={e=>setPermissionPurpose(e.target.value)} maxLength={120} placeholder="What should Veily help with?"/>
            {scopeOptions.map(([scope,label])=><label key={scope} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-[11px] dark:border-ink-700"><input type="checkbox" checked={permissionScopes.includes(scope)} onChange={e=>setPermissionScopes(current=>e.target.checked?[...new Set([...current,scope])]:current.filter(item=>item!==scope))}/>{label}</label>)}
            <div className="flex items-center gap-2"><select aria-label="Permission duration" className="wallet-select" value={permissionDuration} onChange={e=>setPermissionDuration(Number(e.target.value))}><option value={15}>15 minutes</option><option value={60}>1 hour</option><option value={240}>4 hours</option><option value={1440}>24 hours</option></select><button className="wallet-primary-button !w-auto !px-4" disabled={permissionBusy||permissionScopes.length===0}><Check size={14}/>Grant access</button></div>
          </form>
          {permissionNotice&&<p role="status" className="mt-2 text-[11px] text-slate-600 dark:text-mist">{permissionNotice}</p>}
          <div className="mt-3 space-y-2">{activePermissions.length===0?<p className="text-[11px] text-slate-500 dark:text-mist">No active wallet access. Asset search is available without a grant.</p>:activePermissions.map(permission=><div key={permission.id} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 dark:bg-ink-800"><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{permission.purpose}</p><p className="mt-1 truncate text-[10px] text-slate-500 dark:text-mist">{permission.scopes.join(" · ")} · expires {new Date(permission.expires_at).toLocaleTimeString()}</p></div>{activePermissionId===permission.id?<span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300">In use</span>:<button className="wallet-soft-button !px-2 !py-1" onClick={()=>{setActivePermissionId(permission.id);setMessages(initialMessages);}}>Use</button>}<button className="wallet-soft-button !px-2 !py-1 text-rose-600" disabled={permissionBusy} onClick={()=>void revokePermission(permission.id)}>Revoke</button></div>)}</div>
        </section>
      </div> : historyOpen ? <div className="flex-1 overflow-y-auto p-4">
        <p className="mb-3 text-[11px] text-slate-500 dark:text-mist">Conversation history is saved on this device for this wallet.</p>
        {conversations.length===0?<div className="rounded-2xl bg-slate-50 p-6 text-center text-xs text-slate-500 dark:bg-ink-850 dark:text-mist">No conversations yet.</div>:<div className="space-y-2">{conversations.map(conversation=><div key={conversation.id} className={`flex items-center gap-2 rounded-xl border p-3 ${activeConversationId===conversation.id?"border-[#f0ac5e] bg-[#f0ac5e]/10":"border-slate-200 dark:border-ink-700"}`}><button className="min-w-0 flex-1 text-left" onClick={()=>selectConversation(conversation)}><span className="block truncate text-xs font-medium">{conversation.title}</span><span className="mt-1 block text-[10px] text-slate-500 dark:text-mist">{new Date(conversation.updatedAt).toLocaleString()} · {conversation.permissionId?"temporary access":"no wallet access"}</span></button><button className="wallet-icon-button !h-8 !w-8 text-slate-500 hover:text-rose-600" aria-label={`Delete ${conversation.title}`} onClick={()=>deleteConversation(conversation.id)}><Trash2 size={14}/></button></div>)}</div>}
      </div> : <>
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5 text-[10px] text-slate-500 dark:border-ink-700 dark:text-mist"><span className={`h-1.5 w-1.5 rounded-full ${sessionPermission?"bg-emerald-500":"bg-slate-400"}`}/><span className="truncate">{sessionPermission?`${sessionPermission.purpose} · access expires ${new Date(sessionPermission.expires_at).toLocaleTimeString()}`:"Wallet tools off · grant temporary access in settings"}</span></div>
        {activeConversation&&!conversationCanContinue&&<p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-[10px] text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">This conversation used a different or expired permission. Your next message starts fresh.</p>}
        <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
          {messages.length===1&&<div className="mb-5 mt-4"><p className="mb-1 text-lg font-medium text-slate-900 dark:text-cream">What can I help with?</p><p className="mb-4 text-xs leading-relaxed text-slate-500 dark:text-mist">Ask about your wallet, activity, spending limits, or where to find something.</p><div className="flex flex-wrap gap-2">{shortcuts.map(prompt=><button key={prompt} className="rounded-full border border-slate-200 px-3 py-2 text-[10px] text-slate-600 transition-colors hover:border-[#f0ac5e] hover:bg-[#f0ac5e]/10 dark:border-ink-700 dark:text-mist" onClick={()=>setDraft(prompt)}>{prompt}</button>)}</div></div>}
          {messages.map((message,index)=><div key={`${index}-${message.role}`} className={`flex gap-2.5 ${message.role==="user"?"flex-row-reverse":""}`}><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${message.role==="assistant"?"bg-[#f0ac5e]/15 text-[#bb762e]":"bg-slate-100 text-slate-600 dark:bg-ink-800 dark:text-mist"}`}>{message.role==="assistant"?<Bot size={14}/>:<MessageSquare size={13}/>}</span><div className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${message.role==="assistant"?"bg-slate-50 text-slate-800 dark:bg-ink-850 dark:text-cream-dim":"whitespace-pre-wrap bg-[#f0ac5e]/15 text-slate-900 dark:text-cream"}`}>{message.role==="assistant"?<Suspense fallback={<span className="whitespace-pre-wrap">{labelAddresses(message.content, contacts)}</span>}><VeilyMarkdown content={labelAddresses(message.content, contacts)}/></Suspense>:(message.display??message.content)}{message.actions?.map((action,actionIndex)=><button key={`${action.screen}-${actionIndex}`} className="wallet-soft-button mt-2 mr-2" onClick={()=>openAction(action)}>{action.screen==="bridge"?`Prepare bridge${action.amount?` · ${action.amount} ${action.sourceAsset??"ETH"}`:""}${action.destinationChainId?` to ${bridgeChainNames[action.destinationChainId]??"destination"}`:""}${action.destinationAsset?` · ${action.destinationAsset}`:""}`:`Open ${action.screen}${action.token?` · ${action.token}`:""}${action.query?` · “${labelAddresses(action.query, contacts)}”`:""}`}<ArrowUpRight size={13}/></button>)}{message.role==="assistant"&&index>0&&messages[index-1].role==="user"&&addressIn(messages[index-1].content)&&<VeilyAddressCheck address={addressIn(messages[index-1].content)!}/>}{message.receipt&&<button className="mt-2 flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-800 dark:text-mist dark:hover:text-cream" onClick={()=>setReceiptView(message.receipt!)}><ShieldCheck size={12}/>Answer receipt</button>}</div></div>)}
          {busy&&<div className="flex items-center gap-2 text-xs text-slate-500 dark:text-mist"><LoaderCircle className="animate-spin" size={15}/>Checking that with Veily…</div>}
        </div>
        {error&&<p role="alert" className="px-4 pb-2 text-xs text-rose-600">{error}</p>}
        <form onSubmit={sendMessage} className="flex items-end gap-2 border-t border-slate-200 p-3 dark:border-ink-700"><textarea aria-label="Message Veily" rows={1} maxLength={4000} className="min-h-11 flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-xs outline-none focus:border-[#f0ac5e] dark:border-ink-700 dark:bg-ink-900 dark:text-cream" placeholder="Ask Veily anything…" value={draft} onChange={e=>setDraft(e.target.value)}/><button className="wallet-primary-button !h-11 !w-11 !px-0" aria-label="Send message" disabled={busy||!draft.trim()}><Send size={16}/></button></form>
        <p className="px-4 pb-2 text-[9px] text-slate-400 dark:text-mist">Veily can prepare and explain. Only you authorize transactions.</p>
      </>}
    </motion.section>}
    <motion.button type="button" whileTap={reduceMotion?undefined:{scale:.92}} onClick={()=>setPanelOpen(v=>!v)} aria-label={panelOpen?"Close Veily assistant":"Open Veily assistant"} aria-expanded={panelOpen} className="flex items-center gap-2 rounded-full bg-[#f0ac5e] px-4 py-3 text-sm font-semibold text-ink-900 shadow-xl ring-1 ring-black/5 transition-colors hover:bg-[#e99a46] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f0ac5e] focus-visible:ring-offset-2"><Sparkles size={18}/><span>{panelOpen?"Close":"Ask Veily"}</span></motion.button>
    <Dialog open={!!receiptView} onOpenChange={open => { if (!open) setReceiptView(null); }}>
      <DialogContent className="wallet-dialog sm:max-w-md">
        <DialogHeader><DialogTitle>Answer receipt</DialogTitle><DialogDescription>Signed by Veilora when this answer was returned, and checked again on this device.</DialogDescription></DialogHeader>
        {receiptView && <>
          <VeilyReceiptPanel receipt={receiptView}/>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="wallet-soft-button" onClick={() => void navigator.clipboard.writeText(JSON.stringify(receiptView, null, 2))}>Copy receipt</button>
            <button type="button" className="wallet-soft-button" onClick={() => downloadReceipt(receiptView)}>Download</button>
            <a className="wallet-soft-button" href="/verify-receipt" target="_blank" rel="noreferrer">Open the verifier</a>
          </div>
        </>}
      </DialogContent>
    </Dialog>
  </div>;
}
