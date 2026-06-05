'use client';

// Browser Seal adapter. Ported from tools/seal-roundtrip/index.ts — same SDK
// calls, with two browser substitutions: Web Crypto for the random seal id, and
// a wallet-signed SessionKey (no raw keypair). `packageId` is the KEEPRA package
// (the policy module that key servers dry-run), not the Seal system package.

import { SealClient, SessionKey, DemType } from '@mysten/seal';
import type { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { toHex } from '@mysten/sui/utils';

import { KEEPRA_PKG } from './sui';

const COMMITTEE_SERVER_ID = process.env.NEXT_PUBLIC_SEAL_COMMITTEE_SERVER_ID ?? '';
const COMMITTEE_AGGREGATOR_URL = process.env.NEXT_PUBLIC_SEAL_COMMITTEE_AGGREGATOR_URL ?? '';

/** Demo threshold: 1, against the committee server (matches the proven roundtrip). */
export const SEAL_THRESHOLD = 1;
/** SessionKey lifetime — one wallet signature covers this window. */
export const SESSION_TTL_MIN = 10;

let cachedClient: SealClient | null = null;
let cachedFor: SuiJsonRpcClient | null = null;

export function getSealClient(suiClient: SuiJsonRpcClient): SealClient {
  if (cachedClient && cachedFor === suiClient) return cachedClient;
  cachedClient = new SealClient({
    suiClient,
    serverConfigs: [
      { objectId: COMMITTEE_SERVER_ID, aggregatorUrl: COMMITTEE_AGGREGATOR_URL, weight: 1 },
    ],
    verifyKeyServers: true,
  });
  cachedFor = suiClient;
  return cachedClient;
}

/** Random 32-byte identity bound into the ciphertext and checked on-chain. */
export function generateSealId(): { bytes: Uint8Array; hex: string } {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return { bytes, hex: toHex(bytes) };
}

export async function encryptForVault(
  suiClient: SuiJsonRpcClient,
  data: Uint8Array,
  sealIdHex: string,
  threshold: number = SEAL_THRESHOLD,
): Promise<{ encryptedObject: Uint8Array; backupKey: Uint8Array }> {
  const { encryptedObject, key } = await getSealClient(suiClient).encrypt({
    packageId: KEEPRA_PKG,
    threshold,
    id: sealIdHex,
    data,
    demType: DemType.AesGcm256,
  });
  return { encryptedObject, backupKey: key };
}

/** Create a SessionKey without a signer — completed by a wallet signature. */
export function createSessionKey(
  address: string,
  suiClient: SuiJsonRpcClient,
): Promise<SessionKey> {
  return SessionKey.create({
    address,
    packageId: KEEPRA_PKG,
    ttlMin: SESSION_TTL_MIN,
    suiClient,
  });
}

export async function decryptVault(args: {
  suiClient: SuiJsonRpcClient;
  encrypted: Uint8Array;
  sessionKey: SessionKey;
  txBytes: Uint8Array;
}): Promise<Uint8Array> {
  return getSealClient(args.suiClient).decrypt({
    data: args.encrypted,
    sessionKey: args.sessionKey,
    txBytes: args.txBytes,
  });
}

export type { SessionKey };
