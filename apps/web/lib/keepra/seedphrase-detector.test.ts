import { describe, expect, it } from 'vitest';

import { looksLikeSeedPhrase } from './seedphrase-detector';

describe('keepra seedphrase detector', () => {
  it('flags a 12-word phrase from the wordlist', () => {
    const phrase = Array.from({ length: 12 }, () => 'abandon').join(' ');
    expect(looksLikeSeedPhrase(phrase).isLikely).toBe(true);
  });

  it('flags a 24-word short-lowercase phrase by shape (no dictionary hits)', () => {
    const phrase = Array.from({ length: 24 }, () => 'zzz').join(' ');
    expect(looksLikeSeedPhrase(phrase).isLikely).toBe(true);
  });

  it('does not flag a 15-word phrase with no dictionary matches', () => {
    const phrase = Array.from({ length: 15 }, () => 'zzz').join(' ');
    expect(looksLikeSeedPhrase(phrase).isLikely).toBe(false);
  });

  it('does not flag ordinary prose', () => {
    expect(looksLikeSeedPhrase('Dear Maya, everything you need is in the safe.').isLikely).toBe(
      false,
    );
  });

  it('does not flag an empty string', () => {
    expect(looksLikeSeedPhrase('').isLikely).toBe(false);
  });
});
