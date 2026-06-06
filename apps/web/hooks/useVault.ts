'use client';

import { useSuiClient } from '@mysten/dapp-kit';
import { useQuery } from '@tanstack/react-query';

import {
  deriveVaultState,
  parseLog,
  parseVault,
  type HeartbeatLogView,
  type VaultState,
  type VaultView,
} from '@/lib/vault';

export interface VaultDetail {
  vault: VaultView;
  log: HeartbeatLogView;
  state: VaultState;
  msUntilTrigger: number;
  claimable: boolean;
}

/** Fetches a Vault + its HeartbeatLog and derives the release state. */
export function useVault(vaultId?: string) {
  const client = useSuiClient();

  return useQuery({
    queryKey: ['vault', vaultId],
    enabled: Boolean(vaultId),
    refetchInterval: 15_000,
    queryFn: async (): Promise<VaultDetail> => {
      const vaultObj = await client.getObject({
        id: vaultId!,
        options: { showContent: true },
      });
      const vault = parseVault(vaultObj);

      const logObj = await client.getObject({
        id: vault.heartbeatLogId,
        options: { showContent: true },
      });
      const log = parseLog(logObj);

      return { vault, log, ...deriveVaultState(vault, log) };
    },
  });
}
