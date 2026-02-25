/**
 * MCP (Model Context Protocol) server for pg-top.
 * Exposes PostgreSQL monitoring as tool calls.
 *
 * Usage: node dist/mcp.js <connection_string>
 * Communicates over stdio using JSON-RPC 2.0 (MCP transport).
 */

import { PgQueries } from './queries.js';
import { createInterface } from 'readline';

const connectionString = process.argv[2];
if (!connectionString) {
  console.error('Usage: pg-top-mcp <connection_string>');
  process.exit(1);
}

const queries = new PgQueries(connectionString);

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

function respond(id: number | string, result: unknown): void {
  const msg = JSON.stringify({ jsonrpc: '2.0', id, result });
  process.stdout.write(msg + '\n');
}

function respondError(id: number | string, code: number, message: string): void {
  const msg = JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } });
  process.stdout.write(msg + '\n');
}

const TOOLS = [
  { name: 'get_activity', description: 'Get current PostgreSQL activity from pg_stat_activity', inputSchema: { type: 'object', properties: { no_idle: { type: 'boolean' } } } },
  { name: 'get_locks', description: 'Get current lock information from pg_locks', inputSchema: { type: 'object', properties: {} } },
  { name: 'get_stats', description: 'Get database statistics (connections, cache hit ratio, TPS)', inputSchema: { type: 'object', properties: {} } },
  { name: 'cancel_query', description: 'Cancel a running query by PID', inputSchema: { type: 'object', properties: { pid: { type: 'number' } }, required: ['pid'] } },
  { name: 'terminate_backend', description: 'Terminate a backend connection by PID', inputSchema: { type: 'object', properties: { pid: { type: 'number' } }, required: ['pid'] } },
];

async function handleRequest(req: JsonRpcRequest): Promise<void> {
  try {
    if (req.method === 'initialize') {
      respond(req.id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'pg-top', version: '0.1.0' },
      });
      return;
    }

    if (req.method === 'tools/list') {
      respond(req.id, { tools: TOOLS });
      return;
    }

    if (req.method === 'tools/call') {
      const toolName = req.params?.name as string;
      const args = (req.params?.arguments ?? {}) as Record<string, unknown>;

      let result: unknown;
      switch (toolName) {
        case 'get_activity':
          result = await queries.getActivity(args.no_idle as boolean);
          break;
        case 'get_locks':
          result = await queries.getLocks();
          break;
        case 'get_stats':
          result = await queries.getStats();
          break;
        case 'cancel_query':
          result = await queries.cancelQuery(args.pid as number);
          break;
        case 'terminate_backend':
          result = await queries.terminateBackend(args.pid as number);
          break;
        default:
          respondError(req.id, -32601, `Unknown tool: ${toolName}`);
          return;
      }

      respond(req.id, {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      });
      return;
    }

    // Notifications (no response needed)
    if (req.method === 'notifications/initialized') return;

    respondError(req.id, -32601, `Method not found: ${req.method}`);
  } catch (err) {
    respondError(req.id, -32603, String(err));
  }
}

const rl = createInterface({ input: process.stdin });
rl.on('line', (line: string) => {
  try {
    const req = JSON.parse(line) as JsonRpcRequest;
    handleRequest(req);
  } catch {
    // ignore malformed
  }
});

process.on('SIGINT', async () => {
  await queries.close();
  process.exit(0);
});
