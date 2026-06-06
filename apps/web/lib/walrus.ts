// Browser Walrus adapter — thin wrappers over the shared HTTP client
// (apps/shared/src/walrus-client.ts). Walrus testnet publisher + aggregators
// send permissive CORS, so the browser calls them directly (verified live).
// NEXT_PUBLIC_* values are passed explicitly because Next only inlines literal
// process.env.NEXT_PUBLIC_X reads — the shared client's dynamic lookup would
// otherwise miss them in the browser.

import { uploadBlob, downloadBlob, getWalrusConfig, type WalrusConfig } from '@keepra/shared';

const UPLOAD_TIMEOUT_MS = 30_000;
const DOWNLOAD_TIMEOUT_MS = 12_000;

function browserWalrusConfig(): WalrusConfig {
  return getWalrusConfig({
    NEXT_PUBLIC_WALRUS_PUBLISHER_URL: process.env.NEXT_PUBLIC_WALRUS_PUBLISHER_URL,
    NEXT_PUBLIC_WALRUS_AGGREGATORS: process.env.NEXT_PUBLIC_WALRUS_AGGREGATORS,
    WALRUS_EPOCHS: process.env.NEXT_PUBLIC_WALRUS_EPOCHS,
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms),
    ),
  ]);
}

export async function uploadCiphertext(bytes: Uint8Array, ownerAddress?: string) {
  return withTimeout(
    uploadBlob(bytes, { config: browserWalrusConfig(), sendObjectTo: ownerAddress }),
    UPLOAD_TIMEOUT_MS,
    'Walrus upload',
  );
}

export async function downloadCiphertext(blobId: string): Promise<Uint8Array> {
  return downloadBlob(blobId, { config: browserWalrusConfig(), timeoutMs: DOWNLOAD_TIMEOUT_MS });
}
