import { expect, test } from 'bun:test';
import { authenticatorMessage } from '../src/lib/authenticatorApi';

test('signs the exact authenticator messages the co-signer checks', () => {
 const wallet = '0x7777777777777777777777777777777777777777';
 expect(authenticatorMessage('setup', wallet, 1_800_000_000)).toBe('Veilora authenticator setup\nwallet:0x7777777777777777777777777777777777777777\ntimestamp:1800000000');
 expect(authenticatorMessage('remove', wallet, 1_800_000_000, '123456')).toBe('Veilora authenticator remove\nwallet:0x7777777777777777777777777777777777777777\ncode:123456\ntimestamp:1800000000');
});
