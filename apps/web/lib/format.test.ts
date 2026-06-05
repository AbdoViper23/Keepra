import { describe, expect, it } from 'vitest';

import { bytesToSize, countdownColor, formatCountdown, truncateId } from './format';

const DAY = 86_400_000;
const HOUR = 3_600_000;

describe('format helpers', () => {
  it('truncates ids in the middle', () => {
    expect(truncateId('0x1234567890abcdef')).toBe('0x1234…cdef');
    expect(truncateId('0xabc')).toBe('0xabc'); // too short to truncate
  });

  it('formats countdowns by magnitude', () => {
    expect(formatCountdown(-5)).toBe('Ready');
    expect(formatCountdown(0)).toBe('Ready');
    expect(formatCountdown(2 * DAY + 4 * HOUR)).toBe('2d 4h');
    expect(formatCountdown(4 * HOUR + 13 * 60_000)).toBe('4h 13m');
    expect(formatCountdown(13 * 60_000 + 2_000)).toBe('13m 02s');
    expect(formatCountdown(8_000)).toBe('8s');
  });

  it('colors the countdown by urgency', () => {
    expect(countdownColor(8 * DAY)).toBe('success');
    expect(countdownColor(3 * DAY)).toBe('warning');
    expect(countdownColor(2 * HOUR)).toBe('destructive');
  });

  it('formats byte sizes', () => {
    expect(bytesToSize(0)).toBe('0 B');
    expect(bytesToSize(512)).toBe('512 B');
    expect(bytesToSize(2048)).toBe('2 KB');
    expect(bytesToSize(1024 * 1024 * 3)).toBe('3 MB');
  });
});
