// Pure display helpers — no side effects, unit-tested.

/** `0x1234abcd…ef12` style truncation for Sui object ids / addresses. */
export function truncateId(id: string, lead = 6, tail = 4): string {
  if (!id) return '';
  if (id.length <= lead + tail + 1) return id;
  return `${id.slice(0, lead)}…${id.slice(-tail)}`;
}

/** Walrus blob ids are base64url and long; show a recognizable head. */
export function formatBlobId(blobId: string, head = 12): string {
  if (!blobId) return '';
  return blobId.length <= head ? blobId : `${blobId.slice(0, head)}…`;
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Human countdown: `12d 4h`, `4h 13m`, `13m 02s`, or `Ready` when elapsed. */
export function formatCountdown(msRemaining: number): string {
  if (msRemaining <= 0) return 'Ready';
  const d = Math.floor(msRemaining / DAY);
  const h = Math.floor((msRemaining % DAY) / HOUR);
  const m = Math.floor((msRemaining % HOUR) / MINUTE);
  const s = Math.floor((msRemaining % MINUTE) / SECOND);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

export type CountdownTone = 'success' | 'warning' | 'destructive';

/** >7d green, 1–7d amber, <24h red. */
export function countdownColor(msRemaining: number): CountdownTone {
  if (msRemaining > 7 * DAY) return 'success';
  if (msRemaining > DAY) return 'warning';
  return 'destructive';
}

export function bytesToSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** i;
  return `${value % 1 === 0 ? value : value.toFixed(1)} ${units[i]}`;
}

/** Convert seconds into the wizard's friendly label. */
export function inactivityLabel(seconds: number): string {
  if (seconds < MINUTE / SECOND) return `${seconds}s`;
  if (seconds < HOUR / SECOND) return `${Math.round(seconds / 60)} min`;
  if (seconds < DAY / SECOND) return `${Math.round(seconds / 3600)} h`;
  return `${Math.round(seconds / 86400)} days`;
}
