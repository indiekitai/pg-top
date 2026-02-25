import { PgQueries } from './queries.js';
import type { Activity, LockInfo, DbStats, MonitorOptions, SortKey } from './types.js';
import {
  clearScreen, hideCursor, showCursor,
  renderHeader, renderActivityTable, renderLockTable, renderSnapshot, renderSnapshotText,
} from './display.js';

/**
 * High-level PostgreSQL monitor. Supports interactive TUI and snapshot modes.
 */
export class PgMonitor {
  private queries: PgQueries;
  private opts: Required<MonitorOptions>;
  private running = false;
  private selectedIdx = 0;
  private sortKey: SortKey = 'duration';
  private activities: Activity[] = [];
  private locks: LockInfo[] = [];
  private stats: DbStats | null = null;

  constructor(opts: MonitorOptions) {
    this.opts = {
      refreshInterval: 2,
      noIdle: false,
      snapshot: false,
      json: false,
      ...opts,
    };
    this.queries = new PgQueries(opts.connectionString);
  }

  async refresh(): Promise<{ activities: Activity[]; locks: LockInfo[]; stats: DbStats }> {
    const [activities, locks, stats] = await Promise.all([
      this.queries.getActivity(this.opts.noIdle),
      this.queries.getLocks(),
      this.queries.getStats(),
    ]);
    this.activities = activities;
    this.locks = locks;
    this.stats = stats;
    return { activities, locks, stats };
  }

  /** Run in snapshot mode: single fetch, print, exit. Returns JSON if `json` option is set, otherwise plain text. */
  async runSnapshot(): Promise<string> {
    const { activities, locks, stats } = await this.refresh();
    const output = this.opts.json
      ? renderSnapshot(activities, locks, stats)
      : renderSnapshotText(activities, locks, stats);
    await this.queries.close();
    return output;
  }

  /** Run interactive TUI */
  async runInteractive(): Promise<void> {
    this.running = true;
    const stdin = process.stdin;
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    process.stdout.write(hideCursor());

    const handleKey = async (key: string) => {
      const ch = key.charCodeAt(0);
      if (key === 'q' || ch === 3 /* Ctrl-C */) {
        this.running = false;
        return;
      }
      if (key === 'c') {
        const pid = this.activities[this.selectedIdx]?.pid;
        if (pid) await this.queries.cancelQuery(pid);
      }
      if (key === 'k') {
        const pid = this.activities[this.selectedIdx]?.pid;
        if (pid) await this.queries.terminateBackend(pid);
      }
      // Arrow keys come as escape sequences
      if (key === '\x1b[A' || key === 'K') { // up
        this.selectedIdx = Math.max(0, this.selectedIdx - 1);
      }
      if (key === '\x1b[B' || key === 'j') { // down
        this.selectedIdx = Math.min(this.activities.length - 1, this.selectedIdx + 1);
      }
      if (key === 's') {
        const keys: SortKey[] = ['duration', 'pid', 'state'];
        const idx = keys.indexOf(this.sortKey);
        this.sortKey = keys[(idx + 1) % keys.length];
      }
    };

    stdin.on('data', handleKey);

    try {
      while (this.running) {
        await this.refresh();
        this.draw();
        await sleep(this.opts.refreshInterval * 1000);
      }
    } finally {
      stdin.removeListener('data', handleKey);
      stdin.setRawMode?.(false);
      stdin.pause();
      process.stdout.write(showCursor());
      process.stdout.write(clearScreen());
      await this.queries.close();
    }
  }

  private draw(): void {
    const cols = process.stdout.columns || 120;
    const rows = process.stdout.rows || 40;
    const maxActivities = Math.max(5, rows - 8);

    if (this.selectedIdx >= this.activities.length) {
      this.selectedIdx = Math.max(0, this.activities.length - 1);
    }

    const parts: string[] = [clearScreen()];
    if (this.stats) {
      parts.push(renderHeader(this.stats, this.sortKey));
    }
    parts.push(renderActivityTable(this.activities.slice(0, maxActivities), this.selectedIdx, cols));

    if (this.locks.length > 0) {
      parts.push('');
      parts.push(renderLockTable(this.locks.slice(0, 5), cols));
    }

    process.stdout.write(parts.join('\n'));
  }

  async close(): Promise<void> {
    this.running = false;
    await this.queries.close();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
