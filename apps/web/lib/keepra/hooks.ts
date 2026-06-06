'use client';

// Real chain-backed hooks for the UI. This adapter wraps the production hooks in
// `@/hooks/*` (Sui + Seal + Walrus, via dapp-kit + the Tatum RPC proxy) and adds
// the `vaultId` / `logId` aliases the view components read — so the UI stays
// unchanged. Swapped in for the former mock-store implementation.

import { useMemo } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';

import { useVaults } from '@/hooks/useVaults';
import { useVault as useVaultReal, type VaultDetail } from '@/hooks/useVault';
import { useCreateVault } from '@/hooks/useCreateVault';
import { useAttest, useGuardianCaps, useHeartbeat, useRevoke } from '@/hooks/useVaultActions';
import { useClaim } from '@/hooks/useClaim';

export {
  useVaults,
  useCreateVault,
  useHeartbeat,
  useRevoke,
  useAttest,
  useGuardianCaps,
  useClaim,
  useCurrentAccount,
};

/** Real VaultDetail plus the `vaultId` / `logId` aliases the UI components read. */
export type UiVaultDetail = VaultDetail & {
  vault: VaultDetail['vault'] & { vaultId: string };
  log: VaultDetail['log'] & { logId: string };
};

/**
 * Fetches a vault + its heartbeat log from chain, exposing both the real fields
 * (`vault.id`, `log.id`, `vault.sealId`, …) and the UI aliases (`vaultId`,
 * `logId`). The returned object stays assignable to the real `VaultDetail`, so
 * it can be passed straight into `useClaim().claim(...)`.
 */
export function useVault(vaultId?: string) {
  const query = useVaultReal(vaultId);

  const data = useMemo<UiVaultDetail | undefined>(() => {
    if (!query.data) return undefined;
    return {
      ...query.data,
      vault: { ...query.data.vault, vaultId: query.data.vault.id },
      log: { ...query.data.log, logId: query.data.log.id },
    };
  }, [query.data]);

  return { ...query, data };
}
