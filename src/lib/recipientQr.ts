import jsQR from 'jsqr';
import { getAddress, isAddress, zeroAddress } from 'viem';

/** Accept only a plain wallet address or a basic EIP-681 address on Robinhood Chain. */
export function parseRecipientQrPayload(payload: string): `0x${string}` | null {
  const value = payload.trim();
  const match = /^(?:ethereum:)?(0x[a-fA-F0-9]{40})(?:@4663)?$/i.exec(value);
  const address = match?.[1];
  if (!address || !isAddress(address) || address.toLowerCase() === zeroAddress) return null;
  return getAddress(address);
}

export async function readRecipientQrImage(file: File): Promise<`0x${string}`> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file containing a wallet QR code.');
  if (file.size > 12 * 1024 * 1024) throw new Error('This image is too large. Choose an image under 12 MB.');

  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file);
    if (bitmap.width * bitmap.height > 20_000_000) {
      throw new Error('This image is too large to scan. Choose a smaller image.');
    }
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Could not read this image in your browser.');
    context.drawImage(bitmap, 0, 0);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const result = jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' });
    if (!result) throw new Error('No QR code was found. Try a clearer image.');
    const recipient = parseRecipientQrPayload(result.data);
    if (!recipient) throw new Error('This QR code does not contain a supported Robinhood Chain wallet address.');
    return recipient;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Could not scan this image. Try another QR code image.');
  } finally {
    bitmap?.close();
  }
}
