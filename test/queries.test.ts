import { describe, it, expect, afterAll } from 'vitest';
import { PgQueries } from '../src/queries.js';

// Use local postgres from TOOLS.md
const connStr = process.env.PG_TEST_URL || 'postgresql://postgres:postgres@localhost/postgres';
const queries = new PgQueries(connStr);

afterAll(async () => {
  await queries.close();
});

describe('PgQueries (integration)', () => {
  it('getActivity returns array', async () => {
    const result = await queries.getActivity();
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty('pid');
      expect(result[0]).toHaveProperty('state');
    }
  });

  it('getActivity with noIdle filters idle', async () => {
    const result = await queries.getActivity(true);
    expect(Array.isArray(result)).toBe(true);
    for (const r of result) {
      expect(r.state).not.toBe('idle');
    }
  });

  it('getLocks returns array', async () => {
    const result = await queries.getLocks();
    expect(Array.isArray(result)).toBe(true);
  });

  it('getStats returns db stats', async () => {
    const stats = await queries.getStats();
    expect(stats).toHaveProperty('dbname');
    expect(stats.max_connections).toBeGreaterThan(0);
    expect(typeof stats.total_size_bytes).toBe('number');
    expect(typeof stats.uptime_seconds).toBe('number');
  });

  it('getStats computes TPS on second call', async () => {
    // First call sets baseline
    await queries.getStats();
    // Second call should compute TPS
    const stats = await queries.getStats();
    expect(stats.tps).not.toBeNull();
  });
});
