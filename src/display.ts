import type { Activity, DbStats, LockInfo, SortKey } from './types.js';
import { formatDuration, formatPct, formatSize, formatTps, truncateQuery } from './formatter.js';

// ANSI helpers
const ESC = '\x1b[';
const RESET = `${ESC}0m`;
const BOLD = `${ESC}1m`;
const DIM = `${ESC}2m`;
const COLORS = {
  red: `${ESC}31m`,
  green: `${ESC}32m`,
  yellow: `${ESC}33m`,
  blue: `${ESC}34m`,
  magenta: `${ESC}35m`,
  cyan: `${ESC}36m`,
  white: `${ESC}37m`,
  bgBlue: `${ESC}44m`,
  bgGray: `${ESC}100m`,
} as const;

function color(c: string, text: string): string {
  return `${c}${text}${RESET}`;
}

function stateColor(state: string | null): string {
  switch (state) {
    case 'active': return COLORS.green;
    case 'idle': return DIM;
    case 'idle in transaction': return COLORS.yellow;
    case 'idle in transaction (aborted)': return COLORS.red;
    case 'fastpath function call': return COLORS.cyan;
    default: return '';
  }
}

function durationColor(seconds: number | null): string {
  if (seconds === null) return '';
  if (seconds > 60) return COLORS.red;
  if (seconds > 10) return COLORS.yellow;
  if (seconds > 1) return COLORS.cyan;
  return '';
}

export function clearScreen(): string {
  return `${ESC}2J${ESC}H`;
}

export function hideCursor(): string {
  return `${ESC}?25l`;
}

export function showCursor(): string {
  return `${ESC}?25h`;
}

export function renderHeader(stats: DbStats, sortKey: SortKey): string {
  const lines: string[] = [];
  const title = `${BOLD}pg-top${RESET} — ${color(COLORS.cyan, stats.dbname)}@${stats.hostname}:${stats.port}`;
  const connInfo = `${stats.active_connections} active / ${stats.total_connections} total / ${stats.max_connections} max`;
  const perfInfo = [
    `Cache: ${color(COLORS.green, formatPct(stats.cache_hit_ratio))}`,
    `TPS: ${color(COLORS.yellow, formatTps(stats.tps))}`,
    `Size: ${formatSize(stats.total_size_bytes)}`,
    `Up: ${formatDuration(stats.uptime_seconds)}`,
  ].join('  ');
  
  lines.push(`${title}  —  ${connInfo}`);
  lines.push(perfInfo);
  lines.push(`${DIM}Sort: ${sortKey} | q:quit c:cancel k:kill ↑↓:select${RESET}`);
  lines.push(color(DIM, '─'.repeat(Math.min(process.stdout.columns || 120, 200))));
  return lines.join('\n');
}

export function renderActivityTable(activities: Activity[], selectedIdx: number, cols: number): string {
  const lines: string[] = [];
  
  // Column widths
  const PID_W = 7;
  const DUR_W = 10;
  const STATE_W = 14;
  const WAIT_W = 18;
  const DB_W = 14;
  const USER_W = 14;
  const fixedW = PID_W + DUR_W + STATE_W + WAIT_W + DB_W + USER_W + 6; // 6 for separators
  const queryW = Math.max(20, cols - fixedW);

  // Header
  const hdr = [
    'PID'.padEnd(PID_W),
    'Duration'.padEnd(DUR_W),
    'State'.padEnd(STATE_W),
    'Wait'.padEnd(WAIT_W),
    'Database'.padEnd(DB_W),
    'User'.padEnd(USER_W),
    'Query',
  ].join(' ');
  lines.push(color(`${BOLD}${COLORS.bgBlue}${COLORS.white}`, hdr.padEnd(cols)));

  for (let i = 0; i < activities.length; i++) {
    const a = activities[i];
    const isSelected = i === selectedIdx;
    const prefix = isSelected ? `${ESC}7m` : ''; // reverse video for selection
    const suffix = isSelected ? RESET : '';
    
    const dur = formatDuration(a.duration_seconds);
    const st = (a.state ?? '-').slice(0, STATE_W);
    const wait = a.wait_event ? `${a.wait_event_type}:${a.wait_event}` : '';
    const q = truncateQuery(a.query, queryW);

    const row = [
      color(COLORS.cyan, String(a.pid).padEnd(PID_W)),
      color(durationColor(a.duration_seconds), dur.padEnd(DUR_W)),
      color(stateColor(a.state), st.padEnd(STATE_W)),
      color(DIM, wait.slice(0, WAIT_W).padEnd(WAIT_W)),
      (a.datname ?? '-').slice(0, DB_W).padEnd(DB_W),
      (a.usename ?? '-').slice(0, USER_W).padEnd(USER_W),
      color(DIM, q),
    ].join(' ');

    lines.push(`${prefix}${row}${suffix}`);
  }

  return lines.join('\n');
}

export function renderLockTable(locks: LockInfo[], cols: number): string {
  if (locks.length === 0) return `${DIM}No locks${RESET}`;
  const lines: string[] = [];
  const hdr = ['PID'.padEnd(7), 'Type'.padEnd(14), 'Mode'.padEnd(20), 'Granted'.padEnd(8), 'Relation'.padEnd(20), 'Query'].join(' ');
  lines.push(color(`${BOLD}${COLORS.bgGray}${COLORS.white}`, hdr.padEnd(cols)));

  for (const l of locks) {
    const queryW = Math.max(10, cols - 72);
    const row = [
      String(l.pid).padEnd(7),
      l.locktype.slice(0, 14).padEnd(14),
      color(COLORS.red, l.mode.slice(0, 20).padEnd(20)),
      (l.granted ? 'yes' : color(COLORS.yellow, 'WAIT')).padEnd(8),
      (l.relation_name ?? '-').slice(0, 20).padEnd(20),
      color(DIM, truncateQuery(l.query, queryW)),
    ].join(' ');
    lines.push(row);
  }
  return lines.join('\n');
}

/** Render snapshot as JSON. */
export function renderSnapshot(activities: Activity[], locks: LockInfo[], stats: DbStats): string {
  return JSON.stringify({ stats, activities, locks }, null, 2);
}

/** Render snapshot as human-readable text. */
export function renderSnapshotText(activities: Activity[], locks: LockInfo[], stats: DbStats): string {
  const lines: string[] = [];
  lines.push(`Database: ${stats.dbname} | Connections: ${stats.active_connections} active / ${stats.total_connections} total / ${stats.max_connections} max`);
  lines.push(`Cache: ${formatPct(stats.cache_hit_ratio)} | TPS: ${formatTps(stats.tps)} | Size: ${formatSize(stats.total_size_bytes)} | Uptime: ${formatDuration(stats.uptime_seconds)}`);
  lines.push('');
  lines.push(['PID', 'Duration', 'State', 'User', 'Query'].map((h, i) => h.padEnd([7, 10, 20, 14, 40][i])).join(' '));
  lines.push('-'.repeat(91));
  for (const a of activities) {
    lines.push([
      String(a.pid).padEnd(7),
      formatDuration(a.duration_seconds).padEnd(10),
      (a.state ?? '-').padEnd(20),
      (a.usename ?? '-').padEnd(14),
      truncateQuery(a.query, 60),
    ].join(' '));
  }
  if (locks.length > 0) {
    lines.push('');
    lines.push(`Locks (${locks.length}):`);
    for (const l of locks) {
      lines.push(`  PID ${l.pid} | ${l.mode} on ${l.relation_name ?? '-'} | granted: ${l.granted}`);
    }
  }
  return lines.join('\n');
}
