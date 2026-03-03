[English](README.md) | [中文](README.zh-CN.md)

# @indiekit/pg-top

[![npm version](https://img.shields.io/npm/v/@indiekit/pg-top)](https://www.npmjs.com/package/@indiekit/pg-top)
[![license](https://img.shields.io/npm/l/@indiekit/pg-top)](./LICENSE)

实时 PostgreSQL 活动监控器 —— 就像 Postgres 版的 `top`。基于 Node.js 构建，零原生依赖。

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

## 功能

- **交互式 TUI** —— 带键盘导航的实时仪表盘
- **快照模式** —— 单次 JSON 输出，适合 CI/脚本/Agent
- **锁监控** —— 显示被阻塞的查询和锁争用情况
- **查询管理** —— 交互式取消或终止查询
- **MCP Server** —— 将监控能力暴露为 AI Agent 工具调用
- **编程式 API** —— 可在自己的代码中导入使用
- **零原生依赖** —— 运行时仅依赖 `pg`

## 安装

```bash
npm install -g @indiekit/pg-top

# 或作为项目依赖
npm install @indiekit/pg-top
```

## CLI 用法

### 交互模式

```bash
pg-top postgresql://user:pass@localhost/mydb

# 隐藏空闲连接，每秒刷新
pg-top --no-idle --refresh 1 postgresql://localhost/mydb
```

### 快照模式（CI / Agent 友好）

```bash
# JSON 快照 —— 适合管道到 jq 或给 AI Agent 使用
pg-top --snapshot postgresql://localhost/mydb

# 也可以从环境变量读取连接字符串
export DATABASE_URL=postgresql://localhost/mydb
pg-top --snapshot
```

快照模式始终输出 JSON：

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

**退出码：**
| 代码 | 含义 |
|------|------|
| 0 | 成功 |
| 1 | 连接错误或缺少参数 |

### 选项

| 选项 | 描述 | 默认值 |
|------|------|--------|
| `--refresh <seconds>` | 刷新间隔 | `2` |
| `--no-idle` | 隐藏空闲连接 | 关闭 |
| `--snapshot` | 单次快照后退出（JSON 输出） | 关闭 |
| `--json` | 显式 JSON 标记（配合 `--snapshot` 使用） | 关闭 |
| `-h, --help` | 显示帮助 | |

### 键盘快捷键（交互模式）

| 按键 | 操作 |
|------|------|
| `q` / `Ctrl-C` | 退出 |
| `↑` / `↓` | 在进程列表中导航 |
| `c` | 取消选中的查询（`pg_cancel_backend`） |
| `k` | 终止选中的后端（`pg_terminate_backend`） |
| `s` | 切换排序键（duration → pid → state） |

## MCP Server

pg-top 内置 [MCP](https://modelcontextprotocol.io/) 服务器，支持 AI Agent 集成。

```bash
node dist/mcp.js postgresql://localhost/mydb
```

通过 stdio 使用 JSON-RPC 2.0 通信。可用工具：

| 工具 | 描述 |
|------|------|
| `get_activity` | 来自 `pg_stat_activity` 的当前查询 |
| `get_locks` | 来自 `pg_locks` 的锁信息 |
| `get_stats` | 数据库统计（连接数、缓存命中率、TPS、大小） |
| `cancel_query` | 按 PID 取消查询 |
| `terminate_backend` | 按 PID 终止后端 |

### MCP 客户端配置示例

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

## 编程式 API

```typescript
import { PgMonitor, PgQueries } from '@indiekit/pg-top';
import type { Activity, DbStats, LockInfo } from '@indiekit/pg-top';

// 底层查询
const queries = new PgQueries('postgresql://localhost/mydb');
const activities: Activity[] = await queries.getActivity(/* noIdle */ true);
const locks: LockInfo[] = await queries.getLocks();
const stats: DbStats = await queries.getStats();

await queries.cancelQuery(1234);
await queries.terminateBackend(1234);
await queries.close();

// 高层监控器
const monitor = new PgMonitor({
  connectionString: 'postgresql://localhost/mydb',
  refreshInterval: 2,
  noIdle: true,
});
const snapshot = await monitor.runSnapshot(); // JSON 字符串
```

## 与 pg_activity (Python) 的对比

| | pg-top | pg_activity |
|---|---|---|
| 语言 | Node.js / TypeScript | Python |
| 安装 | `npm i -g` | `pip install` / 系统包 |
| 原生依赖 | 无（仅 `pg`） | `psycopg2`（需要 `libpq-dev`） |
| MCP Server | ✅ 内置 | ❌ |
| JSON 输出 | ✅ `--snapshot` | ❌ |
| 编程式 API | ✅ ESM + CJS | ❌ |
| 交互式 TUI | ✅ | ✅（更完善） |
| 系统统计 | 基础（连接、缓存、TPS） | 详细（CPU、内存、IO） |
| 成熟度 | 新项目 | 久经考验 |

pg-top 专为**自动化优先**的工作流设计：CI 流水线、AI Agent 和 Node.js 工具链。如果你只需要精致的人机交互 TUI，pg_activity 更成熟。

## 许可证

MIT
