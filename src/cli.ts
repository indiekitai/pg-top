import { PgMonitor } from './monitor.js';

function usage(): never {
  console.log(`
pg-top — Real-time PostgreSQL activity monitor

Usage:
  pg-top [options] <connection_string>

Options:
  --refresh <seconds>   Refresh interval (default: 2)
  --no-idle             Hide idle connections
  --snapshot            Single snapshot, then exit
  --json                Output as JSON (with --snapshot)
  -h, --help            Show this help

Examples:
  pg-top postgresql://localhost/mydb
  pg-top --no-idle --refresh 1 postgresql://user:pass@host/db
  pg-top --snapshot --json postgresql://localhost/mydb
`);
  process.exit(0);
}

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  let refreshInterval = 2;
  let noIdle = false;
  let snapshot = false;
  let json = false;
  let connectionString = '';

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-h' || a === '--help') usage();
    else if (a === '--refresh' && args[i + 1]) refreshInterval = Number(args[++i]);
    else if (a === '--no-idle') noIdle = true;
    else if (a === '--snapshot') snapshot = true;
    else if (a === '--json') json = true;
    else if (!a.startsWith('-')) connectionString = a;
  }

  if (!connectionString) {
    // Try env
    connectionString = process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING || '';
  }

  if (!connectionString) {
    console.error('Error: connection string required');
    console.error('Usage: pg-top <connection_string>');
    process.exit(1);
  }

  return { connectionString, refreshInterval, noIdle, snapshot, json };
}

async function main() {
  const opts = parseArgs(process.argv);
  const monitor = new PgMonitor(opts);

  if (opts.snapshot) {
    const output = await monitor.runSnapshot();
    console.log(output);
  } else {
    await monitor.runInteractive();
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message || err);
  process.exit(1);
});
