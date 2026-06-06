'use client';

import { useState } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { KEEPRA_PKG } from '@/lib/sui';
import { buildAttestTx, buildHeartbeatTx, buildRevokeTx } from '@/lib/ptb';
import { parseMoveAbort } from '@/lib/errors';

function useTxAction(vaultId: string) {
  const client = useSuiClient();
  const { mutateAsync } = useSignAndExecuteTransaction();
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);

  async function run(build: () => ReturnType<typeof buildHeartbeatTx>, successMsg: string) {
    setIsPending(true);
    try {
      const { digest } = await mutateAsync({ transaction: build() });
      await client.waitForTransaction({ digest });
      toast.success(successMsg);
      await queryClient.invalidateQueries({ queryKey: ['vault', vaultId] });
      await queryClient.invalidateQueries({ queryKey: ['vaults-by-owner'] });
      return true;
    } catch (e) {
      toast.error(parseMoveAbort(e).message);
      return false;
    } finally {
      setIsPending(false);
    }
  }

  return { run, isPending };
}

export function useHeartbeat(vaultId: string, logId: string) {
  const { run, isPending } = useTxAction(vaultId);
  return {
    isPending,
    sendHeartbeat: () => run(() => buildHeartbeatTx(logId), 'Heartbeat sent — the timer is reset.'),
  };
}

export function useRevoke(vaultId: string, logId: string) {
  const { run, isPending } = useTxAction(vaultId);
  return {
    isPending,
    revoke: () => run(() => buildRevokeTx(logId), 'Vault revoked. It can never be opened.'),
  };
}

export function useAttest(vaultId: string, capId: string, logId: string) {
  const { run, isPending } = useTxAction(vaultId);
  return {
    isPending,
    attest: () => run(() => buildAttestTx(capId, logId), 'Attestation recorded.'),
  };
}

export interface GuardianCapRef {
  capId: string;
  vaultId: string;
}

/** GuardianCaps owned by the connected account (used to attest / demo-trigger). */
export function useGuardianCaps() {
  const account = useCurrentAccount();
  const client = useSuiClient();

  return useQuery({
    queryKey: ['guardian-caps', account?.address],
    enabled: Boolean(account),
    queryFn: async (): Promise<GuardianCapRef[]> => {
      const res = await client.getOwnedObjects({
        owner: account!.address,
        filter: { StructType: `${KEEPRA_PKG}::guardian::GuardianCap` },
        options: { showContent: true },
      });
      return res.data.map((o) => {
        const fields =
          o.data?.content?.dataType === 'moveObject'
            ? (o.data.content.fields as Record<string, unknown>)
            : {};
        return { capId: o.data?.objectId ?? '', vaultId: String(fields.vault_id ?? '') };
      });
    },
  });
}
