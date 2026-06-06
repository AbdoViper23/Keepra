export function truncateId(id: string, head = 6, tail = 4): string {
  if (!id) return '';
  if (id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

export function formatBlobId(blobId: string): string {
  return truncateId(blobId, 8, 6);
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Ready';
  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${String(mins).padStart(2, '0')}m`;
  if (mins > 0) return `${mins}m ${String(secs).padStart(2, '0')}s`;
  return `${secs}s`;
}

export type CountdownColor = 'success' | 'warning' | 'destructive';

export function countdownColor(ms: number): CountdownColor {
  const days = ms / (1000 * 60 * 60 * 24);
  if (days > 7) return 'success';
  if (days >= 1) return 'warning';
  return 'destructive';
}

export function bytesToSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function isValidSuiAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(addr.trim());
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
