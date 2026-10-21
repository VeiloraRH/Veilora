import { expect, test } from 'bun:test';
import { addressIn } from '../src/components/app/VeilyAddressCheck';

test('finds the first full address in a question, ignoring hashes and fragments', () => {
 expect(addressIn('Is 0x2222222222222222222222222222222222222222 safe to pay?')).toBe('0x2222222222222222222222222222222222222222');
 expect(addressIn(`What was 0x${'ab'.repeat(32)}?`)).toBeNull();
 expect(addressIn('Who is 0x1234?')).toBeNull();
 expect(addressIn('no address here')).toBeNull();
});
