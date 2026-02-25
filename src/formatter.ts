/** Format seconds into human-readable duration */
export function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds < 0) return '-';
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}m${s.toString().padStart(2, '0')}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h${m.toString().padStart(2, '0')}m`;
}

/** Format bytes into human-readable size */
export function formatSize(bytes: number): string {
  if (bytes < 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return i === 0 ? `${size} ${units[i]}` : `${size.toFixed(1)} ${units[i]}`;
}

/** Truncate query text, removing newlines */
export function truncateQuery(query: string | null, maxLen: number): string {
  if (!query) return '';
  const cleaned = query.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen - 3) + '...';
}

/** Format a percentage */
export function formatPct(value: number | null, decimals = 1): string {
  if (value === null) return '-';
  return `${value.toFixed(decimals)}%`;
}

/** Format TPS */
export function formatTps(tps: number | null): string {
  if (tps === null) return '-';
  if (tps >= 1000) return `${(tps / 1000).toFixed(1)}k`;
  return String(tps);
}
