import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaClient, AttendanceStatus, AttendanceSource, ApprovalStatus, FollowUpStatus, EmployeeRequestType, EmployeeRequestStatus } from '@prisma/client';
import { hashPassword } from '../src/modules/auth/password.util.js';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting GROTEC FarmerOS Production Cleanup & Data Enrichment ---');

  // 1. Purge obsolete test accounts
  const purged = await prisma.employee.deleteMany({
    where: {
      email: { in: ['tharunarulkumar@gmail.com', 'noobg7277@gmail.com'] },
    },
  });
  console.log(`Purged ${purged.count} old test accounts.`);

  // 2. Resolve default tenant
  let tenant = await prisma.tenant.findFirst({ where: { deletedAt: null } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        code: 'GROTEC-HQ',
        name: 'GROTEC Agri Technologies HQ',
        status: 'ACTIVE',
      },
    });
  }
  const tenantId = tenant.id;

  // 3. Ensure standard department accounts with consistent scrypt password
  const defaultHash = await hashPassword('Grotec2026!');
  const founderHash = await hashPassword('Founder@Grotec2026!');
  const managerHash = await hashPassword('Manager@Grotec2026!');
  const agent1Hash = await hashPassword('Agent1@Grotec2026!');
  const agent2Hash = await hashPassword('Agent2@Grotec2026!');
  const agent3Hash = await hashPassword('Agent3@Grotec2026!');
  const agentHash = await hashPassword('Agent@Grotec2026!');
  const driverHash = await hashPassword('Driver@Grotec2026!');
  const hrHash = await hashPassword('Hr@Grotec2026!');
  const qaHash = await hashPassword('Qa@Grotec2026!');
  const dispatchHash = await hashPassword('Dispatch@Grotec2026!');
  const inventoryHash = await hashPassword('Inventory@Grotec2026!');
  const staffHash = await hashPassword('Staff@Grotec2026!');

  // Roles map
  const roles = await prisma.role.findMany();
  const roleMap = new Map(roles.map((r) => [r.code, r.id]));

  const accounts = [
    { email: 'founder@grotec.local', fullName: 'Grotec Founder', roleCode: 'FOUNDER', dept: 'Management', pass: founderHash },
    { email: 'grotecdatabase@gmail.com', fullName: 'Grotec Founder (Alt)', roleCode: 'FOUNDER', dept: 'Management', pass: founderHash },
    { email: 'manager@grotec.local', fullName: 'Farmer Success Manager', roleCode: 'FARMER_SUCCESS_MANAGER', dept: 'Agronomy Operations', pass: managerHash },
    { email: 'agent_1@grotec.local', fullName: 'Kavitha S (Agent 1)', roleCode: 'AGENT', dept: 'Telecalling Team 1', pass: agent1Hash },
    { email: 'agent_2@grotec.local', fullName: 'Prakash R (Agent 2)', roleCode: 'AGENT', dept: 'Telecalling Team 2', pass: agent2Hash },
    { email: 'agent_3@grotec.local', fullName: 'Deepa M (Agent 3)', roleCode: 'AGENT', dept: 'Telecalling Team 3', pass: agent3Hash },
    { email: 'agent@grotec.local', fullName: 'Agent Lead', roleCode: 'AGENT', dept: 'Telecalling General', pass: agentHash },
    { email: 'delivery@grotec.local', fullName: 'Murugan K (Logistics Driver)', roleCode: 'DELIVERY', dept: 'Logistics & Dispatch', pass: driverHash },
    { email: 'driver@grotec.local', fullName: 'Murugan K (Driver Alt)', roleCode: 'DELIVERY', dept: 'Logistics & Dispatch', pass: driverHash },
    { email: 'staff@grotec.local', fullName: 'Ananya R (HR Officer)', roleCode: 'HR_ADMIN', dept: 'Human Resources', pass: hrHash },
    { email: 'hr@grotec.local', fullName: 'Ananya R (HR Alt)', roleCode: 'HR_ADMIN', dept: 'Human Resources', pass: hrHash },
    { email: 'accounts@grotec.local', fullName: 'Senthil Nathan', roleCode: 'ACCOUNTS_FINANCE', dept: 'Accounts & Finance', pass: defaultHash },
    { email: 'agronomy@grotec.local', fullName: 'Dr. Ramesh Kumar (Agronomist)', roleCode: 'TECHNICAL_AGRONOMY', dept: 'Technical Agronomy', pass: qaHash },
    { email: 'qa@grotec.local', fullName: 'Dr. Ramesh Kumar (QA Alt)', roleCode: 'TECHNICAL_AGRONOMY', dept: 'Quality Assurance', pass: qaHash },
    { email: 'stores@grotec.local', fullName: 'Velusamy P', roleCode: 'STORES_DISPATCH', dept: 'Warehouse & Dispatch', pass: dispatchHash },
    { email: 'dispatch@grotec.local', fullName: 'Velusamy P (Dispatch Alt)', roleCode: 'STORES_DISPATCH', dept: 'Warehouse & Dispatch', pass: dispatchHash },
    { email: 'inventory@grotec.local', fullName: 'Velusamy P (Inventory Alt)', roleCode: 'STORES_DISPATCH', dept: 'Warehouse Inventory', pass: inventoryHash },
  ];

  for (const acc of accounts) {
    const roleId = roleMap.get(acc.roleCode) || roleMap.get('STAFF');
    await prisma.employee.upsert({
      where: { email: acc.email },
      update: {
        fullName: acc.fullName,
        roleId,
        department: acc.dept,
        status: 'ACTIVE',
        deletedAt: null,
        passwordHash: acc.pass,
        tenantId,
      },
      create: {
        id: randomUUID(),
        email: acc.email,
        fullName: acc.fullName,
        roleId,
        department: acc.dept,
        status: 'ACTIVE',
        passwordHash: acc.pass,
        tenantId,
      },
    });
  }
  console.log(`Aligned ${accounts.length} core departmental and agent accounts.`);

  // 4. Ensure Leave Types
  let leaveType = await prisma.leaveType.findFirst({ where: { code: 'CASUAL' } });
  if (!leaveType) {
    leaveType = await prisma.leaveType.create({
      data: {
        code: 'CASUAL',
        name: 'Casual Leave',
        daysPerYear: 12,
        requiresProof: false,
      },
    });
  }

  // 5. Seed Attendance Records for Today
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const activeEmps = await prisma.employee.findMany({
    where: { status: 'ACTIVE', deletedAt: null },
    take: 8,
  });

  for (let i = 0; i < activeEmps.length; i++) {
    const emp = activeEmps[i];
    const punchIn = new Date(today.getTime() + (9 * 3600 + i * 180) * 1000); // 09:00 - 09:24 AM
    const isPending = i === activeEmps.length - 1; // 1 pending for approval queue

    const att = await prisma.attendanceRecord.upsert({
      where: {
        employeeId_date: {
          employeeId: emp.id,
          date: today,
        },
      },
      update: {
        status: AttendanceStatus.PRESENT,
        punchIn,
        approvalStatus: isPending ? ApprovalStatus.PENDING : ApprovalStatus.APPROVED,
      },
      create: {
        id: randomUUID(),
        employeeId: emp.id,
        date: today,
        status: AttendanceStatus.PRESENT,
        source: AttendanceSource.MANUAL,
        punchIn,
        approvalStatus: isPending ? ApprovalStatus.PENDING : ApprovalStatus.APPROVED,
      },
    });

    // Create matching punch
    const existingPunch = await prisma.attendancePunch.findFirst({
      where: { employeeId: emp.id, attendanceRecordId: att.id },
    });
    if (!existingPunch) {
      await prisma.attendancePunch.create({
        data: {
          id: randomUUID(),
          employeeId: emp.id,
          attendanceRecordId: att.id,
          punchTime: punchIn,
          punchType: 'IN',
        },
      });
    }
  }
  console.log(`Seeded active attendance records and punches for today.`);

  // 6. Seed Leave Applications
  const agent3 = await prisma.employee.findUnique({ where: { email: 'agent_3@grotec.local' } });
  if (agent3 && leaveType) {
    const existingLeave = await prisma.leaveApplication.findFirst({
      where: { employeeId: agent3.id, status: 'PENDING' },
    });
    if (!existingLeave) {
      const nextMon = new Date(today.getTime() + 3 * 86400000);
      const nextWed = new Date(today.getTime() + 5 * 86400000);
      await prisma.leaveApplication.create({
        data: {
          id: randomUUID(),
          employeeId: agent3.id,
          leaveTypeId: leaveType.id,
          startDate: nextMon,
          endDate: nextWed,
          daysCount: 2.0,
          reason: 'Family ceremony in hometown (Madurai)',
          status: 'PENDING',
        },
      });
      console.log('Seeded pending leave application for Agent 3.');
    }
  }

  // 7. Seed Vehicle, Sales Orders & Active Delivery Trip
  const deliveryDriver = await prisma.employee.findUnique({ where: { email: 'delivery@grotec.local' } });
  const sampleCustomers = await prisma.customer.findMany({
    where: { deletedAt: null },
    include: { locations: true, phones: true },
    take: 3,
  });
  const sampleProducts = await prisma.product.findMany({ take: 3 });

  if (deliveryDriver && sampleCustomers.length >= 3 && sampleProducts.length >= 2) {
    // 7.1 Ensure Vehicle
    const vehicle = await prisma.vehicle.upsert({
      where: { regNumber: 'TN-29-BA-4589' },
      update: { driverId: deliveryDriver.id, status: 'IN_TRANSIT', capacityKg: 2500 },
      create: {
        id: randomUUID(),
        regNumber: 'TN-29-BA-4589',
        model: 'Tata 407 LPT Heavy',
        capacityKg: 2500,
        driverId: deliveryDriver.id,
        status: 'IN_TRANSIT',
        tenantId,
      },
    });

    // 7.2 Create 3 Sales Orders
    const orders = [];
    for (let idx = 0; idx < 3; idx++) {
      const cust = sampleCustomers[idx];
      const prod = sampleProducts[idx % sampleProducts.length];
      const orderNumber = `SO-2026-0927-00${idx + 1}`;
      const loc = cust.locations[0];
      const address = loc ? `${loc.village || ''}, ${loc.taluk || ''}, ${loc.district || 'Tamil Nadu'}` : 'Tamil Nadu';

      const order = await prisma.salesOrder.upsert({
        where: { orderNumber },
        update: {},
        create: {
          id: randomUUID(),
          orderNumber,
          customerId: cust.id,
          tenantId,
          status: 'CONFIRMED',
          subtotal: 4500.0,
          discountAmount: 200.0,
          taxAmount: 225.0,
          totalAmount: 4525.0,
          paymentStatus: idx === 0 ? 'PAID' : 'UNPAID',
          paymentMethod: idx === 0 ? 'UPI' : 'CASH_ON_DELIVERY',
          deliveryAddress: address,
          createdById: deliveryDriver.id,
          items: {
            create: [
              {
                id: randomUUID(),
                productId: prod.id,
                originalQty: 10,
                approvedQty: 10,
                deliveredQty: idx === 0 ? 10 : 0,
                unitPrice: 450.0,
                taxRate: 5.0,
                taxAmount: 225.0,
                totalAmount: 4500.0,
              },
            ],
          },
        },
      });
      orders.push(order);
    }

    // 7.3 Create Active Trip with 3 Stops
    const tripNumber = 'TRIP-2026-0927-01';
    let trip = await prisma.trip.findUnique({ where: { tripNumber } });
    if (!trip) {
      trip = await prisma.trip.create({
        data: {
          id: randomUUID(),
          tripNumber,
          tenantId,
          vehicleId: vehicle.id,
          driverId: deliveryDriver.id,
          status: 'IN_TRANSIT',
          startOdometer: 45210.0,
          departureTime: new Date(Date.now() - 3600 * 2000), // 2 hours ago
          notes: 'Kongu Belt Agronomic Delivery Route — Tiruppur / Coimbatore / Erode',
          createdById: deliveryDriver.id,
          stops: {
            create: [
              {
                id: randomUUID(),
                orderId: orders[0].id,
                sequence: 1,
                status: 'COMPLETED',
                arrivedAt: new Date(Date.now() - 3600 * 1000),
                completedAt: new Date(Date.now() - 1800 * 1000),
                recipientName: sampleCustomers[0].fullName,
              },
              {
                id: randomUUID(),
                orderId: orders[1].id,
                sequence: 2,
                status: 'DELIVERING',
                recipientName: sampleCustomers[1].fullName,
              },
              {
                id: randomUUID(),
                orderId: orders[2].id,
                sequence: 3,
                status: 'PLANNED',
                recipientName: sampleCustomers[2].fullName,
              },
            ],
          },
        },
      });
      console.log(`Seeded active trip ${tripNumber} with 3 delivery stops for delivery@grotec.local.`);
    }
  }

  // 8. Seed Action Center Requests
  const agent1 = await prisma.employee.findUnique({ where: { email: 'agent_1@grotec.local' } });
  const manager = await prisma.employee.findUnique({ where: { email: 'manager@grotec.local' } });
  const existingReq = await prisma.employeeRequest.count();
  if (existingReq === 0 && agent1 && manager) {
    await prisma.employeeRequest.createMany({
      data: [
        {
          id: randomUUID(),
          tenantId,
          requesterId: agent1.id,
          assigneeId: manager.id,
          type: EmployeeRequestType.MANAGER_NOTE,
          message: 'Farmer Thangavel (GF00000001) requested 10% volume discount on 25 bags of Bio Jeevan PF for upcoming Samba season planting. Please review and confirm special pricing.',
          status: EmployeeRequestStatus.OPEN,
        },
        {
          id: randomUUID(),
          tenantId,
          requesterId: agent1.id,
          type: EmployeeRequestType.OFFICE_RESOURCE,
          message: 'Requesting replacement noise-cancelling call center USB headset for workstation 3.',
          status: EmployeeRequestStatus.IN_PROGRESS,
        },
        {
          id: randomUUID(),
          tenantId,
          requesterId: deliveryDriver.id,
          type: EmployeeRequestType.HR_INQUIRY,
          message: 'Highway toll & diesel reimbursement claims submission for Erode dispatch run.',
          status: EmployeeRequestStatus.RESOLVED,
          resolutionNote: 'Verified with fastag slips and credited to driver account.',
          resolvedAt: new Date(),
        },
      ],
    });
    console.log('Seeded 3 sample Action Center requests.');
  }

  // 9. Seed Follow-ups for Agents
  const existingFollowUps = await prisma.followUp.count({ where: { status: 'PENDING' } });
  if (existingFollowUps < 5 && sampleCustomers.length > 0 && agent1) {
    const due1 = new Date(Date.now() + 3600 * 2000); // 2 hours from now
    const due2 = new Date(Date.now() + 86400 * 1000); // tomorrow
    await prisma.followUp.createMany({
      data: [
        {
          id: randomUUID(),
          customerId: sampleCustomers[0].id,
          agentId: agent1.id,
          dueAt: due1,
          note: 'Call back regarding paddy blast control and check response to Bio Jeevan PF trial application.',
          status: FollowUpStatus.PENDING,
        },
        {
          id: randomUUID(),
          customerId: sampleCustomers[1].id,
          agentId: agent1.id,
          dueAt: due2,
          note: 'Follow up on tomato leaf curl virus symptoms; recommend neem shield spray dosage.',
          status: FollowUpStatus.PENDING,
        },
      ],
    });
    console.log('Seeded scheduled agronomic follow-up reminders.');
  }

  console.log('--- Production Cleanup & Sample Data Seeding Completed Successfully ---');
}

main()
  .catch((err) => {
    console.error('Seeding error:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
