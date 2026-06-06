// Invariant I6: the wizard warns (does not block) when the payload looks like a
// raw BIP-39 seed phrase or private key. This is a structural heuristic — we do
// not ship the full 2048-word list; for a non-blocking warning the shape of the
// input (word count, casing, length) plus key patterns is sufficient and honest.

const MNEMONIC_LENGTHS = new Set([12, 15, 18, 21, 24]);
const BIP39_WORD = /^[a-z]{3,8}$/;
const HEX_PRIVKEY = /\b[0-9a-fA-F]{64}\b/;
const SUI_PRIVKEY = /\bsuiprivkey1[a-z0-9]{60,}\b/i;

export interface SeedPhraseSignal {
  isLikely: boolean;
  matchedWordCount: number;
  reason?: string;
}

export function looksLikeSeedPhrase(text: string): SeedPhraseSignal {
  if (!text) return { isLikely: false, matchedWordCount: 0 };

  if (SUI_PRIVKEY.test(text)) {
    return { isLikely: true, matchedWordCount: 0, reason: 'This looks like a Sui private key.' };
  }
  if (HEX_PRIVKEY.test(text)) {
    return {
      isLikely: true,
      matchedWordCount: 0,
      reason: 'This looks like a raw private key (64 hex chars).',
    };
  }

  const tokens = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { isLikely: false, matchedWordCount: 0 };

  const allWordLike = tokens.every((t) => BIP39_WORD.test(t));
  if (allWordLike && MNEMONIC_LENGTHS.has(tokens.length)) {
    return {
      isLikely: true,
      matchedWordCount: tokens.length,
      reason: `This looks like a ${tokens.length}-word recovery phrase.`,
    };
  }

  // Longest contiguous run of word-like tokens embedded in larger text.
  let run = 0;
  let best = 0;
  for (const t of tokens) {
    if (BIP39_WORD.test(t)) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  if (best >= 11) {
    return {
      isLikely: true,
      matchedWordCount: best,
      reason: `Contains a ${best}-word sequence that resembles a recovery phrase.`,
    };
  }

  return { isLikely: false, matchedWordCount: best };
}
