'use client';

import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { useQuery } from '@tanstack/react-query';

import { KEEPRA_PKG } from '@/lib/sui';
import { vecU8ToBytes } from '@/lib/vault';

export interface VaultSummary {
  vaultId: string;
  heartbeatLogId: string;
  blobId: string;
  createdAtMs: number;
}

/**
 * Lists the connected owner's vaults. Frozen Vaults are not "owned", so we
 * discover them via VaultCreated events and filter by owner.
 */
export function useVaults() {
  const account = useCurrentAccount();
  const client = useSuiClient();

  return useQuery({
    queryKey: ['vaults-by-owner', account?.address],
    enabled: Boolean(account),
    refetchInterval: 15_000,
    queryFn: async (): Promise<VaultSummary[]> => {
      const res = await client.queryEvents({
        query: { MoveEventType: `${KEEPRA_PKG}::events::VaultCreated` },
        order: 'descending',
        limit: 50,
      });

      return res.data
        .map((e) => e.parsedJson as Record<string, unknown>)
        .filter((p) => p && p.owner === account!.address)
        .map((p) => ({
          vaultId: String(p.vault_id ?? ''),
          heartbeatLogId: String(p.heartbeat_log_id ?? ''),
          blobId: new TextDecoder().decode(vecU8ToBytes(p.blob_id)),
          createdAtMs: Number(p.created_at_ms ?? 0),
        }));
    },
  });
}
