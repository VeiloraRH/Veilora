import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Bot, KeyRound, LoaderCircle, MessageSquare, Send, Settings2, Sparkles, X } from "lucide-react";
import { getAddress, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { motion, useReducedMotion } from "framer-motion";
import { askVeily, type VeilyMessage, type VeilyMode, type VeilyProvider } from "@/lib/api";
import { encryptDeviceKey, decryptDeviceKey } from "@/lib/deviceKeyVault";
import { useWallet } from "@/lib/walletContext";
import { useHoldings } from "@/lib/walletQueries";

const KEY_PREFIX = "veilora:veily:credential:";
const DEFAULT_MODE: VeilyMode = "hosted";
const models: Record<VeilyProvider, string> = { groq: "qwen/qwen3.8-27b", openai: "gpt-4o-mini", anthropic: "claude-3-5-haiku-latest" };
const initialMessages: VeilyMessage[] = [{ role: "assistant", content: "Hi, I’m Veily. I can help you understand your wallet and find your way around Veilora. I can’t sign or execute transactions for you." }];

export function VeilyAssistant() {
  const { walletAddress, wallet, getStoredDeviceKey } = useWallet();
  const navigate = useNavigate();
  const reduceMotion = Boolean(useReducedMotion());
  const holdings = useHoldings();
  const storageKey = `${KEY_PREFIX}${walletAddress.toLowerCase()}`;
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
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  useEffect(() => { setSaved(readSavedCredential()); setApiKey(""); }, [storageKey]);

  const walletContext = useMemo(() => {
    const assets = (holdings.data ?? []).map(({ token, raw, error: failed }) =>
      `${token.symbol}: ${failed || raw === null ? "unavailable" : formatUnits(raw, token.decimals)}`,
    ).join("\n");
    return `Wallet: ${walletAddress}\nNetwork: Robinhood Chain (4663)\nThreshold: 2-of-3\nBalances (live on-chain reads; values are raw token amounts, not USD prices):\n${assets || "Balances are loading or unavailable."}`;
  }, [holdings.data, walletAddress]);

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

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    const shardA = getStoredDeviceKey();
    if (!shardA || !wallet || !wallet.shardA) { setError("Unlock the wallet's Shard A key before using Veily."); return; }
    if (mode === "byok" && !apiKey) { setSettingsOpen(true); setError("Unlock or enter your provider key in Veily settings first."); return; }
    const userMessage: VeilyMessage = { role: "user", content: text };
    const next: VeilyMessage[] = [...messages, userMessage].slice(-24);
    const payload: Omit<Parameters<typeof askVeily>[0], "shardASignature"> = {
      walletAddress: getAddress(walletAddress), requestId: crypto.randomUUID(), timestamp: Math.floor(Date.now() / 1000),
      mode, messages: next, context: walletContext,
      ...(mode === "byok" ? { provider, model: model.trim(), apiKey } : {}),
    };
    const canonical = JSON.stringify(payload);
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical)));
    const hash = Array.from(digest, b => b.toString(16).padStart(2, "0")).join("");
    const signedMessage = `Veily request\nwallet:${getAddress(walletAddress)}\ntimestamp:${payload.timestamp}\nrequest:${payload.requestId}\npayload:${hash}`;
    const shardASignature = await privateKeyToAccount(shardA as `0x${string}`).signMessage({ message: signedMessage });
    setMessages(next); setDraft(""); setBusy(true); setError("");
    try {
      const result = await askVeily({ ...payload, shardASignature });
      setMessages([...next, { role: "assistant", content: result.answer || "I couldn't form a response. Please try again.", actions: result.actions ?? [] }]);
    } catch (e) {
      setMessages(messages);
      setDraft(text);
      setError(e instanceof Error ? e.message : "Veily could not respond.");
    } finally { setBusy(false); }
  }

  return <div className="fixed bottom-24 right-4 z-[80] sm:bottom-6 sm:right-6">
    {panelOpen && <motion.section initial={reduceMotion?false:{opacity:0,y:14,scale:.97}} animate={{opacity:1,y:0,scale:1}} exit={reduceMotion?{}:{opacity:0,y:12,scale:.98}} transition={{duration:reduceMotion?0:.18}} aria-label="Veily assistant" className="wallet-panel absolute bottom-16 right-0 flex h-[min(74vh,690px)] w-[min(92vw,430px)] flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl dark:border-ink-700 dark:bg-ink-900">
        <div className="flex items-center gap-3 border-b border-slate-200 p-4 dark:border-ink-700">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f0ac5e]/15 text-[#bb762e]"><Sparkles size={20}/></span>
          <div className="min-w-0 flex-1"><h2 className="font-semibold text-slate-900 dark:text-cream">Veily</h2><p className="text-xs text-slate-500 dark:text-mist">{mode === "hosted" ? "Veilora testing mode" : `${provider} · bring your own key`}</p></div>
          <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-ink-800" role="group" aria-label="Veily mode">
            <button className={`rounded-lg px-3 py-1.5 text-xs ${mode === "hosted" ? "bg-white shadow dark:bg-ink-700" : "text-slate-500 dark:text-mist"}`} onClick={() => { setMode("hosted"); setError(""); }}>Testing</button>
            <button className={`rounded-lg px-3 py-1.5 text-xs ${mode === "byok" ? "bg-white shadow dark:bg-ink-700" : "text-slate-500 dark:text-mist"}`} onClick={() => { setMode("byok"); setError(""); }}>BYOK</button>
          </div>
          <button className="wallet-icon-button !h-9 !w-9" aria-label="Veily settings" onClick={() => setSettingsOpen(v => !v)}><Settings2 size={17}/></button>
          <button className="wallet-icon-button !h-9 !w-9" aria-label="Close Veily" onClick={() => setPanelOpen(false)}><X size={17}/></button>
        </div>
        {settingsOpen && <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-5 dark:border-ink-700 dark:bg-ink-850/60">
          <div className="flex items-center gap-2 text-sm font-medium"><KeyRound size={16}/>Bring your own provider key</div>
          <p className="text-xs leading-relaxed text-slate-600 dark:text-mist">Your key is encrypted in this browser using your device passphrase. When you chat, the decrypted key and prompt travel through Veilora’s backend to the selected provider over HTTPS. Veilora does not save the key or conversation on its server.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <select aria-label="AI provider" className="wallet-select w-full" value={provider} onChange={e => { const p = e.target.value as VeilyProvider; setProvider(p); setModel(models[p]); }}><option value="groq">Groq</option><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option></select>
            <input className="wallet-select w-full" aria-label="AI model" value={model} onChange={e => setModel(e.target.value)} placeholder="Model ID"/>
            <input className="wallet-select w-full" aria-label="Provider API key" type="password" autoComplete="off" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={saved ? "Provider key (unlocked for this session)" : "Provider API key"}/>
            <input className="wallet-select w-full" aria-label="Device passphrase" type="password" autoComplete="current-password" value={passphrase} onChange={e => setPassphrase(e.target.value)} placeholder="Device passphrase"/>
          </div>
          <div className="flex flex-wrap gap-2"><button className="wallet-soft-button" onClick={() => void saveCredential()}>Encrypt and save</button>{saved&&<button className="wallet-soft-button" onClick={() => void unlockCredential()}>Unlock saved key</button>}{saved&&<button className="wallet-soft-button text-rose-600" onClick={clearCredential}>Remove saved key</button>}</div>
          {credentialNotice&&<p role="status" className="text-xs text-slate-600 dark:text-mist">{credentialNotice}</p>}
        </div>}
        <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
          {messages.map((message,index)=><div key={`${index}-${message.role}`} className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${message.role === "assistant" ? "bg-[#f0ac5e]/15 text-[#bb762e]" : "bg-slate-100 text-slate-600 dark:bg-ink-800 dark:text-mist"}`}>{message.role === "assistant"?<Bot size={16}/>:<MessageSquare size={15}/>}</span><div className={`max-w-[84%]`}><p className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${message.role === "assistant" ? "bg-slate-50 text-slate-800 dark:bg-ink-850 dark:text-cream-dim" : "bg-[#f0ac5e]/15 text-slate-900 dark:text-cream"}`}>{message.content}</p>{message.actions?.map((action,actionIndex)=><button key={`${action.screen}-${actionIndex}`} className="wallet-soft-button mt-2 mr-2" onClick={()=>{if(action.screen==="dashboard")void navigate({to:"/app"});else if(action.screen==="market")void navigate({to:"/app/market",search:{q:""}});else if(action.screen==="swap")void navigate({to:"/app/swap",search:{buy:action.token??"NVDA"}});else if(action.screen==="history")void navigate({to:"/app/activity"});else void navigate({to:"/app/rules"});}}>Open {action.screen === "history" ? "history" : action.screen}{action.token?` · ${action.token}`:""}<ArrowUpRight size={13}/></button>)}</div></div>)}
          {busy&&<div className="flex items-center gap-2 text-sm text-slate-500 dark:text-mist"><LoaderCircle className="animate-spin" size={16}/>Veily is thinking…</div>}
        </div>
        {error&&<p role="alert" className="px-5 pb-2 text-sm text-rose-600">{error}</p>}
        <form onSubmit={sendMessage} className="flex items-end gap-2 border-t border-slate-200 p-4 dark:border-ink-700"><textarea aria-label="Message Veily" rows={2} maxLength={4000} className="min-h-12 flex-1 resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#f0ac5e] dark:border-ink-700 dark:bg-ink-900 dark:text-cream" placeholder="Ask about your wallet…" value={draft} onChange={e=>setDraft(e.target.value)}/><button className="wallet-primary-button !w-auto !px-4" aria-label="Send message" disabled={busy||!draft.trim()}><Send size={17}/></button></form>
      </motion.section>}
    <motion.button type="button" whileTap={reduceMotion?undefined:{scale:.92}} onClick={() => setPanelOpen(v => !v)} aria-label={panelOpen?"Close Veily assistant":"Open Veily assistant"} aria-expanded={panelOpen} className="flex items-center gap-2 rounded-full bg-[#f0ac5e] px-4 py-3 text-sm font-semibold text-ink-900 shadow-xl ring-1 ring-black/5 transition-colors hover:bg-[#e99a46] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f0ac5e] focus-visible:ring-offset-2"><Sparkles size={18}/><span>{panelOpen?"Close":"Ask Veily"}</span></motion.button>
  </div>;
}
