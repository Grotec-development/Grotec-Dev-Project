import { describe, expect, it, beforeAll, beforeEach, afterAll } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, createCustomerAs, loginToken, resetData, USERS } from './helpers';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('customers', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let agentToken: string;
  let managerToken: string;
  let riceCropId: string;

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    agentToken = await loginToken(app, USERS.AGENT);
    managerToken = await loginToken(app, USERS.MANAGER);
    riceCropId = (await prisma.crop.findFirstOrThrow({ where: { code: 'RICE' } })).id;
  });

  beforeEach(async () => {
    await resetData(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a customer and normalizes the phone to E.164', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ fullName: 'New Farmer', phones: { phones: [{ number: '09876543099', isPrimary: true }] } })
      .expect(201);
    const body = res.body as { id: string; phones: Array<{ phone: string; isPrimary: boolean }> };
    expect(body.id).toBeTruthy();
    expect(body.phones).toHaveLength(1);
    expect(body.phones[0]?.phone).toBe('+919876543099');
    expect(body.phones[0]?.isPrimary).toBe(true);
  });

  it('rejects an unnormalizable phone number', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ fullName: 'Bad Phone Farmer', phones: { phones: [{ number: 'not-a-phone' }] } })
      .expect(400);
    expect(res.body.error.code).toBe('INVALID_PHONE');
  });

  it('rejects a request listing the same phone twice', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        fullName: 'Dup Farmer',
        phones: { phones: [{ number: '9876543211' }, { number: '+91 98765 43211' }] },
      })
      .expect(400);
    expect(res.body.error.code).toBe('DUPLICATE_PHONE_IN_REQUEST');
  });

  it('blocks duplicate phone across customers with the matched customer (409)', async () => {
    const first = await createCustomerAs(app, agentToken, 'First Farmer', '9876543212');
    const res = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ fullName: 'Second Farmer', phones: { phones: [{ number: '9876543212' }] } })
      .expect(409);
    expect(res.body.error.code).toBe('CUSTOMER_PHONE_EXISTS');
    expect((res.body.error as { matchedCustomer: { id: string } }).matchedCustomer.id).toBe(first);
  });

  it('looks a customer up by phone', async () => {
    const id = await createCustomerAs(app, agentToken, 'Lookup Farmer', '9876543213');
    const found = await request(app.getHttpServer())
      .get('/api/v1/customers/lookup?phone=%2B919876543213')
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200);
    expect((found.body as { customerId: string }).customerId).toBe(id);
    await request(app.getHttpServer())
      .get('/api/v1/customers/lookup?phone=9999999999')
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(404);
  });

  it('builds a full customer profile (phones, location, crops)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        fullName: 'Profile Farmer',
        phones: { phones: [{ number: '9876543214', isPrimary: true }] },
        locations: {
          locations: [{ village: 'Kothapalli', district: 'Warangal', state: 'Telangana', pincode: '506001' }],
        },
        crops: { crops: [{ cropId: riceCropId, acreage: 3.5, unit: 'acre' }] },
      })
      .expect(201);
    const body = res.body as {
      id: string;
      locations: Array<{ village: string; isPrimary: boolean }>;
      crops: Array<{ crop: { code: string }; acreage: number }>;
    };
    expect(body.locations).toHaveLength(1);
    expect(body.locations[0]?.village).toBe('Kothapalli');
    expect(body.locations[0]?.isPrimary).toBe(true);
    expect(body.crops).toHaveLength(1);
    expect(body.crops[0]?.crop.code).toBe('RICE');
    expect(body.crops[0]?.acreage).toBe(3.5);
  });

  it('searches by name and by phone digits', async () => {
    await createCustomerAs(app, agentToken, 'Chandan Yadav', '9876543215');
    const byName = await request(app.getHttpServer())
      .get('/api/v1/customers?q=chandan')
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200);
    expect((byName.body as { total: number }).total).toBeGreaterThanOrEqual(1);
    const byDigits = await request(app.getHttpServer())
      .get('/api/v1/customers?q=9876543215')
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200);
    expect((byDigits.body as { items: Array<{ fullName: string }> }).items[0]?.fullName).toBe('Chandan Yadav');
  });

  it('updates a customer name', async () => {
    const id = await createCustomerAs(app, agentToken, 'Old Name', '9876543216');
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/customers/${id}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ fullName: 'New Name' })
      .expect(200);
    expect((res.body as { fullName: string }).fullName).toBe('New Name');
  });

  it('prevents removing the last phone of a customer', async () => {
    const id = await createCustomerAs(app, agentToken, 'Single Phone Farmer', '9876543217');
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/customers/${id}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200);
    const phoneId = ((detail.body as { phones: Array<{ id: string }> }).phones[0] as { id: string }).id;
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/customers/${id}/phones/${phoneId}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(400);
    expect(res.body.error.code).toBe('LAST_PHONE_REQUIRED');
  });

  it('swaps the primary phone then removes the old one', async () => {
    const id = await createCustomerAs(app, agentToken, 'Two Phone Farmer', '9876543218');
    await request(app.getHttpServer())
      .post(`/api/v1/customers/${id}/phones`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ number: '9876543219' })
      .expect(201);
    let detail = (await request(app.getHttpServer()).get(`/api/v1/customers/${id}`).set('Authorization', `Bearer ${agentToken}`).expect(200))
      .body as { phones: Array<{ id: string; phone: string; isPrimary: boolean }> };
    const [oldPhone, newPhone] = detail.phones;
    expect(detail.phones.find((p) => p.isPrimary)?.phone).toBe('+919876543218');

    // Promote the second number to primary.
    await request(app.getHttpServer())
      .patch(`/api/v1/customers/${id}/phones/${newPhone?.id}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ isPrimary: true })
      .expect(200);
    detail = (await request(app.getHttpServer()).get(`/api/v1/customers/${id}`).set('Authorization', `Bearer ${agentToken}`).expect(200))
      .body as { phones: Array<{ id: string; phone: string; isPrimary: boolean }> };
    expect(detail.phones.find((p) => p.isPrimary)?.phone).toBe('+919876543219');

    // Now the old primary can be removed; primary moves to the survivor.
    await request(app.getHttpServer())
      .delete(`/api/v1/customers/${id}/phones/${oldPhone?.id}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(204);
    detail = (await request(app.getHttpServer()).get(`/api/v1/customers/${id}`).set('Authorization', `Bearer ${agentToken}`).expect(200))
      .body as { phones: Array<{ id: string; phone: string; isPrimary: boolean }> };
    expect(detail.phones).toHaveLength(1);
    expect(detail.phones[0]?.isPrimary).toBe(true);
  });

  it('rejects adding the same phone twice on one customer', async () => {
    const id = await createCustomerAs(app, agentToken, 'Dup Add Farmer', '9876543220');
    const res = await request(app.getHttpServer())
      .post(`/api/v1/customers/${id}/phones`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ number: '9876543220' })
      .expect(409);
    expect(res.body.error.code).toBe('PHONE_ALREADY_EXISTS');
  });

  it('rejects duplicate crop entries and unknown crops', async () => {
    const id = await createCustomerAs(app, agentToken, 'Crop Farmer', '9876543221', {
      crops: { crops: [{ cropId: riceCropId, acreage: 2 }] },
    });
    const dup = await request(app.getHttpServer())
      .post(`/api/v1/customers/${id}/crops`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ cropId: riceCropId, acreage: 3 })
      .expect(409);
    expect(dup.body.error.code).toBe('CUSTOMER_CROP_EXISTS');
    const unknown = await request(app.getHttpServer())
      .post(`/api/v1/customers/${id}/crops`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ cropId: '00000000-0000-0000-0000-000000000000', acreage: 3 })
      .expect(400);
    expect(unknown.body.error.code).toBe('CROP_NOT_FOUND');
  });

  it('lets managers deactivate and reactivate a customer', async () => {
    const id = await createCustomerAs(app, managerToken, 'Deact Farmer', '9876543222');
    await request(app.getHttpServer())
      .post(`/api/v1/customers/${id}/deactivate`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(204);
    const inactive = await request(app.getHttpServer())
      .get(`/api/v1/customers/${id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);
    expect((inactive.body as { status: string }).status).toBe('INACTIVE');
    await request(app.getHttpServer())
      .post(`/api/v1/customers/${id}/activate`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(204);
  });

  it('blocks an agent from deactivating customers (no permission)', async () => {
    const id = await createCustomerAs(app, managerToken, 'Agent Cannot Deact', '9876543223');
    await request(app.getHttpServer())
      .post(`/api/v1/customers/${id}/deactivate`)
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(403);
  });
});
