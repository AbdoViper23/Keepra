'use client';

import { useState } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { useQueryClient } from '@tanstack/react-query';

import { encryptForVault, generateSealId, SEAL_THRESHOLD } from '@/lib/seal';
import { uploadCiphertext } from '@/lib/walrus';
import { buildCreateAndSealTx, emailHash } from '@/lib/ptb';
import { encodePayload } from '@/lib/payload';
import { parseMoveAbort } from '@/lib/errors';

export type CreatePhase = 'idle' | 'encrypting' | 'uploading' | 'sealing' | 'done' | 'error';

export interface CreateVaultInput {
  text?: string;
  files?: { name: string; mime: string; bytes: Uint8Array }[];
  inactivitySeconds: number;
  guardianAddresses: string[];
  guardianQuorum: number;
  beneficiaryEmail: string;
}

export interface CreateVaultResult {
  vaultId: string;
  heartbeatLogId: string;
  blobId: string;
  digest: string;
}

export function useCreateVault() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<CreatePhase>('idle');
  const [error, setError] = useState<string | null>(null);

  async function create(input: CreateVaultInput): Promise<CreateVaultResult> {
    if (!account) throw new Error('Connect a wallet first.');
    setError(null);

    try {
      // 1. Encrypt the payload envelope with Seal (client-side).
      setPhase('encrypting');
      const payload = encodePayload({ text: input.text, files: input.files });
      const { bytes: sealIdBytes, hex: sealIdHex } = generateSealId();
      const { encryptedObject } = await encryptForVault(client, payload, sealIdHex);

      // 2. Upload ciphertext to Walrus (owner keeps the Blob object).
      setPhase('uploading');
      const { blobId, blobObjectId } = await uploadCiphertext(encryptedObject, account.address);

      // 3. Seal on-chain: create_and_seal freezes the Vault + shares the log.
      setPhase('sealing');
      const beneficiaryEmailHash = await emailHash(
        input.beneficiaryEmail.trim() || 'beneficiary@keepra.app',
      );
      const guardianSet =
        input.guardianAddresses.length > 0 ? input.guardianAddresses : [account.address];

      const tx = buildCreateAndSealTx({
        blobId,
        blobObjectId: blobObjectId ?? null,
        sealIdBytes,
        threshold: SEAL_THRESHOLD,
        keyServerIds: [],
        inactivitySeconds: input.inactivitySeconds,
        guardianSet,
        guardianQuorum: Math.max(1, input.guardianQuorum),
        daoId: null,
        daoThreshold: null,
        beneficiaryEmailHash,
        beneficiaryZkSub: null,
      });

      const { digest } = await signAndExecute({ transaction: tx });
      const full = await client.waitForTransaction({
        digest,
        options: { showObjectChanges: true, showEffects: true },
      });

      if (full.effects?.status.status !== 'success') {
        throw new Error(full.effects?.status.error ?? 'Transaction failed');
      }

      const changes = full.objectChanges ?? [];
      const created = (suffix: string) =>
        changes.find((c) => c.type === 'created' && c.objectType.endsWith(suffix));
      const vaultChange = created('::vault::Vault');
      const logChange = created('::heartbeat::HeartbeatLog');

      if (
        !vaultChange ||
        vaultChange.type !== 'created' ||
        !logChange ||
        logChange.type !== 'created'
      ) {
        throw new Error('Vault sealed, but could not locate the created objects.');
      }

      await queryClient.invalidateQueries({ queryKey: ['vaults-by-owner'] });
      setPhase('done');

      return {
        vaultId: vaultChange.objectId,
        heartbeatLogId: logChange.objectId,
        blobId,
        digest,
      };
    } catch (e) {
      setPhase('error');
      const { message } = parseMoveAbort(e);
      setError(message);
      throw new Error(message);
    }
  }

  return { create, phase, error, reset: () => setPhase('idle') };
}
