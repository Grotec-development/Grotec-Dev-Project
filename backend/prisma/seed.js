import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PERMISSION_CODES, PROPOSED_ROLE_PERMISSIONS, ROLE_CODES, ROLE_LABELS, } from '@grotec/shared';
import { hashPassword } from '../src/modules/auth/password.util.js';
const prisma = new PrismaClient();
/**
 * Idempotent development seed.
 * - RBAC: permissions, roles, role→permission matrix (PROVISIONAL — PRD pending).
 * - Employees: founder (env) + demo employees (env SEED_EMPLOYEES).
 * - Reference data: crops (PROVISIONAL list).
 * - Demo data: a few customers (+phones/locations/crops) and leads owned by the
 *   demo agent. Demo customer phone numbers are fixed so re-seeding is safe.
 */
// PRD §6.5.2 / §11: crop catalog carries a category (field / tree / plantation /
// vegetable / other). The seed splits the provisional catalog accordingly.
const PROVISIONAL_CROPS = [
    { code: 'RICE', name: 'Rice (Paddy)', localName: 'Dhaan / Nel', category: 'FIELD', isActive: true },
    { code: 'SUGARCANE', name: 'Sugarcane', localName: 'Ganna / Karumbu', category: 'FIELD', isActive: true },
    { code: 'GRAPES', name: 'Grapes', localName: 'Angoor / Drakshai', category: 'PLANTATION', isActive: true },
    { code: 'CHILLI', name: 'Chilli', localName: 'Mirch / Milagai', category: 'VEGETABLE', isActive: true },
    { code: 'TOMATO', name: 'Tomato', localName: 'Tamatar / Thakkali', category: 'VEGETABLE', isActive: true },
    { code: 'BANANA', name: 'Banana', localName: 'Kela / Vazhai', category: 'PLANTATION', isActive: true },
    { code: 'GRAM', name: 'Chickpea (Gram)', localName: 'Chana / Kondaikadalai', category: 'FIELD', isActive: true },
    { code: 'GROUNDNUT', name: 'Groundnut', localName: 'Moongphali / Verkadalai', category: 'FIELD', isActive: true },
    { code: 'COTTON', name: 'Cotton', localName: 'Kapas / Paruthi', category: 'FIELD', isActive: true },
    { code: 'MAIZE', name: 'Maize', localName: 'Makka / Cholam', category: 'FIELD', isActive: true },
    { code: 'WHEAT', name: 'Wheat', localName: 'Gehu / Godhumai', category: 'FIELD', isActive: true },
    { code: 'SOYBEAN', name: 'Soybean', localName: 'Soyabean', category: 'FIELD', isActive: true },
    { code: 'MANGO', name: 'Mango', localName: 'Aam / Maangai', category: 'TREE', isActive: true },
    { code: 'ONION', name: 'Onion', localName: 'Pyaaz / Vengayam', category: 'VEGETABLE', isActive: true },
    { code: 'POTATO', name: 'Potato', localName: 'Aloo / Urulaikizhangu', category: 'VEGETABLE', isActive: true },
    { code: 'MUSTARD', name: 'Mustard', localName: 'Sarson', category: 'FIELD', isActive: false }, // De-prioritized / non-target crop in TN market
];
// Starter guidance for the AI Assistant, verified against the real Grotec
// product catalog (grotecagro.com & docs/company-context.md).
// problemType follows the PRD §6.5.2 taxonomy (PEST | DISEASE | NUTRIENT_DEFICIENCY | WEED | OTHER).
const GUIDANCE_SEED = [
    // --- 1. RICE / PADDY ---
    {
        cropCode: 'RICE',
        problemType: 'DISEASE',
        problemKeywords: ['sheath blight', 'bacterial leaf blight', 'paddy blast', 'leaf blast', 'fungal disease', 'paddy blight', 'brown spot'],
        recommendedProducts: ['Bio Jeevan PF', 'Bio Jeevan TV'],
        usageGuidance: 'Seed treatment: 10 ml/kg seed with Bio Jeevan PF; or soil application of 1 L/acre in 25 kg organic manure/cow dung at land preparation. Foliar spray at 5 ml/L of water at first symptom of sheath blight or bacterial leaf blight. Alternate with Bio Jeevan TV (3 ml/L). Do not use chemical fungicides for 4-5 days.',
    },
    {
        cropCode: 'RICE',
        problemType: 'NUTRIENT_DEFICIENCY',
        problemKeywords: ['leaf yellowing', 'nitrogen deficiency', 'poor tillering', 'chlorosis', 'stunted tillers'],
        recommendedProducts: ['Bio Jeevan Azos', 'Bio Jeevan Phos'],
        usageGuidance: 'Soil/drip application of Bio Jeevan Azos (1 to 2 L/acre) with compost; repeat foliar spray @ 3 ml/L at tillering to enhance leaf area index and atmospheric nitrogen fixation. Apply Bio Jeevan Phos (1 L/acre) to solubilize soil phosphate.',
    },
    {
        cropCode: 'RICE',
        problemType: 'OTHER',
        problemKeywords: ['grain filling', 'panicle emergence', 'panicle initiation', 'yield booster', 'bumper yield'],
        recommendedProducts: ['Ultra Action +', 'Sanjeevini Gel'],
        usageGuidance: 'Foliar spray of Jeevan Sakthi Ultra Action plus @ 3-5 ml/L of water at active tillering and panicle initiation. Supplement with Sanjeevini Gel @ 1-2 g/L during grain filling for uniform grain weight and reduced chaffy grains.',
    },
    {
        cropCode: 'RICE',
        problemType: 'PEST',
        problemKeywords: ['stem borer', 'leaf folder', 'brown plant hopper', 'bph', 'sucking pests', 'green leafhopper'],
        recommendedProducts: ['Trishul', 'Asthra'],
        usageGuidance: 'Foliar spray of Jeevan Sakthi Trishul @ 2.5-3 ml/L of water upon noticing dead hearts or white ears from stem borer. Combine with Asthra @ 2.5 ml/L for broad-spectrum sucking pest and leaf folder control without chemical residue.',
    },
    {
        cropCode: 'RICE',
        problemType: 'OTHER',
        problemKeywords: ['soil fertility', 'basal land preparation', 'organic manure', 'soil organic carbon', 'soil health'],
        recommendedProducts: ['Organic Fertilizer', 'Bio Jeevan Azotob'],
        usageGuidance: 'Apply Grotec Organic Fertilizer (enriched organic manure FCO 1985) @ 100-200 kg/acre during basal land preparation to rebuild organic carbon (>14%) and soil structure. Topdress with Bio Jeevan Azotob (1-2 L/acre).',
    },
    // --- 2. SUGARCANE ---
    {
        cropCode: 'SUGARCANE',
        problemType: 'DISEASE',
        problemKeywords: ['red rot', 'sett rot', 'cane wilt', 'red rot of sugarcane', 'wilt', 'smut'],
        recommendedProducts: ['Bio Jeevan PF', 'Bio Jeevan TV'],
        usageGuidance: 'Sett treatment: dip setts in Bio Jeevan PF slurry (50 ml/L in water with organic manure) for 30 minutes before planting. Soil application along furrows at 1-2 L/acre with compost to suppress Fusarium and Colletotrichum soil-borne fungi.',
    },
    {
        cropCode: 'SUGARCANE',
        problemType: 'NUTRIENT_DEFICIENCY',
        problemKeywords: ['poor cane growth', 'stunted canes', 'internode elongation', 'yellowing', 'nitrogen'],
        recommendedProducts: ['Bio Jeevan Azos', 'Bio Jeevan Phos'],
        usageGuidance: 'Apply Bio Jeevan Azos (1-2 L/acre) along furrows to stimulate root branching in graminaceous roots through associative nitrogen fixation and IAA hormone production; apply Bio Jeevan Phos (1-2 L/acre) for root depth.',
    },
    {
        cropCode: 'SUGARCANE',
        problemType: 'OTHER',
        problemKeywords: ['ratoon management', 'ratoon vigor', 'cane girth', 'sugar recovery', 'cane weight'],
        recommendedProducts: ['Ultra Action +', 'Organic Fertilizer'],
        usageGuidance: 'Apply Grotec Organic Fertilizer @ 150 kg/acre immediately after ratoon shaving. Drench or drip apply Jeevan Sakthi Ultra Action plus @ 2-3 L/acre to stimulate profuse ratoon tillering, cane girth, and sugar accumulation.',
    },
    // --- 3. CHILLI ---
    {
        cropCode: 'CHILLI',
        problemType: 'DISEASE',
        problemKeywords: ['damping off', 'collar rot', 'seedling wilt', 'damping off of chillies', 'dieback', 'anthracnose', 'fruit rot'],
        recommendedProducts: ['Bio Jeevan PF', 'Bio Jeevan TV'],
        usageGuidance: 'Seed treatment: mix 10 ml Bio Jeevan PF per 1 kg seeds; drench nursery beds with Bio Jeevan TV (3 ml/L) to prevent damping off. For dieback and fruit rot in main field, foliar spray Bio Jeevan PF @ 5 ml/L at first appearance.',
    },
    {
        cropCode: 'CHILLI',
        problemType: 'PEST',
        problemKeywords: ['thrips', 'chilli thrips', 'leaf curl', 'murda disease', 'mites', 'whitefly', 'aphids', 'sucking pests'],
        recommendedProducts: ['Trishul', 'Asthra'],
        usageGuidance: 'Foliar spray of Jeevan Sakthi Trishul @ 3 ml/L of water mixed with Asthra @ 2.5 ml/L targeting the underside of leaves for thrips, mites, and leaf curl vectors. Repeat at 7-10 day intervals. Follow product label.',
    },
    {
        cropCode: 'CHILLI',
        problemType: 'OTHER',
        problemKeywords: ['flower drop', 'poor fruit set', 'heat stress', 'blossom drop', 'fruit size', 'chilli yield'],
        recommendedProducts: ['Ultra Action +', 'Sanjeevini Gel'],
        usageGuidance: 'Foliar spray of Jeevan Sakthi Ultra Action plus @ 3 ml/L at initiation of flower buds. Spray Sanjeevini Gel @ 1-2 g/L during peak flowering to prevent flower drop and ensure uniform, high-pungency, vibrant pod development.',
    },
    // --- 4. TOMATO ---
    {
        cropCode: 'TOMATO',
        problemType: 'DISEASE',
        problemKeywords: ['bacterial wilt', 'fusarium wilt', 'wilt of tomato', 'damping off', 'early blight', 'late blight'],
        recommendedProducts: ['Bio Jeevan PF', 'Bio Jeevan TV'],
        usageGuidance: 'Seedling root dip: dip roots in Bio Jeevan PF slurry (50 ml in water with organic manure) for 30 minutes before transplanting. Drench root zone with Bio Jeevan TV (1-2 L/acre) to suppress bacterial wilt and collar rot.',
    },
    {
        cropCode: 'TOMATO',
        problemType: 'PEST',
        problemKeywords: ['fruit borer', 'tuta absoluta', 'leaf miner', 'whitefly', 'caterpillars'],
        recommendedProducts: ['Trishul', 'Asthra'],
        usageGuidance: 'Foliar spray of Jeevan Sakthi Trishul @ 3 ml/L plus Asthra @ 2.5 ml/L at vegetative and early flowering stages. Controls fruit borer larvae and whitefly vectors without chemical residue.',
    },
    {
        cropCode: 'TOMATO',
        problemType: 'OTHER',
        problemKeywords: ['flower drop', 'fruit cracking', 'poor fruit set', 'fruit firmness', 'fruit sizing'],
        recommendedProducts: ['Ultra Action +', 'Sanjeevini Gel'],
        usageGuidance: 'Spray Jeevan Sakthi Ultra Action plus @ 3 ml/L at first flowering. Follow with Sanjeevini Gel @ 1.5 g/L during fruit sizing to enhance firm skin, prevent fruit cracking, and increase marketable yield.',
    },
    // --- 5. BANANA ---
    {
        cropCode: 'BANANA',
        problemType: 'DISEASE',
        problemKeywords: ['panama wilt', 'fusarium wilt', 'panama wilt of banana', 'leaf wilting', 'erwinia rot', 'sigatoka', 'rhizome rot'],
        recommendedProducts: ['Bio Jeevan PF', 'Bio Jeevan TV'],
        usageGuidance: 'Sucker treatment: dip suckers for 30 minutes in Bio Jeevan PF slurry (50 ml in water with organic manure). Soil drench 1-2 L/acre of Bio Jeevan TV around the pseudostem at planting and 60 days later to prevent Panama wilt.',
    },
    {
        cropCode: 'BANANA',
        problemType: 'OTHER',
        problemKeywords: ['bunch weight', 'bunch filling', 'finger size', 'poor bunch', 'bunch development', 'banana yield'],
        recommendedProducts: ['Sanjeevini Gel', 'Ultra Action +'],
        usageGuidance: 'Drip application of Sanjeevini Gel @ 1 kg/acre or foliar spray @ 2 g/L after bunch emergence to ensure uniform finger filling and heavy bunch weight. Apply Ultra Action plus (2 L/acre) via drip during vegetative stage.',
    },
    {
        cropCode: 'BANANA',
        problemType: 'OTHER',
        problemKeywords: ['soil conditioning', 'root zone aeration', 'nematodes', 'feeder roots', 'soil health'],
        recommendedProducts: ['Thavam', 'Organic Fertilizer'],
        usageGuidance: 'Apply Grotec Organic Fertilizer @ 200 kg/acre around tree basin. Apply Thavam @ 1-2 L/acre via drip irrigation to condition soil, aerate root zone, and stimulate feeder root regeneration.',
    },
    // --- 6. COTTON ---
    {
        cropCode: 'COTTON',
        problemType: 'PEST',
        problemKeywords: ['whitefly', 'aphids', 'jassids', 'thrips', 'sucking pests', 'bollworm', 'spotted bollworm'],
        recommendedProducts: ['Trishul', 'Asthra'],
        usageGuidance: 'Foliar spray of Jeevan Sakthi Trishul @ 3 ml/L of water with Asthra @ 2.5 ml/L during squaring and early boll formation for biological control of sucking pests (whiteflies, aphids, jassids) and bollworm deterrence.',
    },
    {
        cropCode: 'COTTON',
        problemType: 'OTHER',
        problemKeywords: ['square drop', 'flower drop', 'boll drop', 'boll sizing', 'boll weight', 'cotton yield'],
        recommendedProducts: ['Ultra Action +', 'Sanjeevini Gel'],
        usageGuidance: 'Foliar spray of Jeevan Sakthi Ultra Action plus @ 3-5 ml/L at squaring stage to prevent premature square and boll shedding. Follow with Sanjeevini Gel (1.5 g/L) at boll development for heavy boll weight and fiber quality.',
    },
    {
        cropCode: 'COTTON',
        problemType: 'NUTRIENT_DEFICIENCY',
        problemKeywords: ['leaf reddening', 'magnesium deficiency', 'nitrogen deficiency', 'stunted growth'],
        recommendedProducts: ['Bio Jeevan Azotob', 'Bio Jeevan Micromix'],
        usageGuidance: 'Soil/drip application of Bio Jeevan Azotob (1-2 L/acre) to fix 6-8 kg N/acre. Foliar spray of Bio Jeevan Micromix @ 3 ml/L to supply micronutrient consortium and prevent nutrient-induced leaf reddening.',
    },
    // --- 7. GROUNDNUT ---
    {
        cropCode: 'GROUNDNUT',
        problemType: 'DISEASE',
        problemKeywords: ['leaf spot', 'tikka disease', 'cercospora', 'leaf spot of groundnut', 'collar rot', 'root rot'],
        recommendedProducts: ['Bio Jeevan PF', 'Bio Jeevan TV'],
        usageGuidance: 'Foliar spray of Bio Jeevan PF @ 5 ml/L upon first appearance of dark Tikka spots on lower leaves. Seed treatment with Bio Jeevan TV (10 ml/kg seed) to prevent collar rot and seed rot during germination.',
    },
    {
        cropCode: 'GROUNDNUT',
        problemType: 'NUTRIENT_DEFICIENCY',
        problemKeywords: ['poor nodulation', 'nitrogen deficiency', 'root nodules', 'nitrogen fixation'],
        recommendedProducts: ['Bio Jeevan Rhizob', 'Bio Jeevan Phos'],
        usageGuidance: 'Seed treatment: mix 10 ml Bio Jeevan Rhizob with 10 g crude sugar in water slurry per 1 kg seeds, dry in shade and sow immediately. Fixes 20-30 kg atmospheric N/acre and forms healthy pink root nodules.',
    },
    {
        cropCode: 'GROUNDNUT',
        problemType: 'OTHER',
        problemKeywords: ['pod filling', 'peg formation', 'empty shells', 'groundnut yield', 'bold pods'],
        recommendedProducts: ['Ultra Action +', 'Bio Jeevan Micromix'],
        usageGuidance: 'Apply Jeevan Sakthi Ultra Action plus @ 3 ml/L at flowering and peg formation to accelerate peg penetration. Apply Bio Jeevan Micromix (1-2 L/acre) to ensure complete pod filling and eliminate blank pods.',
    },
    // --- 8. CHICKPEA / PULSES (GRAM) ---
    {
        cropCode: 'GRAM',
        problemType: 'DISEASE',
        problemKeywords: ['chickpea wilt', 'fusarium wilt', 'wilt', 'collar rot', 'root rot', 'dry root rot'],
        recommendedProducts: ['Bio Jeevan PF', 'Bio Jeevan TV'],
        usageGuidance: 'Seed treatment: coat 1 kg seeds with 10 ml Bio Jeevan PF + 10 ml Bio Jeevan TV slurry before sowing. Suppresses Fusarium oxysporum and Rhizoctonia wilt fungi in the seedling rhizosphere.',
    },
    {
        cropCode: 'GRAM',
        problemType: 'NUTRIENT_DEFICIENCY',
        problemKeywords: ['poor nodulation', 'nitrogen deficiency', 'root development', 'nodule count'],
        recommendedProducts: ['Bio Jeevan Rhizob', 'Bio Jeevan Phos'],
        usageGuidance: 'Seed treatment: 10 ml Bio Jeevan Rhizob + 10 ml Bio Jeevan Phos per 1 kg seed. Rhizobium fixes 20-30 kg N/acre while Phos solubilizes phosphorus needed for ATP energy in nitrogenase fixation.',
    },
    // --- 9. GRAPES ---
    {
        cropCode: 'GRAPES',
        problemType: 'DISEASE',
        problemKeywords: ['mildew', 'powdery mildew', 'downy mildew', 'mildews of grapes', 'anthracnose', 'berry spot'],
        recommendedProducts: ['Bio Jeevan PF', 'Bio Jeevan TV'],
        usageGuidance: 'Foliar spray of Bio Jeevan PF @ 5 ml/L of water during pre-flowering and berry formation; alternate with Bio Jeevan TV (3 ml/L) for biological control of downy and powdery mildews. Zero chemical residue.',
    },
    {
        cropCode: 'GRAPES',
        problemType: 'OTHER',
        problemKeywords: ['berry elongation', 'berry size', 'sugar content', 'brix', 'bunch compactness'],
        recommendedProducts: ['Ultra Action +', 'Sanjeevini Gel'],
        usageGuidance: 'Foliar spray of Jeevan Sakthi Ultra Action plus @ 3 ml/L at berry set stage. Follow with Sanjeevini Gel @ 1.5 g/L during veraison stage for uniform berry elongation, higher Brix sugar content, and export quality.',
    },
    // --- 10. MANGO ---
    {
        cropCode: 'MANGO',
        problemType: 'OTHER',
        problemKeywords: ['poor flowering', 'flower drop', 'fruit drop', 'irregular bearing', 'alternate bearing'],
        recommendedProducts: ['Ultra Action +', 'Sanjeevini Gel'],
        usageGuidance: 'Foliar spray of Jeevan Sakthi Ultra Action plus @ 3 ml/L at flower bud burst. Spray Sanjeevini Gel @ 1.5 g/L when fruits are pea-sized and marble-sized to minimize fruit drop and ensure heavy fruit retention.',
    },
    {
        cropCode: 'MANGO',
        problemType: 'DISEASE',
        problemKeywords: ['anthracnose', 'powdery mildew', 'blossom blight', 'dieback'],
        recommendedProducts: ['Bio Jeevan PF', 'Bio Jeevan TV'],
        usageGuidance: 'Foliar spray of Bio Jeevan PF @ 5 ml/L before flowering and again after fruit set to manage blossom blight and anthracnose spots on leaves and young fruit panicles.',
    },
    {
        cropCode: 'MANGO',
        problemType: 'OTHER',
        problemKeywords: ['tree vigor', 'soil conditioning', 'drought tolerance', 'root health'],
        recommendedProducts: ['Thavam', 'Organic Fertilizer'],
        usageGuidance: 'Apply Grotec Organic Fertilizer @ 10-15 kg per mature tree basin before monsoon. Drench with Thavam (50-100 ml per tree in water) to aerate root basin and revive active feeder roots.',
    },
    // --- 11. MAIZE ---
    {
        cropCode: 'MAIZE',
        problemType: 'NUTRIENT_DEFICIENCY',
        problemKeywords: ['leaf yellowing', 'nitrogen deficiency', 'cob development', 'poor grain filling'],
        recommendedProducts: ['Bio Jeevan Azos', 'Bio Jeevan Phos'],
        usageGuidance: 'Seed treatment with Bio Jeevan Azos (10 ml/kg seed) or soil application (1-2 L/acre). Azospirillum fixes atmospheric nitrogen in the graminaceous root cortex and produces growth hormones for sturdy stalks and filled cobs.',
    },
    {
        cropCode: 'MAIZE',
        problemType: 'PEST',
        problemKeywords: ['fall armyworm', 'stem borer', 'leaf feeding', 'whorl damage'],
        recommendedProducts: ['Trishul', 'Asthra'],
        usageGuidance: 'Spray Jeevan Sakthi Trishul @ 3 ml/L directed into the whorls upon first sighting of pinholes or young Fall Armyworm larvae. Safe and non-toxic for livestock fodder.',
    },
    // --- 12. ONION ---
    {
        cropCode: 'ONION',
        problemType: 'DISEASE',
        problemKeywords: ['purple blotch', 'basal rot', 'damping off', 'twister disease', 'leaf spot'],
        recommendedProducts: ['Bio Jeevan PF', 'Bio Jeevan TV'],
        usageGuidance: 'Seedling dip: dip roots in Bio Jeevan PF slurry (50 ml in water with organic manure) for 30 minutes before transplanting. Spray Bio Jeevan TV @ 3 ml/L upon noticing purple blotch on foliage.',
    },
    {
        cropCode: 'ONION',
        problemType: 'NUTRIENT_DEFICIENCY',
        problemKeywords: ['bulb sizing', 'poor bulbing', 'neck thickness', 'bulb yield'],
        recommendedProducts: ['Bio Jeevan Micromix', 'Organic Fertilizer'],
        usageGuidance: 'Basal application of Grotec Organic Fertilizer @ 100 kg/acre. Apply Bio Jeevan Micromix (1-2 L/acre) via drip during bulb initiation stage to ensure uniform, tight-skinned bulbs with long storage shelf life.',
    },
    // --- 13. POTATO ---
    {
        cropCode: 'POTATO',
        problemType: 'DISEASE',
        problemKeywords: ['late blight', 'early blight', 'black scurf', 'common scab', 'tuber rot'],
        recommendedProducts: ['Bio Jeevan PF', 'Bio Jeevan TV'],
        usageGuidance: 'Tuber seed treatment: dip cut seed tubers in Bio Jeevan PF (10 ml/L of water) for 15 minutes, shade dry and sow. Foliar spray Bio Jeevan TV @ 3 ml/L during cool moist weather to prevent late blight.',
    },
    {
        cropCode: 'POTATO',
        problemType: 'OTHER',
        problemKeywords: ['tuber bulking', 'tuber count', 'uniform tubers', 'potato yield'],
        recommendedProducts: ['Sanjeevini Gel', 'Bio Jeevan Phos'],
        usageGuidance: 'Apply Bio Jeevan Phos (1-2 L/acre) at earthing up to stimulate stolon formation. Foliar spray Sanjeevini Gel @ 1.5 g/L during tuber bulking stage for high-grade marketable tubers.',
    },
    // --- 14. SOYBEAN ---
    {
        cropCode: 'SOYBEAN',
        problemType: 'NUTRIENT_DEFICIENCY',
        problemKeywords: ['poor nodulation', 'nitrogen deficiency', 'root development', 'nodule formation'],
        recommendedProducts: ['Bio Jeevan Rhizob', 'Bio Jeevan Phos'],
        usageGuidance: 'Seed treatment: 10 ml Bio Jeevan Rhizob + 10 ml Bio Jeevan Phos per 1 kg seed. Establishes nitrogen-fixing bacteroids in root nodules and increases pod counts by 20-35%.',
    },
    // --- 15. WHEAT ---
    {
        cropCode: 'WHEAT',
        problemType: 'NUTRIENT_DEFICIENCY',
        problemKeywords: ['yellowing', 'stunted growth', 'low tillering', 'flag leaf chlorosis'],
        recommendedProducts: ['Bio Jeevan Azos', 'Bio Jeevan Micromix'],
        usageGuidance: 'Seed treatment at sowing with Bio Jeevan Azos (10 ml/kg seed). Apply Bio Jeevan Micromix @ 1-2 L/acre at crown root initiation and tillering stages.',
    },
];
const DEMO_CUSTOMERS = [
    { name: 'Ramesh Patel', phone: '9876543001', village: 'Kothapalli', district: 'Warangal', state: 'Telangana', cropIndex: 0, acreage: 4.5 },
    { name: 'Suresh Kumar', phone: '9876543002', village: 'Peddapalli', district: 'Karimnagar', state: 'Telangana', cropIndex: 5, acreage: 2.25 },
    { name: 'Amar Singh', phone: '9876543003', village: 'Bidar', district: 'Nanded', state: 'Maharashtra', cropIndex: 3, acreage: 6.0 },
    { name: 'Lakshmi Devi', phone: '9876543004', village: 'Chittoor', district: 'Chittoor', state: 'Andhra Pradesh', cropIndex: 11, acreage: 1.75 },
    { name: 'Mohan Das', phone: '9876543005', village: 'Khammam', district: 'Khammam', state: 'Telangana', cropIndex: 7, acreage: 3.0 },
];
async function seedPermissions() {
    for (const code of PERMISSION_CODES) {
        await prisma.permission.upsert({
            where: { code },
            update: { module: code.split('.')[0] ?? 'crm' },
            create: { code, module: code.split('.')[0] ?? 'crm', description: `Permission ${code}` },
        });
    }
    console.log(`seeded ${PERMISSION_CODES.length} permissions`);
}
async function seedRoles() {
    for (const code of ROLE_CODES) {
        const role = await prisma.role.upsert({
            where: { code },
            update: { name: ROLE_LABELS[code] },
            create: { code, name: ROLE_LABELS[code] },
        });
        const matrix = PROPOSED_ROLE_PERMISSIONS[code];
        await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
        if (matrix.length > 0) {
            const permissions = await prisma.permission.findMany({ where: { code: { in: [...matrix] } } });
            await prisma.rolePermission.createMany({
                data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
            });
        }
    }
    console.log(`seeded ${ROLE_CODES.length} roles with provisional matrices`);
}
async function findRole(code) {
    const role = await prisma.role.findUnique({ where: { code } });
    if (!role)
        throw new Error(`Role ${code} missing after seed`);
    return role;
}
async function seedEmployees() {
    const founderEmail = (process.env.FOUNDER_EMAIL ?? 'founder@grotec.local').toLowerCase();
    const founderName = process.env.FOUNDER_NAME ?? 'Grotec Founder';
    const founderPassword = process.env.FOUNDER_PASSWORD ?? 'Founder@123';
    const founderRole = await findRole('FOUNDER');
    const demoEmployeeProfiles = {
        [founderEmail]: { code: 'EMP0001', designation: 'Founder & CEO', department: 'Executive', experience: '10+ years', joiningDate: new Date('2024-01-01') },
        'manager@grotec.local': { code: 'EMP0002', designation: 'Operations Manager', department: 'Operations', experience: '6 years', joiningDate: new Date('2024-06-01') },
        'agent@grotec.local': { code: 'EMP0003', designation: 'Senior Telecaller', department: 'Telecalling', experience: '2.5 years', joiningDate: new Date('2025-01-15') },
        'staff@grotec.local': { code: 'EMP0005', designation: 'Office & HR Staff', department: 'Human Resources', experience: '3 years', joiningDate: new Date('2024-11-01') },
        'delivery@grotec.local': { code: 'EMP0004', designation: 'Delivery & Field Specialist', department: 'Field Operations', experience: '2 years', joiningDate: new Date('2025-01-10') },
    };
    const founderProf = demoEmployeeProfiles[founderEmail];
    const founder = await prisma.employee.upsert({
        where: { email: founderEmail },
        update: {
            fullName: founderName,
            roleId: founderRole.id,
            status: 'ACTIVE',
            employeeCode: founderProf?.code,
            designation: founderProf?.designation,
            department: founderProf?.department,
            experience: founderProf?.experience,
            joiningDate: founderProf?.joiningDate,
        },
        create: {
            email: founderEmail,
            fullName: founderName,
            roleId: founderRole.id,
            passwordHash: await hashPassword(founderPassword),
            employeeCode: founderProf?.code,
            designation: founderProf?.designation,
            department: founderProf?.department,
            experience: founderProf?.experience,
            joiningDate: founderProf?.joiningDate,
        },
    });
    let agentId;
    const spec = process.env.SEED_EMPLOYEES ?? '';
    for (const entry of spec.split(';').map((s) => s.trim()).filter(Boolean)) {
        const [name, email, roleRaw] = entry.split(',').map((s) => s.trim());
        const roleCode = roleRaw;
        if (!name || !email || !ROLE_CODES.includes(roleCode)) {
            console.warn(`skipping malformed SEED_EMPLOYEES entry: "${entry}"`);
            continue;
        }
        const role = await findRole(roleCode);
        const prof = demoEmployeeProfiles[email.toLowerCase()];
        const employee = await prisma.employee.upsert({
            where: { email: email.toLowerCase() },
            update: {
                fullName: name,
                roleId: role.id,
                status: 'ACTIVE',
                employeeCode: prof?.code,
                designation: prof?.designation,
                department: prof?.department,
                experience: prof?.experience,
                joiningDate: prof?.joiningDate,
                reportingManagerId: roleCode !== 'MANAGER' ? founder.id : null,
            },
            create: {
                email: email.toLowerCase(),
                fullName: name,
                roleId: role.id,
                passwordHash: await hashPassword(founderPassword),
                employeeCode: prof?.code,
                designation: prof?.designation,
                department: prof?.department,
                experience: prof?.experience,
                joiningDate: prof?.joiningDate,
                reportingManagerId: roleCode !== 'MANAGER' ? founder.id : null,
            },
        });
        if (roleCode === 'AGENT' && !agentId)
            agentId = employee.id;
    }
    console.log('seeded employees (founder + demo with HRMS profiles)');
    return { founderId: founder.id, agentId };
}
async function seedCrops() {
    const ids = [];
    for (const crop of PROVISIONAL_CROPS) {
        const row = await prisma.crop.upsert({
            where: { code: crop.code },
            update: { name: crop.name, localName: crop.localName, category: crop.category, isActive: crop.isActive ?? true },
            create: { code: crop.code, name: crop.name, localName: crop.localName, category: crop.category, isActive: crop.isActive ?? true },
        });
        ids.push(row.id);
    }
    console.log(`seeded ${PROVISIONAL_CROPS.length} crops (grounded catalog)`);
    return ids;
}
async function seedGuidance(founderId) {
    for (const def of GUIDANCE_SEED) {
        const crop = await prisma.crop.findUnique({ where: { code: def.cropCode } });
        if (!crop) {
            console.warn(`guidance seed: crop ${def.cropCode} missing — skipping`);
            continue;
        }
        const existing = await prisma.cropProductGuidance.findFirst({
            where: { cropId: crop.id, problemType: def.problemType, problemKeywords: { has: def.problemKeywords[0] ?? '' } },
        });
        if (existing) {
            await prisma.cropProductGuidance.update({
                where: { id: existing.id },
                data: {
                    problemType: def.problemType,
                    problemKeywords: def.problemKeywords,
                    recommendedProducts: def.recommendedProducts,
                    usageGuidance: def.usageGuidance,
                },
            });
            continue;
        }
        await prisma.cropProductGuidance.create({
            data: {
                cropId: crop.id,
                problemType: def.problemType,
                problemKeywords: def.problemKeywords,
                recommendedProducts: def.recommendedProducts,
                usageGuidance: def.usageGuidance,
                notes: 'Seed — verified starter guidance from grotecagro.com; curate via the assistant content API.',
                createdById: founderId,
            },
        });
    }
    console.log(`seeded ${GUIDANCE_SEED.length} crop/product guidance rows (assistant)`);
}
async function seedDemoCustomers(founderId, agentId, cropIds) {
    if (!agentId) {
        console.warn('no AGENT seeded — skipping demo customers/leads');
        return;
    }
    for (const demo of DEMO_CUSTOMERS) {
        const existing = await prisma.customerPhone.findFirst({
            where: { phoneE164: `+91${demo.phone}`, deletedAt: null },
        });
        if (existing)
            continue;
        const codeRows = (await prisma.$queryRaw `SELECT nextval('farmer_code_seq') AS n`);
        const farmerCode = `GF${String(Number(codeRows[0]?.n ?? 0)).padStart(8, '0')}`;
        const customer = await prisma.customer.create({
            data: {
                farmerCode,
                fullName: demo.name,
                createdById: founderId,
                phones: {
                    create: { phoneE164: `+91${demo.phone}`, rawInput: demo.phone, isPrimary: true, createdById: founderId },
                },
                locations: {
                    create: {
                        village: demo.village,
                        district: demo.district,
                        state: demo.state,
                        isPrimary: true,
                        createdById: founderId,
                    },
                },
                crops: {
                    create: {
                        cropId: cropIds[demo.cropIndex % cropIds.length],
                        acreage: demo.acreage,
                        unit: 'acre',
                        createdById: founderId,
                    },
                },
            },
        });
        if (cropIds.length > 0) {
            await prisma.customerCrop.create({
                data: {
                    customerId: customer.id,
                    cropId: cropIds[(demo.cropIndex + 1) % cropIds.length],
                    acreage: demo.acreage / 2,
                    unit: 'acre',
                    createdById: founderId,
                },
            });
        }
        console.log(`demo customer: ${demo.name} (+91${demo.phone})`);
    }
    // Demo lead on each demo customer, owned by the demo agent.
    const customers = await prisma.customer.findMany({
        where: { phones: { some: { phoneE164: { in: DEMO_CUSTOMERS.map((c) => `+91${c.phone}`) }, deletedAt: null } } },
        orderBy: { createdAt: 'asc' },
    });
    for (const customer of customers) {
        const leadCount = await prisma.lead.count({ where: { customerId: customer.id, deletedAt: null } });
        if (leadCount > 0)
            continue;
        await prisma.$transaction(async (tx) => {
            const lead = await tx.lead.create({
                data: {
                    customerId: customer.id,
                    source: 'DEMO',
                    notes: 'Demo lead created by seed',
                    createdById: founderId,
                },
            });
            await tx.leadOwnership.create({
                data: { leadId: lead.id, employeeId: agentId, assignedById: founderId, reason: 'seed' },
            });
        });
    }
    console.log('seeded demo leads (owned by demo agent)');
}
/** A few completed demo calls so the calling workspace has history to show. */
async function seedDemoCalls(agentId) {
    if (!agentId)
        return;
    const leads = await prisma.lead.findMany({
        where: { deletedAt: null, status: 'OPEN' },
        include: { customer: true },
        orderBy: { createdAt: 'asc' },
        take: 3,
    });
    for (const lead of leads) {
        const existing = await prisma.call.count({ where: { leadId: lead.id } });
        if (existing > 0)
            continue;
        const endedAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
        const startedAt = new Date(endedAt.getTime() - 2 * 60 * 1000);
        const connectedAt = new Date(startedAt.getTime() + 30 * 1000);
        const phone = await prisma.customerPhone.findFirst({
            where: { customerId: lead.customer.id, deletedAt: null },
            orderBy: { isPrimary: 'desc' },
        });
        await prisma.call.create({
            data: {
                customerId: lead.customer.id,
                leadId: lead.id,
                agentId,
                phoneNumber: phone?.phoneE164 ?? '+919876543200',
                direction: 'OUTBOUND',
                status: 'ENDED',
                provider: 'mock',
                providerCallId: `seed_${randomUUID()}`,
                startedAt,
                connectedAt,
                endedAt,
                disconnectReason: 'AGENT_ENDED',
                notes: {
                    create: [{ authorId: agentId, body: 'Intro call — farmer interested in seed availability for this season.' }],
                },
            },
        });
    }
    console.log('seeded demo call history');
}
/**
 * Month 4 demo: two converted (Sales) customers under the seeded Manager's RM
 * ownership, with a customer note + pending follow-up each, so the Relationship
 * Manager workspace has real content on first run. Idempotent per customer.
 */
async function seedRelationshipDemo() {
    const manager = await prisma.employee.findUnique({ where: { email: (process.env.RELATIONSHIP_MANAGER_EMAIL ?? 'manager@grotec.local').toLowerCase() } });
    const agent = await prisma.employee.findFirst({ where: { role: { code: 'AGENT' }, status: 'ACTIVE' } });
    if (!manager || !agent) {
        console.warn('seedRelationshipDemo: manager or agent missing — skipping');
        return;
    }
    // Demo customers 004/005 (not the queue's 001-003, which keep call history).
    const demoCustomers = await prisma.customer.findMany({
        where: { phones: { some: { phoneE164: { in: ['+919876543004', '+919876543005'] }, deletedAt: null } } },
        orderBy: { createdAt: 'asc' },
    });
    for (const customer of demoCustomers) {
        const already = await prisma.relationshipOwnership.count({ where: { customerId: customer.id, releasedAt: null } });
        if (already > 0)
            continue;
        await prisma.$transaction(async (tx) => {
            // Convert: close the demo lead and release the agent's ownership.
            const lead = await tx.lead.findFirst({ where: { customerId: customer.id, deletedAt: null, status: 'OPEN' } });
            if (lead) {
                await tx.lead.update({ where: { id: lead.id }, data: { status: 'CLOSED' } });
                await tx.leadOwnership.updateMany({ where: { leadId: lead.id, releasedAt: null }, data: { releasedAt: new Date() } });
            }
            const row = await tx.relationshipOwnership.create({
                data: { customerId: customer.id, employeeId: manager.id, assignedById: manager.id, reason: 'conversion_sales' },
            });
            await tx.customerNote.create({
                data: {
                    customerId: customer.id,
                    authorId: manager.id,
                    body: 'Converted over a follow-up visit plan — follow the label advice for this season; prefers evening calls.',
                },
            });
            await tx.followUp.create({
                data: {
                    customerId: customer.id,
                    leadId: lead?.id ?? null,
                    agentId: agent.id,
                    dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
                    note: customer.fullName === 'Lakshmi Devi' ? 'Share Ultra Action + plan ahead of mango flowering; check orchard size.' : 'Share the recommended Grotec plan for this season; confirm next visit window.',
                    status: 'PENDING',
                },
            });
            console.log(`demo RM customer: ${customer.fullName} (ownership ${row.id.slice(0, 8)}…)`);
        });
    }
}
async function seedLeaveTypes() {
    const types = [
        { code: 'CASUAL', name: 'Casual Leave', quotaDays: 12, isPaid: true, allowCarryForward: false },
        { code: 'SICK', name: 'Sick Leave', quotaDays: 12, isPaid: true, allowCarryForward: false },
        { code: 'PAID', name: 'Earned / Privilege Leave', quotaDays: 15, isPaid: true, allowCarryForward: true },
        { code: 'UNPAID', name: 'Loss of Pay', quotaDays: 0, isPaid: false, allowCarryForward: false },
    ];
    for (const t of types) {
        await prisma.leaveType.upsert({
            where: { code: t.code },
            update: { name: t.name, quotaDays: t.quotaDays, isPaid: t.isPaid, allowCarryForward: t.allowCarryForward },
            create: t,
        });
    }
    const currentYear = new Date().getFullYear();
    const employees = await prisma.employee.findMany({
        where: { role: { code: { not: 'FOUNDER' } } },
    });
    const leaveTypes = await prisma.leaveType.findMany({ where: { isPaid: true } });
    for (const emp of employees) {
        for (const lt of leaveTypes) {
            await prisma.leaveBalance.upsert({
                where: { employeeId_leaveTypeId_year: { employeeId: emp.id, leaveTypeId: lt.id, year: currentYear } },
                update: {},
                create: {
                    employeeId: emp.id,
                    leaveTypeId: lt.id,
                    year: currentYear,
                    allocated: lt.quotaDays,
                    used: 0,
                    balance: lt.quotaDays,
                },
            });
        }
    }
    console.log('seeded leave types and employee balances');
}
async function seedEssl() {
    const device = await prisma.esslDevice.upsert({
        where: { deviceCode: 'ESSL-HQ-01' },
        update: { name: 'HQ Main Biometric', location: 'Hyderabad HQ', isActive: true },
        create: { deviceCode: 'ESSL-HQ-01', name: 'HQ Main Biometric', location: 'Hyderabad HQ', ipAddress: '192.168.1.200', isActive: true },
    });
    const employees = await prisma.employee.findMany({ orderBy: { createdAt: 'asc' } });
    for (let i = 0; i < employees.length; i++) {
        const emp = employees[i];
        await prisma.esslDeviceMapping.upsert({
            where: { deviceId_biometricPin: { deviceId: device.id, biometricPin: `100${i + 1}` } },
            update: {},
            create: { employeeId: emp.id, deviceId: device.id, biometricPin: `100${i + 1}` },
        });
    }
    console.log('seeded ESSL biometric device and mappings');
}
async function seedSalaryRevisions() {
    const employees = await prisma.employee.findMany();
    const baseSalaries = {
        'EMP0001': 150000,
        'EMP0002': 75000,
        'EMP0003': 35000,
        'EMP0004': 30000,
    };
    for (const emp of employees) {
        const base = baseSalaries[emp.employeeCode ?? ''] ?? 30000;
        const hra = Math.round(base * 0.4);
        const conveyance = 2000;
        const specialAllowance = Math.round(base * 0.2);
        const gross = base + hra + conveyance + specialAllowance;
        const pf = 1800;
        const pt = 200;
        const deductions = pf + pt;
        const net = gross - deductions;
        const existing = await prisma.salaryRevision.findFirst({
            where: { employeeId: emp.id, revisionNumber: 1 },
        });
        if (!existing) {
            await prisma.salaryRevision.create({
                data: {
                    employeeId: emp.id,
                    revisionNumber: 1,
                    effectiveFrom: new Date('2025-01-01'),
                    baseSalary: base,
                    components: [
                        { name: 'Basic', type: 'EARNING', amount: base, taxable: true },
                        { name: 'HRA', type: 'EARNING', amount: hra, taxable: true },
                        { name: 'Conveyance', type: 'EARNING', amount: conveyance, taxable: false },
                        { name: 'Special Allowance', type: 'EARNING', amount: specialAllowance, taxable: true },
                        { name: 'Provident Fund', type: 'DEDUCTION', amount: pf, taxable: false },
                        { name: 'Professional Tax', type: 'DEDUCTION', amount: pt, taxable: false },
                    ],
                    grossSalary: gross,
                    totalDeductions: deductions,
                    netSalary: net,
                    notes: 'Initial salary baseline per Phase 1 appointment',
                },
            });
        }
    }
    console.log('seeded salary revisions');
}
async function seedAttendance() {
    const employees = await prisma.employee.findMany({
        where: { role: { code: { not: 'FOUNDER' } } },
    });
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    for (const emp of employees) {
        for (let day = 1; day <= 7; day++) {
            const date = new Date(year, month, day);
            const isWeekend = date.getDay() === 0;
            const status = isWeekend ? 'WEEKLY_OFF' : (day === 4 && emp.employeeCode === 'EMP0003' ? 'HALF_DAY' : 'PRESENT');
            const source = day % 2 === 0 ? 'ESSL' : 'MANUAL';
            const punchIn = status === 'PRESENT' || status === 'HALF_DAY' ? new Date(year, month, day, 9, 15) : null;
            const punchOut = status === 'PRESENT' ? new Date(year, month, day, 18, 30) : (status === 'HALF_DAY' ? new Date(year, month, day, 13, 30) : null);
            await prisma.attendanceRecord.upsert({
                where: { employeeId_date: { employeeId: emp.id, date } },
                update: {},
                create: {
                    employeeId: emp.id,
                    date,
                    status,
                    source,
                    punchIn,
                    punchOut,
                    checkInDevice: source === 'ESSL' ? 'ESSL-HQ-01' : null,
                    approvalStatus: 'APPROVED',
                    approvedAt: new Date(year, month, day, 19, 0),
                },
            });
        }
    }
    console.log('seeded attendance history');
}
async function seedKpi() {
    const agent = await prisma.employee.findFirst({ where: { email: 'agent@grotec.local' } });
    if (!agent)
        return;
    const currentPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const targets = [
        { metric: 'CALLS_DIALED', targetValue: 100, weight: 1.5 },
        { metric: 'CALLS_CONNECTED', targetValue: 60, weight: 1.5 },
        { metric: 'LEADS_CONVERTED', targetValue: 10, weight: 2.0 },
        { metric: 'CONVERSION_RATE', targetValue: 15, weight: 1.0 },
        { metric: 'TOTAL_REVENUE', targetValue: 50000, weight: 1.0 },
        { metric: 'ATTENDANCE', targetValue: 95, weight: 1.0 },
    ];
    for (const t of targets) {
        const existing = await prisma.kpiTarget.findFirst({
            where: { employeeId: agent.id, period: currentPeriod, metric: t.metric },
        });
        if (!existing) {
            await prisma.kpiTarget.create({
                data: {
                    employeeId: agent.id,
                    period: currentPeriod,
                    metric: t.metric,
                    targetValue: t.targetValue,
                    weight: t.weight,
                },
            });
        }
    }
    console.log('seeded KPI targets');
}
async function seedPayroll() {
    const agent = await prisma.employee.findFirst({ where: { email: 'agent@grotec.local' } });
    if (agent) {
        const existingAdvance = await prisma.advanceLedger.findFirst({ where: { employeeId: agent.id } });
        if (!existingAdvance) {
            await prisma.advanceLedger.create({
                data: {
                    employeeId: agent.id,
                    amount: 5000,
                    runningBalance: 5000,
                    reason: 'Festival emergency advance',
                    status: 'ACTIVE',
                },
            });
        }
    }
    console.log('seeded advances');
}
async function seedKpiMetricDefinitions() {
    const definitions = [
        { code: 'CALLS_DIALED', name: 'Calls Dialed', sourceNote: 'computed from Call table' },
        { code: 'CALLS_CONNECTED', name: 'Calls Connected', sourceNote: 'computed from Call table' },
        { code: 'LEADS_CONVERTED', name: 'Leads Converted', sourceNote: 'computed from Lead/Call linkage' },
        { code: 'CONVERSION_RATE', name: 'Conversion Rate', sourceNote: 'computed: leads converted / calls connected' },
        { code: 'TOTAL_REVENUE', name: 'Total Revenue', sourceNote: 'UNCONFIRMED — no Phase 1 data source, see PRD Appendix C' },
    ];
    for (const def of definitions) {
        await prisma.kpiMetricDefinition.upsert({
            where: { code: def.code },
            update: { name: def.name, sourceNote: def.sourceNote },
            create: { code: def.code, name: def.name, sourceNote: def.sourceNote, isActive: true },
        });
    }
    console.log('seeded 5 KPI metric definitions');
}
async function main() {
    await prisma.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS farmer_code_seq START WITH 1 INCREMENT BY 1;`);
    await prisma.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS employee_code_seq START WITH 1 INCREMENT BY 1;`);
    await seedPermissions();
    await seedRoles();
    const { founderId, agentId } = await seedEmployees();
    const cropIds = await seedCrops();
    await seedGuidance(founderId);
    await seedDemoCustomers(founderId, agentId, cropIds);
    await seedDemoCalls(agentId);
    await seedRelationshipDemo();
    await seedLeaveTypes();
    await seedEssl();
    await seedSalaryRevisions();
    await seedAttendance();
    await seedKpiMetricDefinitions();
    await seedKpi();
    await seedPayroll();
    const counts = {
        employees: await prisma.employee.count(),
        customers: await prisma.customer.count(),
        leads: await prisma.lead.count(),
        crops: await prisma.crop.count(),
        calls: await prisma.call.count(),
        guidance: await prisma.cropProductGuidance.count(),
    };
    console.log('seed complete:', counts);
}
main()
    .catch((error) => {
    console.error(error);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma.$disconnect();
});
