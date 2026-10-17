import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dns from 'node:dns';
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
    console.log('Connecting to database...');
    const connStr = process.env.DATABASE_URL;
    const client = new pg.Client({
        connectionString: connStr,
        ssl: { rejectUnauthorized: false },
    });

    await client.connect();
    console.log('Connected successfully. Reading migration.sql...');

    const sqlPath = path.join(__dirname, 'migrations/20261017120000_farmer_crm_tickets_routes_soils/migration.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Applying migration SQL...');
    await client.query(sql);
    console.log('Migration SQL executed successfully!');

    // Record migration in _prisma_migrations table if present
    try {
        const migrationName = '20261017120000_farmer_crm_tickets_routes_soils';
        const checksum = 'manual_' + Date.now();
        await client.query(`
            INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
            VALUES (gen_random_uuid()::text, $1, NOW(), $2, NULL, NULL, NOW(), 1)
            ON CONFLICT DO NOTHING;
        `, [checksum, migrationName]);
        console.log('Recorded migration in _prisma_migrations table.');
    } catch (err) {
        console.log('Notice: _prisma_migrations record skipped or already present:', err.message);
    }

    await client.end();
    console.log('All database migration steps completed.');
}

run().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
