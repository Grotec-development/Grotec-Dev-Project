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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
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
  try {
    const client = new pg.Client({ ...SUPER, database: 'postgres', connectionTimeoutMillis: 1500 });
    await client.connect();
    await client.end();
    return true;
  } catch {
    return false;
  }
}

// After an unclean shutdown (machine/session restart) postgres leaves a stale
// postmaster.pid whose process is gone. postgres refuses to start over it, so
// clear it whenever the port is confirmed free.
function clearStalePidFile() {
  const pidFile = path.join(dataDir, 'postmaster.pid');
  if (fs.existsSync(pidFile)) {
    fs.rmSync(pidFile);
    console.log('removed stale postmaster.pid');
  }
}

async function bringUp() {
  const pg = instance();
  // initdb refuses a non-empty directory, so initialise() only applies on the
  // very first run (when .pgdata/PG_VERSION does not exist yet).
  const dataInitialised = fs.existsSync(path.join(dataDir, 'PG_VERSION'));
  if (dataInitialised) {
    console.log('data directory already initialised — skipping initdb');
  } else {
    console.log('initialising data directory (first run takes a moment)...');
    await pg.initialise();
  }
  clearStalePidFile();
  console.log('starting...');
  await pg.start();
  fs.writeFileSync(stateFile, String(process.pid));
  console.log('started embedded postgres on 127.0.0.1:5432');
  await ensureDatabases();
  return pg;
}

if (cmd === 'start' || cmd === 'serve') {
  if (await isRunning()) {
    console.log('already running on port 5432');
  } else {
    const pg = await bringUp();
    if (cmd === 'serve') {
      // Hold this process open so the embedded postgres child stays alive.
      // Detached launchers (e.g. background runners) should use `serve`.
      console.log('serve: holding process open (pid ' + process.pid + ')');
      const hold = () => setTimeout(hold, 60_000);
      hold();
    } else {
      // The spawned server keeps pipes open; exit explicitly or the CLI hangs.
      process.exit(0);
    }
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
  console.error('usage: node infra/dev-db.mjs <start|serve|stop|status>');
  process.exit(1);
}
