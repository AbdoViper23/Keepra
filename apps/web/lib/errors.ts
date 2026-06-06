// Maps Keepra Move abort codes (move/keepra/sources/errors.move) to
// human-friendly messages, and extracts them from Sui execution errors.

export const MOVE_ERRORS: Record<number, string> = {
  0: 'The vault’s release conditions are not yet met.',
  1: 'Only the vault owner can do that.',
  2: 'You are not a guardian of this vault.',
  3: 'This guardian capability does not match the vault.',
  4: 'This vault has been revoked and can no longer be opened.',
  5: 'This vault has already been triggered.',
  6: 'This vault is already revoked.',
  7: 'Invalid guardian quorum.',
  8: 'Quorum cannot exceed the number of guardians.',
  9: 'Invalid inactivity window.',
  10: 'Invalid Seal threshold.',
};

export interface ParsedMoveError {
  code?: number;
  module?: string;
  message: string;
}

/**
 * Pulls a `MoveAbort(... , <code>)` (and the aborting module) out of a Sui error
 * string and maps it to a friendly message. Falls back to the raw message.
 */
export function parseMoveAbort(err: unknown): ParsedMoveError {
  const raw = err instanceof Error ? err.message : String(err);

  // e.g. "MoveAbort(MoveLocation { module: ModuleId { ... name: Identifier(\"policy\") }, ... }, 0)"
  const codeMatch =
    raw.match(/MoveAbort\([^)]*?,\s*(\d+)\)/) ?? raw.match(/abort code[:\s]+(\d+)/i);
  const moduleMatch = raw.match(/Identifier\("([a-z_]+)"\)/) ?? raw.match(/::([a-z_]+)::/);

  if (codeMatch) {
    const code = Number(codeMatch[1]);
    return {
      code,
      module: moduleMatch?.[1],
      message: MOVE_ERRORS[code] ?? `Transaction aborted (code ${code}).`,
    };
  }

  if (/insufficient|gas|balance/i.test(raw)) {
    return { message: 'Not enough SUI to cover gas. Top up your wallet on testnet and retry.' };
  }
  if (/rejected|denied|user reject/i.test(raw)) {
    return { message: 'You declined the transaction in your wallet.' };
  }

  return { message: raw.length > 200 ? `${raw.slice(0, 200)}…` : raw };
}
