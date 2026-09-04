// Embedded PostgreSQL fallback for environments without Docker.
// Usage: node infra/dev-db.mjs <start|stop|status>
// Data lives in .pgdata/ (git-ignored). Creates role `grotec` and databases
// `grotec` / `grotec_test`, matching infra/docker-compose.yml so DATABASE_URL
// is identical in both modes: postgresql://grotec:grotec@localhost:5432/<db>
import EmbeddedPostgres from 'embedded-postgres';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, '.pgdata');
const SUPER = { user: 'postgres', password: 'postgres', host: '127.0.0.1', port: 5432 };

function instance() {
  return new EmbeddedPostgres({
    databaseDir: dataDir,
    user: SUPER.user,
    password: SUPER.password,
    port: SUPER.port,
    persistent: true,
    onLog: (line) => {
      if (/fatal|error/i.test(line)) console.error('pg:', line);
    },
  });
}

async function withClient(fn) {
  const client = new pg.Client({ ...SUPER, database: 'postgres' });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function ensureDatabases() {
  await withClient(async (c) => {
    const { rows } = await c.query("SELECT 1 FROM pg_roles WHERE rolname = 'grotec'");
    if (rows.length === 0) {
      await c.query("CREATE ROLE grotec LOGIN PASSWORD 'grotec' CREATEDB");
      console.log('created role grotec');
    }
    for (const db of ['grotec', 'grotec_test']) {
      const exists = await c.query('SELECT 1 FROM pg_database WHERE datname = $1', [db]);
      if (exists.rows.length === 0) {
        await c.query(`CREATE DATABASE ${db} OWNER grotec`);
        console.log(`created database ${db}`);
      }
    }
  });
}

const cmd = process.argv[2] ?? 'status';
const stateFile = path.join(root, '.pgdata', '.running-pid');

async function isRunning() {
  if (!fs.existsSync(stateFile)) return false;
  const pid = Number(fs.readFileSync(stateFile, 'utf8').trim());
  if (!pid) return false;
  try {
    const client = new pg.Client({ ...SUPER, database: 'postgres', connectionTimeoutMillis: 1500 });
    await client.connect();
    await client.end();
    return true;
  } catch {
    return false;
  }
}

if (cmd === 'start') {
  if (await isRunning()) {
    console.log('already running on port 5432');
  } else {
    const pg = instance();
    console.log('initialising data directory (first run takes a moment)...');
    await pg.initialise();
    console.log('starting...');
    await pg.start();
    fs.writeFileSync(stateFile, String(process.pid));
    console.log('started embedded postgres on 127.0.0.1:5432');
    await ensureDatabases();
    // The spawned server keeps pipes open; exit explicitly or the CLI hangs.
    process.exit(0);
  }
} else if (cmd === 'stop') {
  if (await isRunning()) {
    const pg = instance();
    await pg.stop();
    if (fs.existsSync(stateFile)) fs.rmSync(stateFile);
    console.log('stopped');
    process.exit(0);
  } else {
    console.log('not running');
  }
} else if (cmd === 'status') {
  console.log((await isRunning()) ? 'running on 127.0.0.1:5432' : 'not running');
} else {
  console.error('usage: node infra/dev-db.mjs <start|stop|status>');
  process.exit(1);
}
