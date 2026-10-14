import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Bot, Check, Clock3, KeyRound, LoaderCircle, MessageSquare, Send, Settings2, ShieldCheck, Sparkles, X } from "lucide-react";
import { getAddress, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { motion, useReducedMotion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { askVeily, createVeilyPermission, listVeilyPermissions, revokeVeilyPermission, type VeilyMessage, type VeilyMode, type VeilyProvider, type VeilySessionPermission } from "@/lib/api";
import { encryptDeviceKey, decryptDeviceKey } from "@/lib/deviceKeyVault";
import { useWallet } from "@/lib/walletContext";
import { useHoldings } from "@/lib/walletQueries";

const KEY_PREFIX = "veilora:veily:credential:";
const DEFAULT_MODE: VeilyMode = "hosted";
const models: Record<VeilyProvider, string> = { groq: "qwen/qwen3.8-27b", openai: "gpt-4o-mini", anthropic: "claude-3-5-haiku-latest" };
const initialMessages: VeilyMessage[] = [{ role: "assistant", content: "Hi, I’m Veily. I can help you understand your wallet and find your way around Veilora. I can’t sign or execute transactions for you." }];
const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => <p className="mb-2 last:mb-0">{children}</p>,
  h1: ({ children }: { children?: React.ReactNode }) => <h1 className="mb-2 mt-3 text-base font-semibold first:mt-0">{children}</h1>,
  h2: ({ children }: { children?: React.ReactNode }) => <h2 className="mb-2 mt-3 text-sm font-semibold first:mt-0">{children}</h2>,
  h3: ({ children }: { children?: React.ReactNode }) => <h3 className="mb-1 mt-2 text-sm font-semibold first:mt-0">{children}</h3>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
  li: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold">{children}</strong>,
  blockquote: ({ children }: { children?: React.ReactNode }) => <blockquote className="my-2 border-l-2 border-[#f0ac5e] pl-3 text-slate-600 dark:text-mist">{children}</blockquote>,
  a: ({ children, href }: { children?: React.ReactNode; href?: string }) => <a className="underline decoration-[#f0ac5e] underline-offset-2" href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
  code: ({ children }: { children?: React.ReactNode }) => <code className="rounded bg-slate-200/70 px-1 py-0.5 font-mono text-[0.9em] dark:bg-ink-700">{children}</code>,
  pre: ({ children }: { children?: React.ReactNode }) => <pre className="my-2 overflow-x-auto rounded-lg bg-slate-200/70 p-3 font-mono text-xs dark:bg-ink-900">{children}</pre>,
  table: ({ children }: { children?: React.ReactNode }) => <div className="my-2 overflow-x-auto"><table className="w-full border-collapse text-left text-xs">{children}</table></div>,
  th: ({ children }: { children?: React.ReactNode }) => <th className="border-b border-slate-300 px-2 py-1 font-semibold dark:border-ink-600">{children}</th>,
  td: ({ children }: { children?: React.ReactNode }) => <td className="border-b border-slate-200 px-2 py-1 dark:border-ink-700">{children}</td>,
};

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
  const [permissions, setPermissions] = useState<VeilySessionPermission[]>([]);
  const [activePermissionId, setActivePermissionId] = useState("");
  const [permissionPurpose, setPermissionPurpose] = useState("");
  const [permissionDuration, setPermissionDuration] = useState(60);
  const [permissionScopes, setPermissionScopes] = useState<VeilySessionPermission["scopes"]>(["wallet:read"]);
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [permissionNotice, setPermissionNotice] = useState("");
  const sessionPermission = permissions.find(p => p.id === activePermissionId && p.status === "active" && Date.parse(p.expires_at) > Date.now()) ?? null;
  useEffect(() => { setSaved(readSavedCredential()); setApiKey(""); }, [storageKey]);
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
      setMessages(initialMessages);
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
        setMessages(initialMessages);
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
    const conversation = activePermissionId && !permission ? initialMessages : messages;
    if (activePermissionId && !permission) { setActivePermissionId(""); setMessages(initialMessages); }
    const shardA = getStoredDeviceKey();
    if (!shardA || !wallet || !wallet.shardA) { setError("Unlock the wallet's Shard A key before using Veily."); return; }
    if (mode === "byok" && !apiKey) { setSettingsOpen(true); setError("Unlock or enter your provider key in Veily settings first."); return; }
    const userMessage: VeilyMessage = { role: "user", content: text };
    const next: VeilyMessage[] = [...conversation, userMessage].slice(-24);
    const payload: Omit<Parameters<typeof askVeily>[0], "shardASignature"> = {
      walletAddress: getAddress(walletAddress), requestId: crypto.randomUUID(), timestamp: Math.floor(Date.now() / 1000),
      ...(permission ? { permissionId: permission.id } : {}),
      mode, messages: next, context: permission?.scopes.includes("wallet:read") ? walletContext : "",
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
      const message = e instanceof Error ? e.message : "Veily could not respond.";
      if (/permission.*(?:revoked|expired)/i.test(message)) {
        setActivePermissionId("");
        setMessages(initialMessages);
      } else setMessages(messages);
      setDraft(text);
      setError(message);
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
          <div className="border-t border-slate-200 pt-4 dark:border-ink-700">
            <div className="mb-1 flex items-center gap-2 text-sm font-medium"><ShieldCheck size={16}/>Temporary session permissions</div>
            <p className="mb-3 text-xs leading-relaxed text-slate-600 dark:text-mist">Grant Veily only the wallet tools needed for this task. The label helps identify the grant; the selected tool scopes and expiry are what Veilora enforces. Permission labels, scopes, and expiry are stored by Veilora so it can enforce revocation. Permissions expire within 24 hours and can be revoked here. Revoking stops future requests; information already sent to your selected AI provider cannot be recalled. Veily still cannot sign or execute transactions.</p>
            <form onSubmit={grantPermission} className="grid gap-3">
              <input className="wallet-select w-full" aria-label="Permission purpose" value={permissionPurpose} onChange={e=>setPermissionPurpose(e.target.value)} maxLength={120} placeholder="What do you want Veily to help with?"/>
              <div className="grid gap-2 sm:grid-cols-2">
                {([["wallet:read","Read wallet balances"],["activity:read","Read recent activity"],["navigation:prepare","Prepare screen navigation"]] as const).map(([scope,label])=><label key={scope} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-ink-700"><input type="checkbox" checked={permissionScopes.includes(scope)} onChange={e=>setPermissionScopes(current=>e.target.checked?[...new Set([...current,scope])]:current.filter(item=>item!==scope))}/>{label}</label>)}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select aria-label="Permission duration" className="wallet-select" value={permissionDuration} onChange={e=>setPermissionDuration(Number(e.target.value))}><option value={15}>15 minutes</option><option value={60}>1 hour</option><option value={240}>4 hours</option><option value={1440}>24 hours</option></select>
                <button className="wallet-primary-button !w-auto !px-4" disabled={permissionBusy||permissionScopes.length===0}><Check size={15}/>Grant with Shard A</button>
              </div>
            </form>
            {permissionNotice&&<p role="status" className="mt-2 text-xs text-slate-600 dark:text-mist">{permissionNotice}</p>}
            <div className="mt-4 space-y-2">
              {permissions.filter(p=>p.status==="active"&&Date.parse(p.expires_at)>Date.now()).map(permission=><div key={permission.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-100 p-3 dark:bg-ink-800">
                <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-slate-800 dark:text-cream">{permission.purpose}</p><p className="mt-1 text-[11px] text-slate-500 dark:text-mist">{permission.scopes.join(" · ")} · expires {new Date(permission.expires_at).toLocaleString()}</p></div>
                {activePermissionId===permission.id?<span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">In use</span>:<button className="wallet-soft-button !px-3 !py-1.5" onClick={()=>{setActivePermissionId(permission.id);setMessages(initialMessages);}}>Use</button>}
                <button className="wallet-soft-button !px-3 !py-1.5 text-rose-600" disabled={permissionBusy} onClick={()=>void revokePermission(permission.id)}>Revoke</button>
              </div>)}
              {!permissions.some(p=>p.status==="active"&&Date.parse(p.expires_at)>Date.now())&&<p className="text-xs text-slate-500 dark:text-mist">No active permissions. Asset search remains available without wallet access.</p>}
            </div>
            {sessionPermission&&<div className="mt-3 flex items-start gap-2 rounded-xl border border-[#f0ac5e]/40 bg-[#f0ac5e]/10 p-3 text-xs text-slate-700 dark:text-cream-dim"><Clock3 size={15} className="mt-0.5 shrink-0"/><span>Current session: {sessionPermission.purpose}. Veily can use {sessionPermission.scopes.join(", ")} until {new Date(sessionPermission.expires_at).toLocaleString()}.</span></div>}
          </div>
        </div>}
        <div className="border-b border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-ink-700 dark:text-mist">
          {sessionPermission?`Temporary access: ${sessionPermission.scopes.join(", ")} · expires ${new Date(sessionPermission.expires_at).toLocaleTimeString()}`:"No wallet permissions active. Asset search is available; grant a temporary permission in settings for wallet tools."}
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
          {messages.map((message,index)=><div key={`${index}-${message.role}`} className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${message.role === "assistant" ? "bg-[#f0ac5e]/15 text-[#bb762e]" : "bg-slate-100 text-slate-600 dark:bg-ink-800 dark:text-mist"}`}>{message.role === "assistant"?<Bot size={16}/>:<MessageSquare size={15}/>}</span><div className={`max-w-[84%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${message.role === "assistant" ? "bg-slate-50 text-slate-800 dark:bg-ink-850 dark:text-cream-dim" : "whitespace-pre-wrap bg-[#f0ac5e]/15 text-slate-900 dark:text-cream"}`}>{message.role === "assistant"?<ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{message.content}</ReactMarkdown>:message.content}{message.actions?.map((action,actionIndex)=><button key={`${action.screen}-${actionIndex}`} className="wallet-soft-button mt-2 mr-2" onClick={()=>{if(action.screen==="dashboard")void navigate({to:"/app"});else if(action.screen==="market")void navigate({to:"/app/market",search:{q:""}});else if(action.screen==="swap")void navigate({to:"/app/swap",search:{buy:action.token??"NVDA"}});else if(action.screen==="history")void navigate({to:"/app/activity"});else void navigate({to:"/app/rules"});}}>Open {action.screen === "history" ? "history" : action.screen}{action.token?` · ${action.token}`:""}<ArrowUpRight size={13}/></button>)}</div></div>)}
          {busy&&<div className="flex items-center gap-2 text-sm text-slate-500 dark:text-mist"><LoaderCircle className="animate-spin" size={16}/>Veily is thinking…</div>}
        </div>
        {error&&<p role="alert" className="px-5 pb-2 text-sm text-rose-600">{error}</p>}
        <form onSubmit={sendMessage} className="flex items-end gap-2 border-t border-slate-200 p-4 dark:border-ink-700"><textarea aria-label="Message Veily" rows={2} maxLength={4000} className="min-h-12 flex-1 resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#f0ac5e] dark:border-ink-700 dark:bg-ink-900 dark:text-cream" placeholder="Ask about your wallet…" value={draft} onChange={e=>setDraft(e.target.value)}/><button className="wallet-primary-button !w-auto !px-4" aria-label="Send message" disabled={busy||!draft.trim()}><Send size={17}/></button></form>
      </motion.section>}
    <motion.button type="button" whileTap={reduceMotion?undefined:{scale:.92}} onClick={() => setPanelOpen(v => !v)} aria-label={panelOpen?"Close Veily assistant":"Open Veily assistant"} aria-expanded={panelOpen} className="flex items-center gap-2 rounded-full bg-[#f0ac5e] px-4 py-3 text-sm font-semibold text-ink-900 shadow-xl ring-1 ring-black/5 transition-colors hover:bg-[#e99a46] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f0ac5e] focus-visible:ring-offset-2"><Sparkles size={18}/><span>{panelOpen?"Close":"Ask Veily"}</span></motion.button>
  </div>;
}
