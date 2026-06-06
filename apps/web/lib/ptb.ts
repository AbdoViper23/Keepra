// Programmable Transaction Block builders. Argument order for create_and_seal is
// copied verbatim from the proven tools/seal-roundtrip/index.ts — the contract
// itself freezes the Vault, shares the HeartbeatLog, and mints GuardianCaps, so
// each builder is a single moveCall.

import { Transaction } from '@mysten/sui/transactions';
import type { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';

import { KEEPRA_PKG, CLOCK_ID } from './sui';

export interface CreateVaultParams {
  /** Walrus content blob id (base64url string). */
  blobId: string;
  /** Sui object id of the Walrus Blob (for lifetime extension), or null. */
  blobObjectId?: string | null;
  /** 32-byte Seal identity bound into the ciphertext. */
  sealIdBytes: Uint8Array;
  threshold: number;
  keyServerIds?: string[];
  inactivitySeconds: number;
  guardianSet: string[];
  guardianQuorum: number;
  daoId?: string | null;
  daoThreshold?: number | null;
  beneficiaryEmailHash: Uint8Array;
  beneficiaryZkSub?: string | null;
}

export function buildCreateAndSealTx(p: CreateVaultParams): Transaction {
  const tx = new Transaction();
  const blobIdBytes = Array.from(new TextEncoder().encode(p.blobId));

  tx.moveCall({
    target: `${KEEPRA_PKG}::vault::create_and_seal`,
    arguments: [
      tx.pure.vector('u8', blobIdBytes), // walrus_blob_id
      tx.pure.option('id', p.blobObjectId ?? null), // walrus_blob_object_id
      tx.pure.vector('u8', Array.from(p.sealIdBytes)), // seal_id
      tx.pure.u8(p.threshold),
      tx.pure.vector('id', p.keyServerIds ?? []), // key_server_ids
      tx.pure.u64(BigInt(p.inactivitySeconds)),
      tx.pure.vector('address', p.guardianSet),
      tx.pure.u8(p.guardianQuorum),
      tx.pure.option('id', p.daoId ?? null),
      tx.pure.option('u64', p.daoThreshold != null ? BigInt(p.daoThreshold) : null),
      tx.pure.vector('u8', Array.from(p.beneficiaryEmailHash)),
      tx.pure.option('string', p.beneficiaryZkSub ?? null),
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}

export function buildHeartbeatTx(logId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${KEEPRA_PKG}::heartbeat::heartbeat`,
    arguments: [tx.object(logId), tx.object(CLOCK_ID)],
  });
  return tx;
}

export function buildRevokeTx(logId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${KEEPRA_PKG}::vault::revoke_vault`,
    arguments: [tx.object(logId), tx.object(CLOCK_ID)],
  });
  return tx;
}

export function buildAttestTx(capId: string, logId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${KEEPRA_PKG}::guardian::attest`,
    arguments: [tx.object(capId), tx.object(logId), tx.object(CLOCK_ID)],
  });
  return tx;
}

// ─── DAO Release Oracle (keepra::simple_voting + dao_release + adapter) ───

/** simple_voting::create_dao(name, members, threshold). */
export function buildCreateDaoTx(name: string, members: string[], threshold: number): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${KEEPRA_PKG}::simple_voting::create_dao`,
    arguments: [
      tx.pure.string(name),
      tx.pure.vector('address', members),
      tx.pure.u64(BigInt(threshold)),
    ],
  });
  return tx;
}

/** dao_release::propose(vault, clock) — opens a shared DAOReleaseRequest for a DAO-configured vault. */
export function buildProposeReleaseTx(vaultId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${KEEPRA_PKG}::dao_release::propose`,
    arguments: [tx.object(vaultId), tx.object(CLOCK_ID)],
  });
  return tx;
}

/** simple_voting::propose(dao, target) — opens a VotingProposal targeting the release request. */
export function buildProposeVotingTx(daoId: string, targetId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${KEEPRA_PKG}::simple_voting::propose`,
    arguments: [tx.object(daoId), tx.pure.id(targetId)],
  });
  return tx;
}

/** simple_voting::vote(dao, proposal, yes). */
export function buildVoteTx(daoId: string, proposalId: string, yes: boolean): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${KEEPRA_PKG}::simple_voting::vote`,
    arguments: [tx.object(daoId), tx.object(proposalId), tx.pure.bool(yes)],
  });
  return tx;
}

/** dao_adapter_simple_voting::execute_release(req, log, dao, prop, clock) — flips dao_released. */
export function buildExecuteReleaseTx(args: {
  requestId: string;
  logId: string;
  daoId: string;
  proposalId: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${KEEPRA_PKG}::dao_adapter_simple_voting::execute_release`,
    arguments: [
      tx.object(args.requestId),
      tx.object(args.logId),
      tx.object(args.daoId),
      tx.object(args.proposalId),
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}

/**
 * Serializes the seal_approve_release PTB (transaction-kind only). Key servers
 * dry-run these bytes; the PTB is never executed.
 */
export async function buildSealApproveKind(args: {
  sealIdBytes: Uint8Array;
  vaultId: string;
  logId: string;
  sender: string;
  suiClient: SuiJsonRpcClient;
}): Promise<Uint8Array> {
  const tx = new Transaction();
  tx.setSender(args.sender);
  tx.moveCall({
    target: `${KEEPRA_PKG}::policy::seal_approve_release`,
    arguments: [
      tx.pure.vector('u8', Array.from(args.sealIdBytes)),
      tx.object(args.vaultId),
      tx.object(args.logId),
      tx.object(CLOCK_ID),
    ],
  });
  return tx.build({ client: args.suiClient, onlyTransactionKind: true });
}

/** SHA-256 of a normalized email — matches the on-chain beneficiary_email_hash. */
export async function emailHash(email: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(email.trim().toLowerCase());
  const digest = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(digest);
}
