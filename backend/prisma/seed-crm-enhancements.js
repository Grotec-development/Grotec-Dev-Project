import 'dotenv/config';
import dns from 'node:dns';
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}
import pg from 'pg';

async function main() {
    console.log('Connecting via pg to seed CRM Enhancements master data...');
    const client = new pg.Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });
    await client.connect();

    // 1. Seed Soil Types
    const soilTypes = [
        ['CLAY', 'Clay Soil', 'களிமண்', 'Heavy soil with high moisture retention, ideal for paddy and sugarcane.'],
        ['RED', 'Red Soil', 'செம்மண்', 'Porous and friable with iron oxide content, great for groundnut, millets, pulses.'],
        ['SANDY', 'Sandy Soil', 'மணல் மண்', 'Light, well-draining soil suitable for root vegetables and watermelon.'],
        ['LOAMY', 'Loamy Soil', 'வண்டல் கலந்த மண்', 'Balanced blend of sand, silt, and clay; highly fertile for diverse crops.'],
        ['BLACK', 'Black Soil (Regur)', 'கரிசல் மண்', 'Rich in calcium carbonate and potash, excellent for cotton, chillies, pulses.'],
        ['ALLUVIAL', 'Alluvial Soil', 'வண்டல் மண்', 'River-deposited rich silt loam in delta belts, prime for rice, banana, sugarcane.'],
        ['GRAVELLY', 'Gravelly / Laterite Soil', 'சரளை மண்', 'Coarse texture with weathered rocks, suitable for plantation and orchard crops.'],
    ];

    for (const [code, nameEn, nameTa, desc] of soilTypes) {
        await client.query(`
            INSERT INTO "soil_types" ("id", "code", "name_en", "name_ta", "description", "is_active", "created_at", "updated_at")
            VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
            ON CONFLICT ("code") DO UPDATE SET "name_en" = $2, "name_ta" = $3, "description" = $4, "is_active" = true;
        `, [code, nameEn, nameTa, desc]);
    }
    console.log(`Seeded ${soilTypes.length} bilingual soil types.`);

    // 2. Fetch tenant id
    const tenantRes = await client.query('SELECT id FROM "tenants" WHERE "deleted_at" IS NULL LIMIT 1');
    const tenantId = tenantRes.rows[0]?.id || null;

    // 3. Seed Routes
    const routes = [
        {
            code: 'COIMBATORE',
            name: 'Coimbatore Route',
            description: 'Western industrial & agro corridor covering Kongu region districts.',
            districts: [
                ['Coimbatore', ['Coimbatore', 'Pollachi', 'Mettupalayam', 'Sulur', 'Annur']],
                ['Tiruppur', ['Tiruppur', 'Udumalaipettai', 'Dharapuram', 'Kangeyam', 'Avinashi']],
                ['Erode', ['Erode', 'Gobichettipalayam', 'Bhavani', 'Perundurai', 'Sathyamangalam']],
                ['Salem', ['Salem', 'Attur', 'Mettur', 'Omalur', 'Edappadi', 'Sankari']],
                ['Namakkal', ['Namakkal', 'Tiruchengode', 'Rasipuram', 'Paramathi Velur']],
                ['Nilgiris', ['Ooty', 'Coonoor', 'Kotagiri', 'Gudalur']],
                ['Dharmapuri', ['Dharmapuri', 'Harur', 'Palacode', 'Pennagaram', 'Pappireddipatti']],
                ['Krishnagiri', ['Krishnagiri', 'Hosur', 'Pochampalli', 'Uthangarai', 'Denkanikottai']],
            ],
        },
        {
            code: 'VELLORE_CHENNAI',
            name: 'Vellore–Chennai Route',
            description: 'Northern agro-belt & metropolitan fringe corridor.',
            districts: [
                ['Vellore', ['Vellore', 'Katpadi', 'Gudiyatham', 'Anaicut']],
                ['Ranipet', ['Ranipet', 'Arcot', 'Walajah', 'Arakkonam', 'Nemili']],
                ['Tirupathur', ['Tirupathur', 'Vaniyambadi', 'Ambur', 'Natrampalli']],
                ['Tiruvannamalai', ['Tiruvannamalai', 'Arani', 'Cheyyar', 'Polur', 'Chengam']],
                ['Kanchipuram', ['Kanchipuram', 'Sriperumbudur', 'Walajabad', 'Uthiramerur']],
                ['Tiruvallur', ['Tiruvallur', 'Poonamallee', 'Tiruttani', 'Gummidipoondi']],
                ['Chengalpattu', ['Chengalpattu', 'Madurantakam', 'Tambaram', 'Pallavaram']],
                ['Chennai', ['Chennai City Hub', 'Koyambedu Wholesale Market']],
            ],
        },
        {
            code: 'MADURAI',
            name: 'Madurai Route',
            description: 'Southern agro-hub covering temple districts, rainfed black-soil belts and down south.',
            districts: [
                ['Madurai', ['Madurai', 'Melur', 'Usilampatti', 'Vadipatti', 'Thirumangalam']],
                ['Dindigul', ['Dindigul', 'Palani', 'Oddanchatram', 'Natham', 'Kodaikanal']],
                ['Theni', ['Theni', 'Periyakulam', 'Bodinayakanur', 'Uthamapalayam', 'Andipatti']],
                ['Virudhunagar', ['Virudhunagar', 'Sivakasi', 'Aruppukkottai', 'Rajapalayam', 'Srivilliputhur']],
                ['Sivaganga', ['Sivaganga', 'Karaikudi', 'Manamadurai', 'Devakottai']],
                ['Ramanathapuram', ['Ramanathapuram', 'Paramakudi', 'Rameswaram', 'Mudukulathur']],
                ['Tirunelveli', ['Tirunelveli', 'Ambasamudram', 'Nanguneri', 'Palayamkottai']],
                ['Tenkasi', ['Tenkasi', 'Sankarankovil', 'Kadayanallur', 'Alangulam']],
                ['Thoothukudi', ['Thoothukudi', 'Kovilpatti', 'Tiruchendur', 'Ettayapuram']],
                ['Kanniyakumari', ['Nagercoil', 'Thuckalay', 'Kanyakumari', 'Padmanabhapuram']],
            ],
        },
        {
            code: 'TRICHY',
            name: 'Tiruchirappalli Route',
            description: 'Central Cauvery Delta & coastal agriculture corridor.',
            districts: [
                ['Tiruchirappalli', ['Trichy City', 'Manapparai', 'Lalgudi', 'Musiri', 'Thuraiyur']],
                ['Karur', ['Karur', 'Kulithalai', 'Aravakurichi', 'Krishnarayapuram']],
                ['Perambalur', ['Perambalur', 'Kunnam', 'Veppanthattai']],
                ['Ariyalur', ['Ariyalur', 'Jayankondam', 'Sendurai']],
                ['Thanjavur', ['Thanjavur', 'Kumbakonam', 'Pattukkottai', 'Orathanadu']],
                ['Tiruvarur', ['Tiruvarur', 'Mannargudi', 'Thiruthuraipoondi', 'Nannilam']],
                ['Nagapattinam', ['Nagapattinam', 'Kilvelur', 'Vedaranyam']],
                ['Mayiladuthurai', ['Mayiladuthurai', 'Sirkazhi', 'Tharangambadi', 'Kuthalam']],
                ['Pudukkottai', ['Pudukkottai', 'Aranthangi', 'Alangudi', 'Illuppur']],
                ['Cuddalore', ['Cuddalore', 'Panruti', 'Chidambaram', 'Vriddhachalam', 'Neyveli']],
                ['Villupuram', ['Villupuram', 'Tindivanam', 'Gingee', 'Vanur']],
                ['Kallakurichi', ['Kallakurichi', 'Sankarapuram', 'Ulundurpet', 'Chinnasalem']],
            ],
        },
    ];

    for (const r of routes) {
        const routeRes = await client.query(`
            INSERT INTO "delivery_routes" ("id", "tenant_id", "code", "name", "description", "is_active", "created_at", "updated_at")
            VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
            ON CONFLICT ("code") DO UPDATE SET "name" = $3, "description" = $4, "is_active" = true
            RETURNING "id";
        `, [tenantId, r.code, r.name, r.description]);
        const routeId = routeRes.rows[0].id;

        for (const [dist, towns] of r.districts) {
            await client.query(`
                INSERT INTO "route_districts" ("id", "route_id", "district", "towns", "created_at")
                VALUES (gen_random_uuid(), $1, $2, $3, NOW())
                ON CONFLICT ("route_id", "district") DO UPDATE SET "towns" = $3;
            `, [routeId, dist, towns]);
        }
    }
    console.log(`Seeded ${routes.length} delivery routes with associated districts and towns.`);

    // 4. Update Crop classifications
    const cropUpdates = [
        ['RICE', 'Oryza sativa', 120, 'SEASONAL'],
        ['SUGARCANE', 'Saccharum officinarum', 365, 'ANNUAL'],
        ['TOMATO', 'Solanum lycopersicum', 110, 'SEASONAL'],
        ['CHILLI', 'Capsicum annuum', 150, 'SEASONAL'],
        ['BANANA', 'Musa acuminata', 330, 'ANNUAL'],
        ['GRAPES', 'Vitis vinifera', 135, 'PERENNIAL'],
        ['GROUNDNUT', 'Arachis hypogaea', 105, 'SEASONAL'],
        ['COTTON', 'Gossypium hirsutum', 165, 'SEASONAL'],
        ['MAIZE', 'Zea mays', 100, 'SEASONAL'],
        ['MANGO', 'Mangifera indica', 120, 'PERENNIAL'],
        ['ONION', 'Allium cepa', 95, 'SEASONAL'],
        ['POTATO', 'Solanum tuberosum', 100, 'SEASONAL'],
        ['WHEAT', 'Triticum aestivum', 120, 'SEASONAL'],
        ['GRAM', 'Cicer arietinum', 95, 'SEASONAL'],
        ['SOYBEAN', 'Glycine max', 100, 'SEASONAL'],
    ];

    for (const [code, sci, dur, cls] of cropUpdates) {
        await client.query(`
            UPDATE "crops"
            SET "scientific_name" = $1, "duration_days" = $2, "classification" = $3
            WHERE "code" = $4;
        `, [sci, dur, cls, code]);
    }

    // Add Coconut if missing
    await client.query(`
        INSERT INTO "crops" ("id", "code", "name", "local_name", "category", "scientific_name", "duration_days", "classification", "is_active", "created_at", "updated_at")
        VALUES (gen_random_uuid(), 'COCONUT', 'Coconut', 'Thennai / Nariyal', 'PLANTATION', 'Cocos nucifera', 365, 'PERENNIAL', true, NOW(), NOW())
        ON CONFLICT ("code") DO UPDATE SET "scientific_name" = 'Cocos nucifera', "duration_days" = 365, "classification" = 'PERENNIAL';
    `);

    console.log('Updated crop catalogue with classifications and botanical details.');
    await client.end();
    console.log('CRM Enhancements master data seeding complete.');
}

main().catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
});
