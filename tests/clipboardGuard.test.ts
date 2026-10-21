import { beforeEach, expect, test } from 'bun:test';
import { checkPaste, forgetCopied, rememberCopied } from '../src/lib/clipboardGuard';

const mine = '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B';
// Same first and last characters, different middle: the classic swap.
const swapped = '0xab5800000000000000000000000000000000ec9b';
beforeEach(() => forgetCopied());

test('removes invisible characters from a pasted address', () => {
 const r = checkPaste(`​${mine}‮ \n`);
 expect(r).toEqual({ value: mine, removedHidden: true, mismatch: null });
 expect(checkPaste(mine).removedHidden).toBe(false);
});

test('warns when a pasted address imitates one just copied in Veilora', () => {
 rememberCopied(mine, 1_000);
 expect(checkPaste(mine, 2_000).mismatch).toBeNull();
 expect(checkPaste(swapped, 2_000).mismatch).toContain('not the one you copied');
 expect(checkPaste('0x3333333333333333333333333333333333333333', 2_000).mismatch).toBeNull();
 expect(checkPaste(swapped, 1_000 + 31 * 60_000).mismatch).toBeNull();
});
