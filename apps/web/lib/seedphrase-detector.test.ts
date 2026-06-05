import { describe, expect, it } from 'vitest';

import { looksLikeSeedPhrase } from './seedphrase-detector';

describe('seedphrase detector', () => {
  it('flags a 12-word mnemonic', () => {
    const phrase = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
    expect(looksLikeSeedPhrase(phrase).isLikely).toBe(true);
  });

  it('flags a 24-word mnemonic', () => {
    const phrase = Array.from({ length: 24 }, () => 'abandon').join(' ');
    const r = looksLikeSeedPhrase(phrase);
    expect(r.isLikely).toBe(true);
    expect(r.matchedWordCount).toBe(24);
  });

  it('flags a raw hex private key', () => {
    expect(
      looksLikeSeedPhrase(
        'here it is abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'.slice(0),
      ).isLikely,
    ).toBe(true);
  });

  it('flags a suiprivkey bech32 key', () => {
    const key = 'suiprivkey1' + 'q'.repeat(64);
    expect(looksLikeSeedPhrase(key).isLikely).toBe(true);
  });

  it('does not flag ordinary prose', () => {
    const prose = 'Dear Maya, I love you and I want you to have the house and everything in it.';
    expect(looksLikeSeedPhrase(prose).isLikely).toBe(false);
  });

  it('does not flag an empty string', () => {
    expect(looksLikeSeedPhrase('').isLikely).toBe(false);
  });
});
