'use client';

import { useState } from 'react';
import { useCurrentAccount, useSignPersonalMessage, useSuiClient } from '@mysten/dapp-kit';

import { createSessionKey, decryptVault } from '@/lib/seal';
import { buildSealApproveKind } from '@/lib/ptb';
import { downloadCiphertext } from '@/lib/walrus';
import { decodePayload, type DecodedPayload } from '@/lib/payload';
import { parseMoveAbort } from '@/lib/errors';
import type { VaultDetail } from '@/hooks/useVault';

export type ClaimPhase = 'idle' | 'authorizing' | 'fetching' | 'decrypting' | 'done' | 'error';

export function useClaim() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();

  const [phase, setPhase] = useState<ClaimPhase>('idle');
  const [error, setError] = useState<string | null>(null);

  async function claim(detail: VaultDetail): Promise<DecodedPayload> {
    if (!account) throw new Error('Connect a wallet to open this vault.');
    setError(null);

    try {
      // 1. Session key — authorize decryption with a single wallet signature.
      setPhase('authorizing');
      const sessionKey = await createSessionKey(account.address, client);
      const { signature } = await signPersonalMessage({
        message: sessionKey.getPersonalMessage(),
      });
      sessionKey.setPersonalMessageSignature(signature);

      // 2. Fetch ciphertext from Walrus + build the seal_approve PTB in parallel.
      setPhase('fetching');
      const [encrypted, txBytes] = await Promise.all([
        downloadCiphertext(detail.vault.blobId),
        buildSealApproveKind({
          sealIdBytes: detail.vault.sealId,
          vaultId: detail.vault.id,
          logId: detail.log.id,
          sender: account.address,
          suiClient: client,
        }),
      ]);

      // 3. Decrypt — key servers dry-run seal_approve_release, then release shares.
      setPhase('decrypting');
      const plaintext = await decryptVault({ suiClient: client, encrypted, sessionKey, txBytes });

      const decoded = decodePayload(plaintext);
      setPhase('done');
      return decoded;
    } catch (e) {
      setPhase('error');
      const { message } = parseMoveAbort(e);
      setError(message);
      throw new Error(message);
    }
  }

  return { claim, phase, error, reset: () => setPhase('idle') };
}
