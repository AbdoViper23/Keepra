export type VaultState = 'Sealed' | 'Triggered' | 'Revoked';

export interface FileEntry {
  name: string;
  mime: string;
  size: number;
}

export interface VaultSummary {
  vaultId: string;
  heartbeatLogId: string;
  blobId: string;
  createdAtMs: number;
}

export interface VaultView {
  vaultId: string;
  owner: string;
  blobId: string;
  sealIdHex: string;
  inactivitySeconds: number;
  guardianQuorum: number;
  guardianSet: string[];
  beneficiaryEmailHash: string;
  createdAtMs: number;
}

export interface HeartbeatLogView {
  logId: string;
  lastHeartbeatMs: number;
  revoked: boolean;
  triggered: boolean;
  attestations: string[]; // guardian addresses that attested
}

export interface VaultDetail {
  vault: VaultView;
  log: HeartbeatLogView;
  state: VaultState;
  msUntilTrigger: number;
  claimable: boolean;
}

export interface DecodedPayload {
  manifest: { createdAtMs: number; note?: string };
  text?: string;
  files: { entry: FileEntry; bytes: Uint8Array }[];
}

export interface CreateVaultInput {
  text?: string;
  files?: { name: string; mime: string; bytes: Uint8Array }[];
  inactivitySeconds: number;
  guardianAddresses: string[];
  guardianQuorum: number;
  beneficiaryEmail: string;
}

export type CreatePhase = 'idle' | 'encrypting' | 'uploading' | 'sealing' | 'done' | 'error';
export type ClaimPhase = 'idle' | 'authorizing' | 'fetching' | 'decrypting' | 'done' | 'error';
