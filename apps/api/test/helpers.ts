import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { RoleCode } from '@grotec/shared';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app-setup';
import { PrismaService } from '../src/common/prisma/prisma.service';

export interface TestUser {
  email: string;
  password: string;
  roleCode: RoleCode;
}

export const USERS: Record<RoleCode, TestUser> = {
  FOUNDER: { email: 'founder@grotec.local', password: 'Founder@123', roleCode: 'FOUNDER' },
  MANAGER: { email: 'manager@grotec.local', password: 'Founder@123', roleCode: 'MANAGER' },
  AGENT: { email: 'agent@grotec.local', password: 'Founder@123', roleCode: 'AGENT' },
  STAFF: { email: 'staff@grotec.local', password: 'Founder@123', roleCode: 'STAFF' },
};

/** Compiles and boots the real application against the seeded test database. */
export async function createTestApp(): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  await configureApp(app, { swagger: false });
  await app.init();
  const prisma = app.get(PrismaService);
  return { app, prisma };
}

/** Wipes mutable business data between tests; keeps RBAC + seeded employees/crops. */
export async function resetData(prisma: PrismaService): Promise<void> {
  await prisma.$transaction([
    prisma.leadOwnership.deleteMany(),
    prisma.auditEvent.deleteMany(),
    prisma.authSession.deleteMany(),
    prisma.lead.deleteMany(),
    prisma.customerCrop.deleteMany(),
    prisma.customerLocation.deleteMany(),
    prisma.customerPhone.deleteMany(),
    prisma.customer.deleteMany(),
  ]);
}

/** Logs in and returns the access token. */
export async function loginToken(app: INestApplication, user: TestUser = USERS.AGENT): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: user.password })
    .expect(200);
  return (res.body as { accessToken: string }).accessToken;
}

/** Unique throwaway email for tests that create employees (test DB persists across runs). */
export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@grotec.local`;
}

/** Looks up a seeded employee id by email. */
export async function employeeIdByEmail(prisma: PrismaService, email: string): Promise<string> {
  const employee = await prisma.employee.findUnique({ where: { email } });
  if (!employee) throw new Error(`seeded employee ${email} not found`);
  return employee.id;
}

/** Creates a customer via the API as the given user; returns the created id. */
export async function createCustomerAs(
  app: INestApplication,
  token: string,
  fullName: string,
  phone: string,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/customers')
    .set('Authorization', `Bearer ${token}`)
    .send({ fullName, phones: { phones: [{ number: phone, isPrimary: true }] }, ...extra })
    .expect(201);
  return (res.body as { id: string }).id;
}
