import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import {
  PERMISSION_CODES,
  PERMISSIONS,
  PROPOSED_ROLE_PERMISSIONS,
  ROLE_CODES,
  ROLE_LABELS,
  type PermissionCode,
  type RoleCode,
} from '@grotec/shared';
import { hashPassword } from '../src/modules/auth/password.util';

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
const PROVISIONAL_CROPS: Array<{ code: string; name: string; localName: string; category: 'FIELD' | 'TREE' | 'PLANTATION' | 'VEGETABLE' | 'OTHER' }> = [
  { code: 'RICE', name: 'Rice (Paddy)', localName: 'Dhaan', category: 'FIELD' },
  { code: 'WHEAT', name: 'Wheat', localName: 'Gehu', category: 'FIELD' },
  { code: 'MAIZE', name: 'Maize', localName: 'Makka', category: 'FIELD' },
  { code: 'SUGARCANE', name: 'Sugarcane', localName: 'Ganna', category: 'FIELD' },
  { code: 'COTTON', name: 'Cotton', localName: 'Kapas', category: 'FIELD' },
  { code: 'SOYBEAN', name: 'Soybean', localName: 'Soyabean', category: 'FIELD' },
  { code: 'TOMATO', name: 'Tomato', localName: 'Tamatar', category: 'VEGETABLE' },
  { code: 'POTATO', name: 'Potato', localName: 'Aloo', category: 'VEGETABLE' },
  { code: 'ONION', name: 'Onion', localName: 'Pyaaz', category: 'VEGETABLE' },
  { code: 'CHILLI', name: 'Chilli', localName: 'Mirch', category: 'VEGETABLE' },
  { code: 'BANANA', name: 'Banana', localName: 'Kela', category: 'PLANTATION' },
  { code: 'MANGO', name: 'Mango', localName: 'Aam', category: 'TREE' },
  { code: 'GROUNDNUT', name: 'Groundnut', localName: 'Moongphali', category: 'FIELD' },
  { code: 'MUSTARD', name: 'Mustard', localName: 'Sarson', category: 'FIELD' },
  { code: 'GRAM', name: 'Chickpea (Gram)', localName: 'Chana', category: 'FIELD' },
];

// Provisional starter guidance for the AI Assistant, built from the real Grotec
// product catalog (docs/company-context.md). Rows are editable by Founder/Manager
// through the assistant content API; usage text is generic so nothing invents a
// label claim — follow the product label (FCO 1985).
// problemType follows the PRD §6.5.2 taxonomy (PEST | DISEASE |
// NUTRIENT_DEFICIENCY | WEED | OTHER); provisional rows are tagged from their
// own keywords — pest/disease claims need GROTEC curation before use.
const GUIDANCE_SEED: Array<{
  cropCode: string;
  problemType: 'PEST' | 'DISEASE' | 'NUTRIENT_DEFICIENCY' | 'WEED' | 'OTHER';
  problemKeywords: string[];
  recommendedProducts: string[];
  usageGuidance: string;
}> = [
  { cropCode: 'RICE', problemType: 'NUTRIENT_DEFICIENCY', problemKeywords: ['leaf yellowing', 'nitrogen deficiency', 'poor tillering'], recommendedProducts: ['Azos', 'Bio Jeevan PF'], usageGuidance: 'Seed/soil application at sowing; repeat at tillering as per the Grotec label.' },
  { cropCode: 'RICE', problemType: 'OTHER', problemKeywords: ['low yield', 'general weakness', 'soil health'], recommendedProducts: ['Azotob', 'Organic Fertilizer'], usageGuidance: 'Apply organic manure at land preparation; Azotob at sowing and 30 days after.' },
  { cropCode: 'WHEAT', problemType: 'NUTRIENT_DEFICIENCY', problemKeywords: ['yellowing', 'stunted growth', 'low tillering'], recommendedProducts: ['Azos', 'Bio Jeevan TV'], usageGuidance: 'Seed treatment at sowing; foliar follow-up during active growth per label.' },
  { cropCode: 'SUGARCANE', problemType: 'OTHER', problemKeywords: ['poor cane growth', 'ratoon recovery', 'soil health'], recommendedProducts: ['Azotob', 'Organic Fertilizer'], usageGuidance: 'Soil application along the furrows; repeat after ratoon initiation as per label.' },
  { cropCode: 'COTTON', problemType: 'OTHER', problemKeywords: ['square drop', 'flower drop', 'growth stress'], recommendedProducts: ['Ultra Action +', 'Trishul'], usageGuidance: 'Foliar application at square formation and flowering stages; follow the Grotec label.' },
  { cropCode: 'SOYBEAN', problemType: 'NUTRIENT_DEFICIENCY', problemKeywords: ['poor nodulation', 'root development', 'phosphorus'], recommendedProducts: ['Rhizob', 'PHOS'], usageGuidance: 'Seed treatment before sowing so rhizobial + phosphate inoculants establish early.' },
  { cropCode: 'GROUNDNUT', problemType: 'NUTRIENT_DEFICIENCY', problemKeywords: ['poor pod filling', 'yellowing', 'root development'], recommendedProducts: ['Rhizob', 'Micromix'], usageGuidance: 'Seed treatment at sowing; Micromix as foliar/soil supplement per label.' },
  { cropCode: 'TOMATO', problemType: 'OTHER', problemKeywords: ['flower drop', 'poor fruit set', 'heat stress'], recommendedProducts: ['Ultra Action +', 'Asthra'], usageGuidance: 'Spray during flowering to support fruit set; repeat as per the Grotec label.' },
  { cropCode: 'POTATO', problemType: 'NUTRIENT_DEFICIENCY', problemKeywords: ['weak growth', 'poor bulking', 'soil fertility'], recommendedProducts: ['Sanjeevini Gel', 'Bio Jeevan PF'], usageGuidance: 'Gel/formulation per the label; apply at early growth for healthy tuber bulking.' },
  { cropCode: 'ONION', problemType: 'NUTRIENT_DEFICIENCY', problemKeywords: ['poor bulbing', 'leaf yellowing', 'weak growth'], recommendedProducts: ['Bio Jeevan TV', 'Micromix'], usageGuidance: 'Soil/foliar application during bulb initiation; follow product label rates.' },
  { cropCode: 'MANGO', problemType: 'OTHER', problemKeywords: ['poor flowering', 'fruit drop', 'drought stress'], recommendedProducts: ['Thavam', 'Ultra Action +'], usageGuidance: 'Apply before flowering and again at fruit set; dosage per the Grotec label.' },
  { cropCode: 'BANANA', problemType: 'OTHER', problemKeywords: ['poor bunch weight', 'sucker growth', 'general weakness'], recommendedProducts: ['Sanjeevini Gel', 'Bio Jeevan TV'], usageGuidance: 'Apply during active vegetative growth; follow the label for stage-based repeats.' },
  { cropCode: 'CHILLI', problemType: 'OTHER', problemKeywords: ['flower drop', 'poor fruit set', 'stress'], recommendedProducts: ['Ultra Action +', 'Asthra'], usageGuidance: 'Foliar at flowering; repeat as needed per the Grotec label.' },
];

const DEMO_CUSTOMERS: Array<{ name: string; phone: string; village: string; district: string; state: string; cropIndex: number; acreage: number }> = [
  { name: 'Ramesh Patel', phone: '9876543001', village: 'Kothapalli', district: 'Warangal', state: 'Telangana', cropIndex: 0, acreage: 4.5 },
  { name: 'Suresh Kumar', phone: '9876543002', village: 'Peddapalli', district: 'Karimnagar', state: 'Telangana', cropIndex: 5, acreage: 2.25 },
  { name: 'Amar Singh', phone: '9876543003', village: 'Bidar', district: 'Nanded', state: 'Maharashtra', cropIndex: 3, acreage: 6.0 },
  { name: 'Lakshmi Devi', phone: '9876543004', village: 'Chittoor', district: 'Chittoor', state: 'Andhra Pradesh', cropIndex: 11, acreage: 1.75 },
  { name: 'Mohan Das', phone: '9876543005', village: 'Khammam', district: 'Khammam', state: 'Telangana', cropIndex: 7, acreage: 3.0 },
];

async function seedPermissions(): Promise<void> {
  for (const code of PERMISSION_CODES) {
    await prisma.permission.upsert({
      where: { code },
      update: { module: code.split('.')[0] ?? 'crm' },
      create: { code, module: code.split('.')[0] ?? 'crm', description: `Permission ${code}` },
    });
  }
  console.log(`seeded ${PERMISSION_CODES.length} permissions`);
}

async function seedRoles(): Promise<void> {
  for (const code of ROLE_CODES) {
    const role = await prisma.role.upsert({
      where: { code },
      update: { name: ROLE_LABELS[code] },
      create: { code, name: ROLE_LABELS[code] },
    });
    const matrix = PROPOSED_ROLE_PERMISSIONS[code as RoleCode] as readonly PermissionCode[];
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

async function findRole(code: RoleCode) {
  const role = await prisma.role.findUnique({ where: { code } });
  if (!role) throw new Error(`Role ${code} missing after seed`);
  return role;
}

async function seedEmployees(): Promise<{ founderId: string; agentId?: string }> {
  const founderEmail = (process.env.FOUNDER_EMAIL ?? 'founder@grotec.local').toLowerCase();
  const founderName = process.env.FOUNDER_NAME ?? 'Grotec Founder';
  const founderPassword = process.env.FOUNDER_PASSWORD ?? 'Founder@123';
  const founderRole = await findRole('FOUNDER');

  const founder = await prisma.employee.upsert({
    where: { email: founderEmail },
    update: { fullName: founderName, roleId: founderRole.id, status: 'ACTIVE' },
    create: {
      email: founderEmail,
      fullName: founderName,
      roleId: founderRole.id,
      passwordHash: await hashPassword(founderPassword),
    },
  });

  let agentId: string | undefined;
  const spec = process.env.SEED_EMPLOYEES ?? '';
  for (const entry of spec.split(';').map((s) => s.trim()).filter(Boolean)) {
    const [name, email, roleRaw] = entry.split(',').map((s) => s.trim());
    const roleCode = roleRaw as RoleCode;
    if (!name || !email || !ROLE_CODES.includes(roleCode)) {
      console.warn(`skipping malformed SEED_EMPLOYEES entry: "${entry}"`);
      continue;
    }
    const role = await findRole(roleCode);
    const employee = await prisma.employee.upsert({
      where: { email: email.toLowerCase() },
      update: { fullName: name, roleId: role.id, status: 'ACTIVE' },
      create: {
        email: email.toLowerCase(),
        fullName: name,
        roleId: role.id,
        passwordHash: await hashPassword(founderPassword),
      },
    });
    if (roleCode === 'AGENT' && !agentId) agentId = employee.id;
  }
  console.log('seeded employees (founder + demo)');
  return { founderId: founder.id, agentId };
}

async function seedCrops(): Promise<string[]> {
  const ids: string[] = [];
  for (const crop of PROVISIONAL_CROPS) {
    const row = await prisma.crop.upsert({
      where: { code: crop.code },
      update: { name: crop.name, localName: crop.localName, category: crop.category, isActive: true },
      create: { code: crop.code, name: crop.name, localName: crop.localName, category: crop.category },
    });
    ids.push(row.id);
  }
  console.log(`seeded ${PROVISIONAL_CROPS.length} crops (provisional catalog)`);
  return ids;
}

async function seedGuidance(founderId: string): Promise<void> {
  for (const def of GUIDANCE_SEED) {
    const crop = await prisma.crop.findUnique({ where: { code: def.cropCode } });
    if (!crop) {
      console.warn(`guidance seed: crop ${def.cropCode} missing — skipping`);
      continue;
    }
    const existing = await prisma.cropProductGuidance.findFirst({
      where: { cropId: crop.id, problemKeywords: { has: def.problemKeywords[0] ?? '' } },
    });
    if (existing) {
      // Backfill taxonomy on rows seeded before problemType existed.
      await prisma.cropProductGuidance.update({
        where: { id: existing.id },
        data: { problemType: def.problemType },
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
        notes: 'Seed — provisional starter guidance; curate via the assistant content API.',
        createdById: founderId,
      },
    });
  }
  console.log(`seeded ${GUIDANCE_SEED.length} crop/product guidance rows (assistant)`);
}

async function seedDemoCustomers(founderId: string, agentId: string | undefined, cropIds: string[]): Promise<void> {
  if (!agentId) {
    console.warn('no AGENT seeded — skipping demo customers/leads');
    return;
  }
  for (const demo of DEMO_CUSTOMERS) {
    const existing = await prisma.customerPhone.findFirst({
      where: { phoneE164: `+91${demo.phone}`, deletedAt: null },
    });
    if (existing) continue;

    const codeRows = (await prisma.$queryRaw`SELECT nextval('farmer_code_seq') AS n`) as Array<{ n: bigint }>;
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
            cropId: cropIds[demo.cropIndex % cropIds.length] as string,
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
          cropId: cropIds[(demo.cropIndex + 1) % cropIds.length] as string,
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
    if (leadCount > 0) continue;
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
async function seedDemoCalls(agentId: string | undefined): Promise<void> {
  if (!agentId) return;
  const leads = await prisma.lead.findMany({
    where: { deletedAt: null, status: 'OPEN' },
    include: { customer: true },
    orderBy: { createdAt: 'asc' },
    take: 3,
  });
  for (const lead of leads) {
    const existing = await prisma.call.count({ where: { leadId: lead.id } });
    if (existing > 0) continue;
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
async function seedRelationshipDemo(): Promise<void> {
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
    if (already > 0) continue;
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

async function main(): Promise<void> {
  await seedPermissions();
  await seedRoles();
  const { founderId, agentId } = await seedEmployees();
  const cropIds = await seedCrops();
  await seedGuidance(founderId);
  await seedDemoCustomers(founderId, agentId, cropIds);
  await seedDemoCalls(agentId);
  await seedRelationshipDemo();

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
