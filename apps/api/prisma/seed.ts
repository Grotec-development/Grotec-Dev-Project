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

  const demoEmployeeProfiles: Record<string, { code: string; designation: string; department: string; experience: string; joiningDate: Date }> = {
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
    if (roleCode === 'AGENT' && !agentId) agentId = employee.id;
  }
  console.log('seeded employees (founder + demo with HRMS profiles)');
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

async function seedLeaveTypes(): Promise<void> {
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
  const employees = await prisma.employee.findMany();
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

async function seedEssl(): Promise<void> {
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

async function seedSalaryRevisions(): Promise<void> {
  const employees = await prisma.employee.findMany();
  const baseSalaries: Record<string, number> = {
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

async function seedAttendance(): Promise<void> {
  const employees = await prisma.employee.findMany();
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

async function seedKpi(): Promise<void> {
  const agent = await prisma.employee.findFirst({ where: { email: 'agent@grotec.local' } });
  if (!agent) return;

  const currentPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const targets = [
    { metric: 'CALLS_DIALED' as const, targetValue: 100, weight: 1.5 },
    { metric: 'CALLS_CONNECTED' as const, targetValue: 60, weight: 1.5 },
    { metric: 'LEADS_CONVERTED' as const, targetValue: 10, weight: 2.0 },
    { metric: 'CONVERSION_RATE' as const, targetValue: 15, weight: 1.0 },
    { metric: 'TOTAL_REVENUE' as const, targetValue: 50000, weight: 1.0 },
    { metric: 'ATTENDANCE' as const, targetValue: 95, weight: 1.0 },
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

async function seedPayroll(): Promise<void> {
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

async function seedKpiMetricDefinitions(): Promise<void> {
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

async function main(): Promise<void> {
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
