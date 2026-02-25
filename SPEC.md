# pg-top - Real-time PostgreSQL Activity Monitor

## Overview
Port of Python's pg_activity (https://github.com/dalibo/pg_activity) to TypeScript.
Like `top` but for PostgreSQL - monitor active queries, locks, and performance in real-time.
Reference code at /tmp/pg_activity/

## Architecture
```
src/
  index.ts       - Public API
  monitor.ts     - Main monitoring loop
  queries.ts     - SQL queries for pg_stat_activity, pg_locks, etc.
  display.ts     - Terminal UI rendering (using ink or raw ANSI)
  formatter.ts   - Format durations, sizes, query text
  types.ts       - TypeScript interfaces
  cli.ts         - CLI entry point
  mcp.ts         - MCP server
```

## Features
- Real-time view of active queries (pg_stat_activity)
- Lock monitoring (pg_locks)
- Database stats (connections, cache hit ratio, TPS)
- Sort by duration, CPU, waiting
- Kill/cancel queries interactively
- Auto-refresh (configurable interval)

## CLI
```bash
# Monitor local database
npx @indiekit/pg-top postgresql://localhost/mydb

# With options
npx @indiekit/pg-top --refresh 2 --no-idle postgresql://localhost/mydb

# Snapshot mode (non-interactive, for CI)
npx @indiekit/pg-top --snapshot --json postgresql://localhost/mydb
```

## Display (simplified TUI)
Don't use a full TUI framework. Use raw ANSI escape codes for:
- Clear screen + cursor positioning
- Color output (similar to top/htop style)
- Column-based table layout
- Header with db stats, body with query list

```
pg-top — mydb@localhost:5432 — 15 connections — 99.5% cache hit — 1.2k TPS
─────────────────────────────────────────────────────────────────────────────
 PID    | Duration | State  | Wait   | Query
 12345  | 2.3s     | active |        | SELECT * FROM users WHERE...
 12346  | 15.2s    | active | lock   | UPDATE orders SET status...
 12347  | 0.1s     | idle   |        |
```

## Key Reference Files
- /tmp/pg_activity/pgactivity/activities.py - Activity queries and processing
- /tmp/pg_activity/pgactivity/pg.py - PG connection and queries
- /tmp/pg_activity/pgactivity/ui.py - UI rendering

## MCP Server Tools
- get_activity: Current active queries
- get_locks: Lock information
- get_stats: Database statistics
- cancel_query: Cancel a query by PID
- terminate_backend: Kill a connection by PID

## Testing
Test against local PG. For activity, run some long queries in background.

## Package: @indiekit/pg-top, ESM+CJS, vitest, tsup, zero deps (only pg)
