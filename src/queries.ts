import pg from 'pg';
import type { Activity, LockInfo, DbStats } from './types.js';

/**
 * Low-level PostgreSQL monitoring queries.
 * Wraps pg_stat_activity, pg_locks, and pg_stat_database.
 */
export class PgQueries {
  private pool: pg.Pool;
  private prevStats: { xact_commit: number; xact_rollback: number; epoch: number } | null = null;

  /** Create a new query executor with a connection pool (max 2 connections). */
  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString, max: 2 });
  }

  /** Fetch current activity from pg_stat_activity, ordered by duration descending. */
  async getActivity(noIdle = false): Promise<Activity[]> {
    const stateFilter = noIdle
      ? `AND state NOT IN ('idle', 'disabled')`
      : '';
    const { rows } = await this.pool.query<Activity>(`
      SELECT
        pid,
        datname,
        usename,
        application_name,
        client_addr::text,
        client_port,
        backend_start::text,
        xact_start::text,
        query_start::text,
        state_change::text,
        wait_event_type,
        wait_event,
        state,
        backend_type,
        query,
        EXTRACT(EPOCH FROM (clock_timestamp() - COALESCE(query_start, backend_start)))::float AS duration_seconds,
        CASE WHEN EXISTS (
          SELECT 1 FROM pg_catalog.pg_attribute
          WHERE attrelid = 'pg_stat_activity'::regclass AND attname = 'leader_pid'
        ) THEN leader_pid ELSE NULL END AS leader_pid
      FROM pg_stat_activity
      WHERE pid != pg_backend_pid()
        ${stateFilter}
      ORDER BY duration_seconds DESC NULLS LAST
    `);
    return rows;
  }

  /** Fetch lock contention info: ungranted locks and exclusive locks. */
  async getLocks(): Promise<LockInfo[]> {
    const { rows } = await this.pool.query<LockInfo>(`
      SELECT
        l.pid,
        l.locktype,
        l.mode,
        l.granted,
        a.datname,
        a.usename,
        CASE WHEN l.relation IS NOT NULL
          THEN l.relation::regclass::text
          ELSE NULL
        END AS relation_name,
        a.query,
        a.wait_event_type,
        a.wait_event,
        EXTRACT(EPOCH FROM (clock_timestamp() - a.query_start))::float AS duration_seconds
      FROM pg_locks l
      JOIN pg_stat_activity a ON a.pid = l.pid
      WHERE NOT l.granted OR l.mode LIKE '%Exclusive%'
      ORDER BY a.query_start ASC NULLS LAST
    `);
    return rows;
  }

  /** Fetch aggregated database stats: connections, cache hit ratio, TPS, size. */
  async getStats(): Promise<DbStats> {
    // Connection info
    const connResult = await this.pool.query(`
      SELECT
        version() AS version,
        current_setting('listen_addresses') AS hostname,
        current_setting('port')::int AS port,
        current_database() AS dbname,
        current_setting('max_connections')::int AS max_connections
    `);
    const conn = connResult.rows[0];

    // Connection state counts
    const stateResult = await this.pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE state = 'active') AS active_connections,
        COUNT(*) FILTER (WHERE state = 'idle') AS idle_connections,
        COUNT(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_transaction,
        COUNT(*) AS total_connections
      FROM pg_stat_activity
      WHERE pid != pg_backend_pid()
    `);
    const states = stateResult.rows[0];

    // Database stats
    const dbResult = await this.pool.query(`
      SELECT
        COALESCE(SUM(xact_commit), 0)::bigint AS xact_commit,
        COALESCE(SUM(xact_rollback), 0)::bigint AS xact_rollback,
        COALESCE(SUM(blks_read), 0)::bigint AS blks_read,
        COALESCE(SUM(blks_hit), 0)::bigint AS blks_hit
      FROM pg_stat_database
    `);
    const db = dbResult.rows[0];

    // Size & uptime
    const metaResult = await this.pool.query(`
      SELECT
        pg_database_size(current_database()) AS total_size_bytes,
        EXTRACT(EPOCH FROM (clock_timestamp() - pg_postmaster_start_time()))::float AS uptime_seconds
    `);
    const meta = metaResult.rows[0];

    // Cache hit ratio
    const totalBlks = Number(db.blks_read) + Number(db.blks_hit);
    const cacheHitRatio = totalBlks > 0
      ? Number(db.blks_hit) / totalBlks * 100
      : null;

    // TPS calculation
    const now = Date.now() / 1000;
    const totalXact = Number(db.xact_commit) + Number(db.xact_rollback);
    let tps: number | null = null;
    if (this.prevStats) {
      const elapsed = now - this.prevStats.epoch;
      if (elapsed > 0) {
        const prevTotal = this.prevStats.xact_commit + this.prevStats.xact_rollback;
        tps = Math.round((totalXact - prevTotal) / elapsed);
      }
    }
    this.prevStats = { xact_commit: Number(db.xact_commit), xact_rollback: Number(db.xact_rollback), epoch: now };

    return {
      version: conn.version,
      hostname: conn.hostname,
      port: conn.port,
      dbname: conn.dbname,
      active_connections: Number(states.active_connections),
      idle_connections: Number(states.idle_connections),
      idle_in_transaction: Number(states.idle_in_transaction),
      total_connections: Number(states.total_connections),
      max_connections: conn.max_connections,
      cache_hit_ratio: cacheHitRatio !== null ? Math.round(cacheHitRatio * 100) / 100 : null,
      tps,
      size_evolution: null,
      total_size_bytes: Number(meta.total_size_bytes),
      uptime_seconds: Number(meta.uptime_seconds),
      xact_commit: Number(db.xact_commit),
      xact_rollback: Number(db.xact_rollback),
      blks_read: Number(db.blks_read),
      blks_hit: Number(db.blks_hit),
    };
  }

  /** Cancel a running query by PID via pg_cancel_backend. */
  async cancelQuery(pid: number): Promise<boolean> {
    const { rows } = await this.pool.query('SELECT pg_cancel_backend($1) AS ok', [pid]);
    return rows[0]?.ok === true;
  }

  /** Terminate a backend connection by PID via pg_terminate_backend. */
  async terminateBackend(pid: number): Promise<boolean> {
    const { rows } = await this.pool.query('SELECT pg_terminate_backend($1) AS ok', [pid]);
    return rows[0]?.ok === true;
  }

  /** Close the connection pool. */
  async close(): Promise<void> {
    await this.pool.end();
  }
}
