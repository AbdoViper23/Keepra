// Minimal, runtime-agnostic Walrus client built on the HTTP publisher/aggregator
// API and native `fetch` (works in Node 20+ and the browser — no SDK, no WASM).
// Upload goes through the public publisher (it pays storage); download tries each
// configured aggregator in order with a per-request timeout (Flows §8 resilience).

import { getWalrusConfig, type WalrusConfig } from './config.js';

export interface WalrusUploadResult {
  /** Content-addressed blob id (base64url) — used to fetch the blob back. */
  blobId: string;
  /** Sui object id of the Walrus `Blob` (when newly created). Needed for lifetime extension. */
  blobObjectId?: string;
  /** True when the publisher found an identical blob already certified on Walrus. */
  alreadyCertified: boolean;
}

export interface UploadOptions {
  config?: WalrusConfig;
  /** Transfer the created Blob object to this address (so the caller owns it). */
  sendObjectTo?: string;
}

export interface DownloadOptions {
  config?: WalrusConfig;
  /** Per-aggregator request timeout in ms (default 8000). */
  timeoutMs?: number;
}

export async function uploadBlob(
  data: Uint8Array,
  opts: UploadOptions = {},
): Promise<WalrusUploadResult> {
  const cfg = opts.config ?? getWalrusConfig();
  const params = new URLSearchParams({ epochs: String(cfg.epochs) });
  if (opts.sendObjectTo) params.set('send_object_to', opts.sendObjectTo);

  const res = await fetch(`${cfg.publisherUrl}/v1/blobs?${params.toString()}`, {
    method: 'PUT',
    body: data as BodyInit,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Walrus upload failed (${res.status}): ${detail}`);
  }

  const json = (await res.json()) as WalrusPublisherResponse;
  if (json.newlyCreated) {
    return {
      blobId: json.newlyCreated.blobObject.blobId,
      blobObjectId: json.newlyCreated.blobObject.id,
      alreadyCertified: false,
    };
  }
  if (json.alreadyCertified) {
    return { blobId: json.alreadyCertified.blobId, alreadyCertified: true };
  }
  throw new Error(`Unexpected Walrus publisher response: ${JSON.stringify(json)}`);
}

export async function downloadBlob(
  blobId: string,
  opts: DownloadOptions = {},
): Promise<Uint8Array> {
  const cfg = opts.config ?? getWalrusConfig();
  const timeoutMs = opts.timeoutMs ?? 8000;

  const errors: string[] = [];
  for (const base of cfg.aggregatorUrls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${base}/v1/blobs/${blobId}`, { signal: controller.signal });
      if (!res.ok) {
        errors.push(`${base} → HTTP ${res.status}`);
        continue;
      }
      return new Uint8Array(await res.arrayBuffer());
    } catch (e) {
      errors.push(`${base} → ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`All Walrus aggregators failed for ${blobId}: ${errors.join('; ')}`);
}

interface WalrusPublisherResponse {
  newlyCreated?: { blobObject: { blobId: string; id: string } };
  alreadyCertified?: { blobId: string };
}
