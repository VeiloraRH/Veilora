/**
 * Address-poisoning protection. Scammers send tiny transfers from addresses
 * that copy the first and last characters of ones you use, hoping you paste
 * theirs from your history. Before a send, compare the recipient with your
 * contacts, the addresses you have sent to, and your own account.
 */
export type CheckLevel = 'ok' | 'info' | 'warn' | 'danger';
export type CheckItem = { level: CheckLevel; code: string; text: string };
export type RecipientAssessment = { level: CheckLevel; items: CheckItem[]; contactName: string | null; timesSent: number };

export type RecipientHistory = { direction: 'sent' | 'received' | 'contract'; from: string; to: string; amount: string }[];
export type RecipientInputs = {
 recipient: string;
 wallet: string;
 contacts: { name: string; address: string }[];
 history: RecipientHistory;
 tokenContracts: { symbol: string; address: string }[];
 /** Bytecode at the recipient, if known. Veilora accounts are contracts too, so this is informational. */
 code?: string | null;
};

const RANK: Record<CheckLevel, number> = { ok: 0, info: 1, warn: 2, danger: 3 };
const lower = (a: string) => a.toLowerCase();
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const hex = (a: string) => lower(a).replace(/^0x/, '');

/** Shares the first and last `n` hex characters but is a different address. */
export function looksAlike(a: string, b: string, n: number): boolean {
 const x = hex(a), y = hex(b);
 return x !== y && x.slice(0, n) === y.slice(0, n) && x.slice(-n) === y.slice(-n);
}

export function assessRecipient({ recipient, wallet, contacts, history, tokenContracts, code }: RecipientInputs): RecipientAssessment {
 const r = lower(recipient);
 const items: CheckItem[] = [];
 const contact = contacts.find(c => lower(c.address) === r) ?? null;
 const timesSent = history.filter(t => t.direction === 'sent' && lower(t.to) === r).length;
 const receivedOnly = !timesSent && history.some(t => t.direction === 'received' && lower(t.from) === r);

 if (r === lower(wallet)) items.push({ level: 'danger', code: 'self', text: 'This is your own account. Sending here does nothing.' });
 const token = tokenContracts.find(t => lower(t.address) === r);
 if (token) items.push({ level: 'danger', code: 'token-contract', text: `This is the ${token.symbol} token contract, not a wallet. Tokens sent here are usually lost for good.` });

 // Lookalikes of anything you trust: contacts, past recipients, your own account.
 const trusted = new Map<string, string>();
 for (const c of contacts) trusted.set(lower(c.address), `your contact “${c.name}”`);
 for (const t of history) if (t.direction === 'sent' && t.to && !trusted.has(lower(t.to))) trusted.set(lower(t.to), `${short(t.to)}, which you have sent to before`);
 trusted.set(lower(wallet), 'your own account');
 const strong = [...trusted].find(([addr]) => looksAlike(r, addr, 4));
 const weak = strong ? undefined : [...trusted].find(([addr]) => looksAlike(r, addr, 3));
 if (strong) items.push({ level: 'danger', code: 'lookalike', text: `Looks like ${strong[1]}, but it is a different address. This is how address-poisoning scams work.` });
 else if (weak) items.push({ level: 'warn', code: 'similar', text: `Starts and ends like ${weak[1]}. Check every character.` });

 if (contact) items.push({ level: 'ok', code: 'contact', text: `Saved contact: ${contact.name}.` });
 if (timesSent) items.push({ level: 'ok', code: 'known', text: `You have sent to this address ${timesSent === 1 ? 'once' : `${timesSent} times`} before.` });
 if (receivedOnly) items.push({ level: 'warn', code: 'received-only', text: 'This address only appears in your history because it sent to you. Scammers send tiny transfers so you copy their address.' });
 if (!contact && !timesSent && !receivedOnly && !items.some(i => i.level === 'danger')) {
  items.push({ level: 'warn', code: 'new', text: 'First time sending to this address. Confirm it with the recipient through another channel.' });
 }
 if (code && code !== '0x' && !token) items.push({ level: 'info', code: 'contract', text: 'This address is a smart contract, such as another smart account. Make sure it can receive this asset.' });

 const level = items.reduce<CheckLevel>((worst, i) => (RANK[i.level] > RANK[worst] ? i.level : worst), 'ok');
 return { level, items, contactName: contact?.name ?? null, timesSent };
}

/** Split an address into groups so it can be compared with the recipient, four characters at a time. */
export function addressGroups(address: string): string[] {
 const body = address.replace(/^0x/, '');
 return ['0x', ...body.match(/.{1,4}/g) ?? []];
}
