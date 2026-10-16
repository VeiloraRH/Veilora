import { describe, expect, test } from 'bun:test';
import { parseRecipientQrPayload } from '../src/lib/recipientQr';

describe('parseRecipientQrPayload', () => {
  const address = '0x2241D50BfE090BEb20a2521bdaf351C42446D73c';

  test('accepts the plain address shown by Veilora receive QR codes', () => {
    expect(parseRecipientQrPayload(address)).toBe(address);
  });

  test('accepts a basic Robinhood Chain address URI', () => {
    expect(parseRecipientQrPayload(`ethereum:${address}@4663`)).toBe(address);
  });

  test('rejects other chains, payment requests, malformed values, and zero address', () => {
    expect(parseRecipientQrPayload(`ethereum:${address}@1`)).toBeNull();
    expect(parseRecipientQrPayload(`ethereum:${address}?value=1`)).toBeNull();
    expect(parseRecipientQrPayload('not an address')).toBeNull();
    expect(parseRecipientQrPayload('0x0000000000000000000000000000000000000000')).toBeNull();
  });
});
