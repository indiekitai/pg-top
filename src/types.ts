/** Active query from pg_stat_activity */
export interface Activity {
  pid: number;
  datname: string | null;
  usename: string | null;
  application_name: string;
  client_addr: string | null;
  client_port: number | null;
  backend_start: string | null;
  xact_start: string | null;
  query_start: string | null;
  state_change: string | null;
  wait_event_type: string | null;
  wait_event: string | null;
  state: string | null;
  backend_type: string;
  query: string | null;
  duration_seconds: number | null;
  /** PG 14+ leader_pid */
  leader_pid: number | null;
}

/** Lock info from pg_locks */
export interface LockInfo {
  pid: number;
  locktype: string;
  mode: string;
  granted: boolean;
  datname: string | null;
  usename: string | null;
  relation_name: string | null;
  query: string | null;
  wait_event_type: string | null;
  wait_event: string | null;
  duration_seconds: number | null;
}

/** Database-level stats */
export interface DbStats {
  version: string;
  hostname: string;
  port: number;
  dbname: string;
  active_connections: number;
  idle_connections: number;
  idle_in_transaction: number;
  total_connections: number;
  max_connections: number;
  cache_hit_ratio: number | null;
  tps: number | null;
  /** bytes/sec size evolution */
  size_evolution: number | null;
  total_size_bytes: number;
  uptime_seconds: number;
  xact_commit: number;
  xact_rollback: number;
  blks_read: number;
  blks_hit: number;
}

export interface MonitorOptions {
  connectionString: string;
  refreshInterval?: number; // seconds, default 2
  noIdle?: boolean;
  snapshot?: boolean;
  json?: boolean;
}

export type SortKey = 'duration' | 'cpu' | 'state' | 'pid';
