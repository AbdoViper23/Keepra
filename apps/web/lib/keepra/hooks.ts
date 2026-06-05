'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  attestMock,
  claimMock,
  createVaultMock,
  getVaultDetail,
  listGuardianCaps,
  listVaults,
  revokeMock,
  sendHeartbeatMock,
  useCurrentAccount,
} from './mock-store';
import type {
  ClaimPhase,
  CreatePhase,
  CreateVaultInput,
  DecodedPayload,
  VaultDetail,
  VaultSummary,
} from './types';

// Re-export the mock wallet hook so components can mirror the dapp-kit API.
export { useCurrentAccount };

/** Auto-rerender every `ms` so live countdowns tick. */
function useTick(ms: number) {
  const [, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

export function useVaults(): {
  data?: VaultSummary[];
  isLoading: boolean;
  error: Error | null;
} {
  const account = useCurrentAccount();
  useTick(15000);
  if (!account) return { data: undefined, isLoading: false, error: null };
  return { data: listVaults(account.address), isLoading: false, error: null };
}

export function useVault(vaultId?: string): {
  data?: VaultDetail;
  isLoading: boolean;
  error: Error | null;
} {
  useTick(1000);
  if (!vaultId) return { data: undefined, isLoading: false, error: null };
  const data = getVaultDetail(vaultId);
  return { data: data ?? undefined, isLoading: false, error: null };
}

export function useGuardianCaps(): { data?: { capId: string; vaultId: string }[] } {
  const account = useCurrentAccount();
  if (!account) return { data: [] };
  return { data: listGuardianCaps(account.address) };
}

// ----- writes -----

export function useCreateVault() {
  const [phase, setPhase] = useState<CreatePhase>('idle');
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (input: CreateVaultInput) => {
    setError(null);
    setPhase('encrypting');
    try {
      const res = await createVaultMock(input, (p) => setPhase(p));
      setPhase('done');
      return res;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setError(msg);
      setPhase('error');
      throw e;
    }
  }, []);

  const reset = useCallback(() => {
    setPhase('idle');
    setError(null);
  }, []);

  return { create, phase, error, reset };
}

function useMutation<TArgs extends unknown[]>(
  fn: (...args: TArgs) => Promise<boolean>,
  successMsg: string,
) {
  const [isPending, setPending] = useState(false);
  const run = useCallback(
    async (...args: TArgs) => {
      setPending(true);
      try {
        const ok = await fn(...args);
        if (ok) toast.success(successMsg);
        return ok;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Transaction failed';
        toast.error(msg);
        return false;
      } finally {
        setPending(false);
      }
    },
    [fn, successMsg],
  );
  return { run, isPending };
}

export function useHeartbeat(vaultId: string, _logId: string) {
  const { run, isPending } = useMutation(
    async () => sendHeartbeatMock(vaultId),
    'Heartbeat sent — timer reset.',
  );
  return { sendHeartbeat: run, isPending };
}

export function useRevoke(vaultId: string, _logId: string) {
  const { run, isPending } = useMutation(
    async () => revokeMock(vaultId),
    'Vault revoked. It can no longer be opened.',
  );
  return { revoke: run, isPending };
}

export function useAttest(vaultId: string, _capId: string, _logId: string) {
  const { run, isPending } = useMutation(async () => attestMock(vaultId), 'Attestation recorded.');
  return { attest: run, isPending };
}

export function useClaim() {
  const [phase, setPhase] = useState<ClaimPhase>('idle');
  const [error, setError] = useState<string | null>(null);

  const claim = useCallback(async (detail: VaultDetail): Promise<DecodedPayload> => {
    setError(null);
    setPhase('authorizing');
    try {
      const payload = await claimMock(detail, (p) => setPhase(p));
      setPhase('done');
      return payload;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setError(msg);
      setPhase('error');
      throw e;
    }
  }, []);

  return { claim, phase, error };
}
