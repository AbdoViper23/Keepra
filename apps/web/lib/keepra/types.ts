// UI-facing type aliases, now re-exported from the real logic layer so the views
// and the chain hooks share a single source of truth.

export type { VaultState } from '@/lib/vault';
export type { DecodedPayload, FileEntry } from '@/lib/payload';
