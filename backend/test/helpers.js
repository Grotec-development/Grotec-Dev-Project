import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app-setup';
import { PrismaService } from '../src/common/prisma/prisma.service';
/**
 * Every seeded demo account shares one password: prisma/seed.js hashes
 * `process.env.FOUNDER_PASSWORD ?? 'Founder@123'` for the founder AND for each
 * SEED_EMPLOYEES entry. The fixture must read the identical source — hardcoding
 * the literal makes every login 401 whenever backend/.env sets a real value.
 * global-setup.js loads backend/.env before the workers start, and workers
 * inherit process.env, so this resolves to the same value the seed used.
 */
const SEEDED_PASSWORD = process.env.FOUNDER_PASSWORD ?? 'Founder@123';
export const USERS = {
    FOUNDER: { email: 'founder@grotec.local', password: SEEDED_PASSWORD, roleCode: 'FOUNDER' },
    MANAGER: { email: 'manager@grotec.local', password: SEEDED_PASSWORD, roleCode: 'MANAGER' },
    AGENT: { email: 'agent@grotec.local', password: SEEDED_PASSWORD, roleCode: 'AGENT' },
    DELIVERY: { email: 'delivery@grotec.local', password: SEEDED_PASSWORD, roleCode: 'DELIVERY' },
    STAFF: { email: 'delivery@grotec.local', password: SEEDED_PASSWORD, roleCode: 'DELIVERY' },
};
/** Compiles and boots the real application against the seeded test database. */
export async function createTestApp() {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    await configureApp(app, { swagger: false });
    await app.init();
    const prisma = app.get(PrismaService);
    return { app, prisma };
}
/** Wipes mutable business data between tests; keeps RBAC + seeded employees/crops. */
export async function resetData(prisma) {
    await prisma.$transaction([
        // Referrals hold FK RESTRICT to customers and leads, so they must be
        // cleared before either of those (Step 3B).
        prisma.referral.deleteMany(),
        prisma.customerNote.deleteMany(),
        prisma.relationshipOwnership.deleteMany(),
        prisma.outboundMessage.deleteMany(),
        prisma.followUp.deleteMany(),
        prisma.leadOwnership.deleteMany(),
        prisma.auditEvent.deleteMany(),
        prisma.authSession.deleteMany(),
        prisma.callNote.deleteMany(),
        prisma.call.deleteMany(),
        prisma.lead.deleteMany(),
        prisma.customerCrop.deleteMany(),
        prisma.customerLocation.deleteMany(),
        prisma.customerPhone.deleteMany(),
        prisma.customer.deleteMany(),
        prisma.cropProductGuidance.deleteMany(),
        prisma.leaveApprovalHistory.deleteMany(),
        prisma.leaveApplication.deleteMany(),
        prisma.attendanceApprovalHistory.deleteMany(),
        prisma.attendancePunch.deleteMany(),
        prisma.attendanceRecord.deleteMany(),
        prisma.kpiPeriodScore.deleteMany(),
        prisma.kpiTarget.deleteMany(),
        prisma.advanceRecovery.deleteMany(),
        prisma.advanceLedger.deleteMany(),
        prisma.payrollLineItem.deleteMany(),
        prisma.payrollRun.deleteMany(),
        prisma.appNotification.deleteMany(),
        prisma.processedEvent.deleteMany(),
        prisma.outboxEvent.deleteMany(),
        prisma.employeeNote.deleteMany(),
        prisma.employeeDocument.deleteMany(),
        prisma.employeeHistoryRecord.deleteMany(),
        prisma.employeeAssignment.deleteMany(),
        prisma.salaryRevision.deleteMany({
            where: {
                employee: {
                    email: {
                        notIn: [
                            'founder@grotec.local',
                            'manager@grotec.local',
                            'agent@grotec.local',
                            'staff@grotec.local',
                            'delivery@grotec.local',
                            'staff2@grotec.local',
                            'staff3@grotec.local',
                            'staff4@grotec.local',
                            'staff5@grotec.local',
                        ],
                    },
                },
            },
        }),
        prisma.employee.deleteMany({
            where: {
                email: {
                    notIn: [
                        'founder@grotec.local',
                        'manager@grotec.local',
                        'agent@grotec.local',
                        'staff@grotec.local',
                        'delivery@grotec.local',
                        'staff2@grotec.local',
                        'staff3@grotec.local',
                        'staff4@grotec.local',
                        'staff5@grotec.local',
                    ],
                    not: {
                        startsWith: 'rm2-',
                    },
                },
            },
        }),
    ]);
}
/** Logs in and returns the access token. */
export async function loginToken(app, user = USERS.AGENT) {
    const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(200);
    return res.body.accessToken;
}
/** Unique throwaway email for tests that create employees (test DB persists across runs). */
export function uniqueEmail(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@grotec.local`;
}
/** Looks up a seeded employee id by email. */
export async function employeeIdByEmail(prisma, email) {
    const employee = await prisma.employee.findUnique({ where: { email } });
    if (!employee)
        throw new Error(`seeded employee ${email} not found`);
    return employee.id;
}
/** Creates a customer via the API as the given user; returns the created id. */
export async function createCustomerAs(app, token, fullName, phone, extra = {}) {
    const res = await request(app.getHttpServer())
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${token}`)
        .send({ fullName, phones: { phones: [{ number: phone, isPrimary: true }] }, ...extra })
        .expect(201);
    return res.body.id;
}
