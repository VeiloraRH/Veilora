import { describe, expect, test } from 'bun:test';
import { assessRecipient, looksAlike } from '../src/lib/recipientCheck';

const wallet = '0xeFE2268BcC784301A939DAaee7393ab81af4CC53';
const friend = '0xAb12000000000000000000000000000000009f3C';
const poison = '0xab12ffffffffffffffffffffffffffffffff9f3c'; // same first/last 4 hex as friend
const USDG = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168';
const base = { wallet, contacts: [], history: [], tokenContracts: [{ symbol: 'USDG', address: USDG }] };
const codes = (a: ReturnType<typeof assessRecipient>) => a.items.map(i => i.code);

describe('address-poisoning protection', () => {
  test('lookalike detection compares the first and last characters', () => {
    expect(looksAlike(friend, poison, 4)).toBe(true);
    expect(looksAlike(friend, friend, 4)).toBe(false);
    expect(looksAlike(friend, wallet, 4)).toBe(false);
  });

  test('a saved contact or past recipient is trusted', () => {
    const contact = assessRecipient({ ...base, recipient: friend, contacts: [{ name: 'Sam', address: friend }] });
    expect(contact.level).toBe('ok');
    expect(contact.contactName).toBe('Sam');
    const past = assessRecipient({ ...base, recipient: friend, history: [{ direction: 'sent', from: wallet, to: friend, amount: '5' }, { direction: 'sent', from: wallet, to: friend, amount: '2' }] });
    expect(past.timesSent).toBe(2);
    expect(codes(past)).toEqual(['known']);
  });

  test('flags a poisoned lookalike of a contact as danger', () => {
    const a = assessRecipient({ ...base, recipient: poison, contacts: [{ name: 'Sam', address: friend }] });
    expect(a.level).toBe('danger');
    expect(a.items[0].text).toContain('your contact “Sam”');
  });

  test('an address that only ever sent to you is not trusted', () => {
    const a = assessRecipient({ ...base, recipient: poison, history: [{ direction: 'received', from: poison, to: wallet, amount: '0' }] });
    expect(codes(a)).toContain('received-only');
    expect(a.level).toBe('warn');
  });

  test('warns on new addresses and refuses obvious mistakes', () => {
    expect(codes(assessRecipient({ ...base, recipient: friend }))).toEqual(['new']);
    expect(assessRecipient({ ...base, recipient: wallet }).items[0].code).toBe('self');
    const token = assessRecipient({ ...base, recipient: USDG });
    expect(token.level).toBe('danger');
    expect(codes(token)).toContain('token-contract');
  });

  test('blocks addresses on the device-local blocklist', () => {
    const blocked = assessRecipient({ ...base, recipient: friend, blockedAddresses: [friend.toLowerCase()] });
    expect(blocked.level).toBe('danger');
    expect(codes(blocked)).toContain('user-blocked');
  });

  test('bridge mode blocks your own address, uses bridge history and names the chain', () => {
    const own = assessRecipient({ ...base, recipient: wallet, mode: 'bridge', chainName: 'Base' });
    expect(own.items[0].code).toBe('self');
    expect(own.items[0].text).toContain('only exists on Robinhood Chain');
    const fresh = assessRecipient({ ...base, recipient: friend, mode: 'bridge', chainName: 'Base' });
    expect(fresh.items[0].text).toContain('control it on Base');
    const bridgedBefore = { direction: 'sent' as const, from: wallet, to: friend, amount: '1' };
    expect(assessRecipient({ ...base, recipient: friend, history: [bridgedBefore], mode: 'bridge' }).items[0].text).toContain('bridged to this address once');
    expect(assessRecipient({ ...base, recipient: poison, history: [bridgedBefore], mode: 'bridge' }).level).toBe('danger');
  });
});
