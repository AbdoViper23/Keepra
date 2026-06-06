'use client';

import { useState } from 'react';
import { useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SuiObjectResponse } from '@mysten/sui/jsonRpc';
import { toast } from 'sonner';

import {
  buildCreateDaoTx,
  buildExecuteReleaseTx,
  buildProposeReleaseTx,
  buildProposeVotingTx,
  buildVoteTx,
} from '@/lib/ptb';
import { parseMoveAbort } from '@/lib/errors';

function fields(obj: SuiObjectResponse): Record<string, unknown> {
  const c = obj.data?.content;
  return c?.dataType === 'moveObject' ? (c.fields as Record<string, unknown>) : {};
}

function createdId(changes: unknown[] | null | undefined, suffix: string): string {
  const ch = (changes ?? []).find(
    (c): c is { type: 'created'; objectId: string; objectType: string } =>
      typeof c === 'object' &&
      c !== null &&
      (c as { type?: string }).type === 'created' &&
      ((c as { objectType?: string }).objectType ?? '').endsWith(suffix),
  );
  return ch ? ch.objectId : '';
}

/** Create a SimpleVoting DAO; returns the new DAO object id. */
export function useCreateDao() {
  const { mutateAsync } = useSignAndExecuteTransaction();
  const client = useSuiClient();
  const [isPending, setIsPending] = useState(false);

  async function createDao(
    name: string,
    members: string[],
    threshold: number,
  ): Promise<string | null> {
    setIsPending(true);
    try {
      const { digest } = await mutateAsync({
        transaction: buildCreateDaoTx(name, members, threshold),
      });
      const full = await client.waitForTransaction({
        digest,
        options: { showObjectChanges: true, showEffects: true },
      });
      if (full.effects?.status.status !== 'success') {
        throw new Error(full.effects?.status.error ?? 'Transaction failed');
      }
      const daoId = createdId(full.objectChanges, '::simple_voting::VotingDAO');
      toast.success('DAO created.');
      return daoId || null;
    } catch (e) {
      toast.error(parseMoveAbort(e).message);
      return null;
    } finally {
      setIsPending(false);
    }
  }

  return { createDao, isPending };
}

/** Open a DAO release request for a vault + a voting proposal targeting it. */
export function useProposeRelease() {
  const { mutateAsync } = useSignAndExecuteTransaction();
  const client = useSuiClient();
  const [isPending, setIsPending] = useState(false);

  async function proposeRelease(
    vaultId: string,
    daoId: string,
  ): Promise<{ requestId: string; proposalId: string } | null> {
    setIsPending(true);
    try {
      // 1. Open the shared DAOReleaseRequest.
      const r1 = await mutateAsync({ transaction: buildProposeReleaseTx(vaultId) });
      const f1 = await client.waitForTransaction({
        digest: r1.digest,
        options: { showObjectChanges: true, showEffects: true },
      });
      if (f1.effects?.status.status !== 'success') {
        throw new Error(f1.effects?.status.error ?? 'Propose failed');
      }
      const requestId = createdId(f1.objectChanges, '::dao_release::DAOReleaseRequest');
      if (!requestId) throw new Error('Release request was not created.');

      // 2. Open a voting proposal targeting the request.
      const r2 = await mutateAsync({ transaction: buildProposeVotingTx(daoId, requestId) });
      const f2 = await client.waitForTransaction({
        digest: r2.digest,
        options: { showObjectChanges: true, showEffects: true },
      });
      if (f2.effects?.status.status !== 'success') {
        throw new Error(f2.effects?.status.error ?? 'Voting proposal failed');
      }
      const proposalId = createdId(f2.objectChanges, '::simple_voting::VotingProposal');
      if (!proposalId) throw new Error('Voting proposal was not created.');

      toast.success('DAO release proposed.');
      return { requestId, proposalId };
    } catch (e) {
      toast.error(parseMoveAbort(e).message);
      return null;
    } finally {
      setIsPending(false);
    }
  }

  return { proposeRelease, isPending };
}

export interface ProposalView {
  proposalId: string;
  daoId: string;
  requestId: string;
  vaultId: string;
  logId: string;
  daoName: string;
  members: string[];
  threshold: number;
  yesCount: number;
  noCount: number;
  passed: boolean;
  executed: boolean;
}

/** Reads a VotingProposal → its DAOReleaseRequest → the DAO, for the release console. */
export function useProposalView(proposalId?: string) {
  const client = useSuiClient();

  return useQuery({
    queryKey: ['dao-proposal', proposalId],
    enabled: Boolean(proposalId),
    refetchInterval: 10_000,
    queryFn: async (): Promise<ProposalView> => {
      const propObj = await client.getObject({ id: proposalId!, options: { showContent: true } });
      const pf = fields(propObj);
      const daoId = String(pf.dao_id ?? '');
      const requestId = String(pf.target ?? '');
      const yesCount = Array.isArray(pf.yes_votes) ? pf.yes_votes.length : 0;
      const noCount = Array.isArray(pf.no_votes) ? pf.no_votes.length : 0;
      const propExecuted = Boolean(pf.executed);

      const [daoObj, reqObj] = await Promise.all([
        client.getObject({ id: daoId, options: { showContent: true } }),
        client.getObject({ id: requestId, options: { showContent: true } }),
      ]);
      const df = fields(daoObj);
      const rf = fields(reqObj);
      const threshold = Number(df.threshold ?? 0);

      return {
        proposalId: proposalId!,
        daoId,
        requestId,
        vaultId: String(rf.vault_id ?? ''),
        logId: String(rf.log_id ?? ''),
        daoName: typeof df.name === 'string' ? df.name : '',
        members: Array.isArray(df.members) ? df.members.map(String) : [],
        threshold,
        yesCount,
        noCount,
        passed: threshold > 0 && yesCount >= threshold,
        executed: propExecuted || Boolean(rf.executed),
      };
    },
  });
}

export function useVote(daoId: string, proposalId: string) {
  const { mutateAsync } = useSignAndExecuteTransaction();
  const client = useSuiClient();
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);

  async function vote(yes: boolean) {
    setIsPending(true);
    try {
      const { digest } = await mutateAsync({ transaction: buildVoteTx(daoId, proposalId, yes) });
      await client.waitForTransaction({ digest });
      toast.success(yes ? 'Voted to release.' : 'Voted against.');
      await queryClient.invalidateQueries({ queryKey: ['dao-proposal', proposalId] });
      return true;
    } catch (e) {
      toast.error(parseMoveAbort(e).message);
      return false;
    } finally {
      setIsPending(false);
    }
  }

  return { vote, isPending };
}

export function useExecuteRelease(proposalId: string) {
  const { mutateAsync } = useSignAndExecuteTransaction();
  const client = useSuiClient();
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);

  async function execute(args: {
    requestId: string;
    logId: string;
    daoId: string;
    proposalId: string;
  }) {
    setIsPending(true);
    try {
      const { digest } = await mutateAsync({ transaction: buildExecuteReleaseTx(args) });
      await client.waitForTransaction({ digest });
      toast.success('Release executed — the vault is now unlocked.');
      await queryClient.invalidateQueries({ queryKey: ['dao-proposal', proposalId] });
      await queryClient.invalidateQueries({ queryKey: ['vault'] });
      return true;
    } catch (e) {
      toast.error(parseMoveAbort(e).message);
      return false;
    } finally {
      setIsPending(false);
    }
  }

  return { execute, isPending };
}
