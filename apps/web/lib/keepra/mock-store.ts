'use client';

// In-memory + localStorage mock store for the Keepra UI prototype.
// NO real Sui/Seal/Walrus calls. Plaintext / file bytes are NEVER persisted
// to localStorage (Invariant I6 + no-plaintext-in-persistence rule).

import { useSyncExternalStore } from 'react';
import type {
  CreateVaultInput,
  DecodedPayload,
  HeartbeatLogView,
  VaultDetail,
  VaultState,
  VaultSummary,
  VaultView,
} from './types';

const LS_KEY = 'keepra.mock.v1';
const LS_WALLET = 'keepra.mock.wallet.v1';

interface StoredVault {
  vault: VaultView;
  log: HeartbeatLogView;
  // Plaintext payload kept only in-memory; survives a remount but not a tab reload.
  // Persisted side carries only metadata.
}

interface PersistedVault {
  vault: VaultView;
  log: HeartbeatLogView;
}

interface State {
  wallet: { address: string | null };
  vaults: Map<string, StoredVault>;
  // Vault id -> in-memory decoded payload (the "decrypted" content).
  payloads: Map<string, DecodedPayload>;
  // Guardian caps held by the connected wallet (vaultId -> capId).
  caps: Map<string, { capId: string; vaultId: string }>;
}

let state: State = {
  wallet: { address: null },
  vaults: new Map(),
  payloads: new Map(),
  caps: new Map(),
};

const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

// ---------- persistence (metadata only) ----------

function persist() {
  if (typeof window === 'undefined') return;
  const data = {
    vaults: Array.from(state.vaults.values()).map((v) => ({
      vault: v.vault,
      log: v.log,
    })) as PersistedVault[],
    caps: Array.from(state.caps.values()),
  };
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}

function hydrate() {
  if (typeof window === 'undefined') return;
  try {
    const walletRaw = window.localStorage.getItem(LS_WALLET);
    if (walletRaw) state.wallet.address = JSON.parse(walletRaw);
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as {
      vaults: PersistedVault[];
      caps: { capId: string; vaultId: string }[];
    };
    for (const v of data.vaults ?? []) {
      state.vaults.set(v.vault.vaultId, { vault: v.vault, log: v.log });
    }
    for (const c of data.caps ?? []) {
      state.caps.set(c.vaultId, c);
    }
  } catch {
    /* ignore */
  }
}

let hydrated = false;
function ensureHydrated() {
  if (hydrated) return;
  hydrated = true;
  hydrate();
}

// ---------- wallet ----------

function randomHex(len: number): string {
  const bytes = new Uint8Array(len);
  if (typeof crypto !== 'undefined') crypto.getRandomValues(bytes);
  else for (let i = 0; i < len; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function mockConnect() {
  ensureHydrated();
  if (!state.wallet.address) {
    state.wallet.address = '0x' + randomHex(32);
    try {
      window.localStorage.setItem(LS_WALLET, JSON.stringify(state.wallet.address));
    } catch {
      /* ignore */
    }
  }
  emit();
}

export function mockDisconnect() {
  state.wallet.address = null;
  try {
    window.localStorage.removeItem(LS_WALLET);
  } catch {
    /* ignore */
  }
  emit();
}

export function useCurrentAccount(): { address: string } | null {
  const snap = useSyncExternalStore(
    subscribe,
    () => state.wallet.address,
    () => null,
  );
  return snap ? { address: snap } : null;
}

// ---------- vaults ----------

export function listVaults(owner: string): VaultSummary[] {
  ensureHydrated();
  return Array.from(state.vaults.values())
    .filter((v) => v.vault.owner === owner)
    .map((v) => ({
      vaultId: v.vault.vaultId,
      heartbeatLogId: v.log.logId,
      blobId: v.vault.blobId,
      createdAtMs: v.vault.createdAtMs,
    }))
    .sort((a, b) => b.createdAtMs - a.createdAtMs);
}

export function getVaultDetail(vaultId: string): VaultDetail | null {
  ensureHydrated();
  const v = state.vaults.get(vaultId);
  if (!v) return null;
  return deriveDetail(v);
}

function deriveDetail(v: StoredVault): VaultDetail {
  const now = Date.now();
  const deadline = v.log.lastHeartbeatMs + v.vault.inactivitySeconds * 1000;
  const msUntilTrigger = deadline - now;
  const quorumMet =
    v.vault.guardianQuorum > 0 && v.log.attestations.length >= v.vault.guardianQuorum;
  const inactivityMet = msUntilTrigger <= 0;
  let state_: VaultState = 'Sealed';
  if (v.log.revoked) state_ = 'Revoked';
  else if (v.log.triggered || quorumMet || inactivityMet) state_ = 'Triggered';
  const claimable = !v.log.revoked && (quorumMet || inactivityMet);
  return {
    vault: v.vault,
    log: v.log,
    state: state_,
    msUntilTrigger,
    claimable,
  };
}

export function listGuardianCaps(owner: string): { capId: string; vaultId: string }[] {
  ensureHydrated();
  return Array.from(state.caps.values()).filter((c) => {
    const v = state.vaults.get(c.vaultId);
    return v && v.vault.guardianSet.includes(owner);
  });
}

// ---------- mutations ----------

async function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function sha256Hex(s: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return randomHex(32);
}

export async function createVaultMock(
  input: CreateVaultInput,
  onPhase: (p: 'encrypting' | 'uploading' | 'sealing') => void,
): Promise<{ vaultId: string; heartbeatLogId: string; blobId: string; digest: string }> {
  ensureHydrated();
  const owner = state.wallet.address;
  if (!owner) throw new Error('Connect a wallet first.');
  onPhase('encrypting');
  await sleep(900);
  onPhase('uploading');
  await sleep(900);
  onPhase('sealing');
  await sleep(900);

  const vaultId = '0x' + randomHex(32);
  const logId = '0x' + randomHex(32);
  const blobId = 'blob_' + randomHex(16);
  const sealIdHex = randomHex(32);
  const emailHash = await sha256Hex(input.beneficiaryEmail.toLowerCase().trim());
  const createdAtMs = Date.now();

  const guardianSet = input.guardianAddresses.length > 0 ? input.guardianAddresses : [owner];
  const vault: VaultView = {
    vaultId,
    owner,
    blobId,
    sealIdHex,
    inactivitySeconds: input.inactivitySeconds,
    guardianQuorum: input.guardianQuorum,
    guardianSet,
    beneficiaryEmailHash: emailHash,
    createdAtMs,
  };
  const log: HeartbeatLogView = {
    logId,
    lastHeartbeatMs: createdAtMs,
    revoked: false,
    triggered: false,
    attestations: [],
  };
  state.vaults.set(vaultId, { vault, log });

  // If owner is in guardian set, give them a cap.
  if (guardianSet.includes(owner)) {
    const capId = '0x' + randomHex(32);
    state.caps.set(vaultId, { capId, vaultId });
  }

  // Stash the plaintext payload in memory so /claim can render it back.
  const payload: DecodedPayload = {
    manifest: { createdAtMs },
    text: input.text,
    files: (input.files ?? []).map((f) => ({
      entry: { name: f.name, mime: f.mime, size: f.bytes.length },
      bytes: f.bytes,
    })),
  };
  state.payloads.set(vaultId, payload);

  persist();
  emit();
  return { vaultId, heartbeatLogId: logId, blobId, digest: '0x' + randomHex(32) };
}

export async function sendHeartbeatMock(vaultId: string): Promise<boolean> {
  await sleep(700);
  const v = state.vaults.get(vaultId);
  if (!v) throw new Error('Vault not found.');
  if (v.log.revoked) throw new Error('Vault is revoked.');
  v.log.lastHeartbeatMs = Date.now();
  v.log.triggered = false;
  persist();
  emit();
  return true;
}

export async function revokeMock(vaultId: string): Promise<boolean> {
  await sleep(700);
  const v = state.vaults.get(vaultId);
  if (!v) throw new Error('Vault not found.');
  v.log.revoked = true;
  persist();
  emit();
  return true;
}

export async function attestMock(vaultId: string): Promise<boolean> {
  await sleep(700);
  const owner = state.wallet.address;
  if (!owner) throw new Error('Connect a wallet first.');
  const v = state.vaults.get(vaultId);
  if (!v) throw new Error('Vault not found.');
  if (!v.vault.guardianSet.includes(owner)) throw new Error('Not a guardian.');
  if (!v.log.attestations.includes(owner)) {
    v.log.attestations.push(owner);
  }
  if (v.log.attestations.length >= v.vault.guardianQuorum) {
    v.log.triggered = true;
  }
  persist();
  emit();
  return true;
}

export async function claimMock(
  detail: VaultDetail,
  onPhase: (p: 'authorizing' | 'fetching' | 'decrypting') => void,
): Promise<DecodedPayload> {
  ensureHydrated();
  if (!detail.claimable) {
    const err = new Error('Conditions not yet met (code 0).');
    throw err;
  }
  if (detail.log.revoked) throw new Error('Vault was revoked.');
  onPhase('authorizing');
  await sleep(700);
  onPhase('fetching');
  await sleep(800);
  onPhase('decrypting');
  await sleep(900);
  const payload = state.payloads.get(detail.vault.vaultId);
  if (!payload) {
    // Fallback if the tab reloaded and lost in-memory plaintext.
    return {
      manifest: { createdAtMs: detail.vault.createdAtMs },
      text: "[ This vault's plaintext was lost when the tab reloaded — the UI prototype keeps decoded payloads only in memory. Create a new vault to see live content. ]",
      files: [],
    };
  }
  return payload;
}

// expose state for any debug surfaces (not used by UI directly)
export function _peek() {
  return state;
}
