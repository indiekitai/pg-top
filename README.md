[English](README.md) | [中文](README.zh-CN.md)

# @indiekit/pg-top

[![npm version](https://img.shields.io/npm/v/@indiekit/pg-top)](https://www.npmjs.com/package/@indiekit/pg-top)
[![license](https://img.shields.io/npm/l/@indiekit/pg-top)](./LICENSE)

Real-time PostgreSQL activity monitor — like `top` for Postgres. Built with Node.js, zero native dependencies.

```
pg-top — cutie@localhost:5432  —  3 active / 12 total / 100 max
Cache: 99.8%  TPS: 142  Size: 2.1 GB  Up: 14d03h
Sort: duration | q:quit c:cancel k:kill ↑↓:select
────────────────────────────────────────────────────────────────
PID     Duration   State          Wait               Database       User           Query
▶ 1234  12m05s     active                            mydb           app_user       SELECT * FROM orders WHERE created_at > ...
  1235  3.2s       active         Lock:relation       mydb           admin          UPDATE inventory SET stock = stock - 1 ...
  1236  850ms      active                            mydb           worker         INSERT INTO events (type, payload) VALUE...
  1240  0ms        idle                              mydb           app_user
  1241  0ms        idle                              mydb           app_user
```

## Features

- **Interactive TUI** — real-time dashboard with keyboard navigation
- **Snapshot mode** — single-shot JSON output for CI/scripts/agents
- **Lock monitoring** — shows blocked queries and lock contention
- **Query management** — cancel or terminate queries interactively
- **MCP server** — expose monitoring as tool calls for AI agents
- **Programmatic API** — import and use in your own code
- **Zero native deps** — only `pg` as runtime dependency

## Install

```bash
npm install -g @indiekit/pg-top

# Or as a project dependency
npm install @indiekit/pg-top
```

## CLI Usage

### Interactive mode

```bash
pg-top postgresql://user:pass@localhost/mydb

# Hide idle connections, refresh every second
pg-top --no-idle --refresh 1 postgresql://localhost/mydb
```

### Snapshot mode (CI / Agent friendly)

```bash
# JSON snapshot — perfect for piping to jq or feeding to AI agents
pg-top --snapshot postgresql://localhost/mydb

# Also accepts connection string from environment
export DATABASE_URL=postgresql://localhost/mydb
pg-top --snapshot
```

Output is always JSON in snapshot mode:

```json
{
  "stats": {
    "dbname": "mydb",
    "active_connections": 3,
    "total_connections": 12,
    "max_connections": 100,
    "cache_hit_ratio": 99.8,
    "tps": null,
    "total_size_bytes": 2254857216,
    "uptime_seconds": 1209600
  },
  "activities": [...],
  "locks": [...]
}
```

**Exit codes:**
| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Connection error or missing arguments |

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--refresh <seconds>` | Refresh interval | `2` |
| `--no-idle` | Hide idle connections | off |
| `--snapshot` | Single snapshot then exit (JSON output) | off |
| `--json` | Explicit JSON flag (used with `--snapshot`) | off |
| `-h, --help` | Show help | |

### Keyboard shortcuts (interactive mode)

| Key | Action |
|-----|--------|
| `q` / `Ctrl-C` | Quit |
| `↑` / `↓` | Navigate process list |
| `c` | Cancel selected query (`pg_cancel_backend`) |
| `k` | Kill selected backend (`pg_terminate_backend`) |
| `s` | Cycle sort key (duration → pid → state) |

## MCP Server

pg-top includes an [MCP](https://modelcontextprotocol.io/) server for AI agent integration.

```bash
node dist/mcp.js postgresql://localhost/mydb
```

Communicates over stdio using JSON-RPC 2.0. Available tools:

| Tool | Description |
|------|-------------|
| `get_activity` | Current queries from `pg_stat_activity` |
| `get_locks` | Lock info from `pg_locks` |
| `get_stats` | Database stats (connections, cache hit ratio, TPS, size) |
| `cancel_query` | Cancel a query by PID |
| `terminate_backend` | Terminate a backend by PID |

### MCP client config example

```json
{
  "mcpServers": {
    "pg-top": {
      "command": "node",
      "args": ["node_modules/@indiekit/pg-top/dist/mcp.js", "postgresql://localhost/mydb"]
    }
  }
}
```

## Programmatic API

```typescript
import { PgMonitor, PgQueries } from '@indiekit/pg-top';
import type { Activity, DbStats, LockInfo } from '@indiekit/pg-top';

// Low-level queries
const queries = new PgQueries('postgresql://localhost/mydb');
const activities: Activity[] = await queries.getActivity(/* noIdle */ true);
const locks: LockInfo[] = await queries.getLocks();
const stats: DbStats = await queries.getStats();

await queries.cancelQuery(1234);
await queries.terminateBackend(1234);
await queries.close();

// High-level monitor
const monitor = new PgMonitor({
  connectionString: 'postgresql://localhost/mydb',
  refreshInterval: 2,
  noIdle: true,
});
const snapshot = await monitor.runSnapshot(); // JSON string
```

## vs pg_activity (Python)

| | pg-top | pg_activity |
|---|---|---|
| Language | Node.js / TypeScript | Python |
| Install | `npm i -g` | `pip install` / system package |
| Native deps | None (`pg` only) | `psycopg2` (needs `libpq-dev`) |
| MCP server | ✅ Built-in | ❌ |
| JSON output | ✅ `--snapshot` | ❌ |
| Programmatic API | ✅ ESM + CJS | ❌ |
| Interactive TUI | ✅ | ✅ (more polished) |
| System stats | Basic (connections, cache, TPS) | Detailed (CPU, memory, IO) |
| Maturity | New | Battle-tested |

pg-top is designed for **automation-first** workflows: CI pipelines, AI agents, and Node.js toolchains. If you need a polished human-only TUI, pg_activity is more mature.

## License

MIT
