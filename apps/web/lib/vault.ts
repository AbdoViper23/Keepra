// Parsing + state derivation for on-chain Vault / HeartbeatLog objects.
// Frozen Vaults are discovered via VaultCreated events (they are not "owned").

import type { SuiObjectResponse } from '@mysten/sui/jsonRpc';
import { toHex } from '@mysten/sui/utils';

export type VaultState = 'Sealed' | 'Triggered' | 'Revoked';

export interface VaultView {
  id: string;
  owner: string;
  blobId: string;
  sealId: Uint8Array;
  sealIdHex: string;
  threshold: number;
  keyServerIds: string[];
  inactivitySeconds: number;
  guardianQuorum: number;
  guardianSet: string[];
  heartbeatLogId: string;
  beneficiaryEmailHashHex: string;
  createdAtMs: number;
  version: number;
}

export interface HeartbeatLogView {
  id: string;
  vaultId: string;
  owner: string;
  lastHeartbeatMs: number;
  revoked: boolean;
  triggered: boolean;
  triggerReason: number;
  attestations: string[];
  daoReleased: boolean;
}

export interface DerivedVaultState {
  state: VaultState;
  /** ms until the inactivity deadline (may be negative once elapsed). */
  msUntilTrigger: number;
  claimable: boolean;
}

type Fields = Record<string, unknown>;

function extractFields(obj: SuiObjectResponse): Fields {
  const content = obj.data?.content;
  if (!content || content.dataType !== 'moveObject') {
    throw new Error('Object has no readable Move content (is the id correct?).');
  }
  return content.fields as Fields;
}

/** Sui returns vector<u8> as a number[] or a base64 string depending on context. */
export function vecU8ToBytes(field: unknown): Uint8Array {
  if (field == null) return new Uint8Array();
  if (field instanceof Uint8Array) return field;
  if (Array.isArray(field)) return Uint8Array.from(field.map((n) => Number(n) & 0xff));
  if (typeof field === 'string') {
    try {
      return Uint8Array.from(atob(field), (c) => c.charCodeAt(0));
    } catch {
      return new TextEncoder().encode(field);
    }
  }
  return new Uint8Array();
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : [];
}

export function parseVault(obj: SuiObjectResponse): VaultView {
  const f = extractFields(obj);
  const sealId = vecU8ToBytes(f.seal_id);
  return {
    id: obj.data?.objectId ?? '',
    owner: String(f.owner ?? ''),
    blobId: new TextDecoder().decode(vecU8ToBytes(f.walrus_blob_id)),
    sealId,
    sealIdHex: toHex(sealId),
    threshold: Number(f.threshold ?? 0),
    keyServerIds: asStringArray(f.key_server_ids),
    inactivitySeconds: Number(f.inactivity_seconds ?? 0),
    guardianQuorum: Number(f.guardian_quorum ?? 0),
    guardianSet: asStringArray(f.guardian_set),
    heartbeatLogId: String(f.heartbeat_log_id ?? ''),
    beneficiaryEmailHashHex: toHex(vecU8ToBytes(f.beneficiary_email_hash)),
    createdAtMs: Number(f.created_at_ms ?? 0),
    version: Number(f.version ?? 0),
  };
}

export function parseLog(obj: SuiObjectResponse): HeartbeatLogView {
  const f = extractFields(obj);
  return {
    id: obj.data?.objectId ?? '',
    vaultId: String(f.vault_id ?? ''),
    owner: String(f.owner ?? ''),
    lastHeartbeatMs: Number(f.last_heartbeat_ms ?? 0),
    revoked: Boolean(f.revoked),
    triggered: Boolean(f.triggered),
    triggerReason: Number(f.trigger_reason ?? 0),
    attestations: asStringArray(f.attestations),
    daoReleased: Boolean(f.dao_released),
  };
}

/**
 * Mirrors keepra::policy::seal_approve_release: revoked blocks everything; any of
 * (inactivity elapsed | guardian quorum reached | DAO released) triggers release.
 */
export function deriveVaultState(
  vault: Pick<VaultView, 'inactivitySeconds' | 'guardianQuorum'>,
  log: HeartbeatLogView,
  now: number = Date.now(),
): DerivedVaultState {
  if (log.revoked) return { state: 'Revoked', msUntilTrigger: 0, claimable: false };

  const inactivityDeadline = log.lastHeartbeatMs + vault.inactivitySeconds * 1000;
  const msUntilTrigger = inactivityDeadline - now;

  const inactiveOk = now >= inactivityDeadline;
  const quorumOk = log.attestations.length >= vault.guardianQuorum;
  const triggered = log.triggered || inactiveOk || quorumOk || log.daoReleased;

  return {
    state: triggered ? 'Triggered' : 'Sealed',
    msUntilTrigger,
    claimable: triggered,
  };
}
