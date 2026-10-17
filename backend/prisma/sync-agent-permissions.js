import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });
import dns from 'node:dns';
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}
import pg from 'pg';

async function main() {
    const client = new pg.Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    console.log('Connected to database to verify AGENT role permissions...');

    const roleRes = await client.query(`SELECT id FROM "roles" WHERE "code" = 'AGENT' LIMIT 1`);
    if (roleRes.rows.length === 0) {
        console.log('No AGENT role found in database.');
        await client.end();
        return;
    }
    const agentRoleId = roleRes.rows[0].id;

    const neededPerms = ['orders.read', 'orders.manage'];
    for (const code of neededPerms) {
        // Ensure permission exists
        let permRes = await client.query(`SELECT id FROM "permissions" WHERE "code" = $1 LIMIT 1`, [code]);
        let permId;
        if (permRes.rows.length === 0) {
            const insRes = await client.query(
                `INSERT INTO "permissions" ("id", "code", "name", "category", "created_at", "updated_at") VALUES (gen_random_uuid(), $1, $1, 'orders', NOW(), NOW()) RETURNING id`,
                [code]
            );
            permId = insRes.rows[0].id;
        } else {
            permId = permRes.rows[0].id;
        }

        // Link to role
        await client.query(`
            INSERT INTO "role_permissions" ("role_id", "permission_id")
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING;
        `, [agentRoleId, permId]);
        console.log(`Ensured permission ${code} for AGENT role.`);
    }

    await client.end();
    console.log('AGENT role permissions verified.');
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
