import { describe, expect, it, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createTestApp, createCustomerAs, loginToken, resetData, USERS } from './helpers';
describe('customers', () => {
    let app;
    let prisma;
    let agentToken;
    let managerToken;
    let riceCropId;
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
        const body = res.body;
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
        expect(res.body.error.matchedCustomer.id).toBe(first);
    });
    it('looks a customer up by phone', async () => {
        const id = await createCustomerAs(app, agentToken, 'Lookup Farmer', '9876543213');
        const found = await request(app.getHttpServer())
            .get('/api/v1/customers/lookup?phone=%2B919876543213')
            .set('Authorization', `Bearer ${agentToken}`)
            .expect(200);
        expect(found.body.customerId).toBe(id);
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
        const body = res.body;
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
        expect(byName.body.total).toBeGreaterThanOrEqual(1);
        const byDigits = await request(app.getHttpServer())
            .get('/api/v1/customers?q=9876543215')
            .set('Authorization', `Bearer ${agentToken}`)
            .expect(200);
        expect(byDigits.body.items[0]?.fullName).toBe('Chandan Yadav');
    });
    it('updates a customer name', async () => {
        const id = await createCustomerAs(app, agentToken, 'Old Name', '9876543216');
        const res = await request(app.getHttpServer())
            .patch(`/api/v1/customers/${id}`)
            .set('Authorization', `Bearer ${agentToken}`)
            .send({ fullName: 'New Name' })
            .expect(200);
        expect(res.body.fullName).toBe('New Name');
    });
    it('prevents removing the last phone of a customer', async () => {
        const id = await createCustomerAs(app, agentToken, 'Single Phone Farmer', '9876543217');
        const detail = await request(app.getHttpServer())
            .get(`/api/v1/customers/${id}`)
            .set('Authorization', `Bearer ${agentToken}`)
            .expect(200);
        const phoneId = detail.body.phones[0].id;
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
            .body;
        const [oldPhone, newPhone] = detail.phones;
        expect(detail.phones.find((p) => p.isPrimary)?.phone).toBe('+919876543218');
        // Promote the second number to primary.
        await request(app.getHttpServer())
            .patch(`/api/v1/customers/${id}/phones/${newPhone?.id}`)
            .set('Authorization', `Bearer ${agentToken}`)
            .send({ isPrimary: true })
            .expect(200);
        detail = (await request(app.getHttpServer()).get(`/api/v1/customers/${id}`).set('Authorization', `Bearer ${agentToken}`).expect(200))
            .body;
        expect(detail.phones.find((p) => p.isPrimary)?.phone).toBe('+919876543219');
        // Now the old primary can be removed; primary moves to the survivor.
        await request(app.getHttpServer())
            .delete(`/api/v1/customers/${id}/phones/${oldPhone?.id}`)
            .set('Authorization', `Bearer ${agentToken}`)
            .expect(204);
        detail = (await request(app.getHttpServer()).get(`/api/v1/customers/${id}`).set('Authorization', `Bearer ${agentToken}`).expect(200))
            .body;
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
        expect(inactive.body.status).toBe('INACTIVE');
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

    // ----------------------------------------------------------------- soilType
    // Free-text farm soil description (Customer.soilType, VARCHAR(40)). Contract:
    //   key omitted -> preserved · null or blank -> cleared · otherwise trimmed and set.
    describe('soilType', () => {
        /** Reads soilType back through the real detail endpoint. */
        async function soilOf(id, token = agentToken) {
            const res = await request(app.getHttpServer())
                .get(`/api/v1/customers/${id}`)
                .set('Authorization', `Bearer ${token}`)
                .expect(200);
            return res.body.soilType;
        }
        async function patch(id, body, expected = 200) {
            return request(app.getHttpServer())
                .patch(`/api/v1/customers/${id}`)
                .set('Authorization', `Bearer ${agentToken}`)
                .send(body)
                .expect(expected);
        }

        it('creates a customer with a soilType and persists it', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/v1/customers')
                .set('Authorization', `Bearer ${agentToken}`)
                .send({
                fullName: 'Soil Farmer',
                soilType: 'Red loam',
                phones: { phones: [{ number: '9876543230', isPrimary: true }] },
            })
                .expect(201);
            expect(res.body.soilType).toBe('Red loam');
            // Straight from the database, not just the response envelope.
            const row = await prisma.customer.findUnique({ where: { id: res.body.id } });
            expect(row?.soilType).toBe('Red loam');
            // And back through the detail endpoint.
            expect(await soilOf(res.body.id)).toBe('Red loam');
        });

        it('creates a customer without a soilType and stores null', async () => {
            const id = await createCustomerAs(app, agentToken, 'No Soil Farmer', '9876543231');
            expect(await soilOf(id)).toBeNull();
            const row = await prisma.customer.findUnique({ where: { id } });
            expect(row?.soilType).toBeNull();
        });

        it('trims surrounding whitespace on create', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/v1/customers')
                .set('Authorization', `Bearer ${agentToken}`)
                .send({
                fullName: 'Padded Soil Farmer',
                soilType: '   Black cotton   ',
                phones: { phones: [{ number: '9876543232', isPrimary: true }] },
            })
                .expect(201);
            expect(res.body.soilType).toBe('Black cotton');
        });

        it('treats a blank soilType on create as null', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/v1/customers')
                .set('Authorization', `Bearer ${agentToken}`)
                .send({
                fullName: 'Blank Soil Farmer',
                soilType: '   ',
                phones: { phones: [{ number: '9876543233', isPrimary: true }] },
            })
                .expect(201);
            expect(res.body.soilType).toBeNull();
        });

        it('updates soilType through PATCH', async () => {
            const id = await createCustomerAs(app, agentToken, 'Patch Soil Farmer', '9876543234');
            const res = await patch(id, { soilType: 'Alluvial' });
            expect(res.body.soilType).toBe('Alluvial');
            expect(await soilOf(id)).toBe('Alluvial');
        });

        it('trims surrounding whitespace on PATCH', async () => {
            const id = await createCustomerAs(app, agentToken, 'Patch Trim Farmer', '9876543235');
            const res = await patch(id, { soilType: '  Sandy loam  ' });
            expect(res.body.soilType).toBe('Sandy loam');
        });

        it('leaves soilType untouched when PATCH carries only fullName', async () => {
            const id = await createCustomerAs(app, agentToken, 'Keep Soil Farmer', '9876543236', { soilType: 'Laterite' });
            expect(await soilOf(id)).toBe('Laterite');
            const res = await patch(id, { fullName: 'Renamed Farmer' });
            expect(res.body.fullName).toBe('Renamed Farmer');
            expect(res.body.soilType).toBe('Laterite');
            expect(await soilOf(id)).toBe('Laterite');
        });

        it('clears soilType when PATCH sends null', async () => {
            const id = await createCustomerAs(app, agentToken, 'Null Soil Farmer', '9876543237', { soilType: 'Red loam' });
            const res = await patch(id, { soilType: null });
            expect(res.body.soilType).toBeNull();
            expect(await soilOf(id)).toBeNull();
        });

        it('clears soilType when PATCH sends an empty string', async () => {
            const id = await createCustomerAs(app, agentToken, 'Empty Soil Farmer', '9876543238', { soilType: 'Red loam' });
            const res = await patch(id, { soilType: '' });
            expect(res.body.soilType).toBeNull();
            expect(await soilOf(id)).toBeNull();
        });

        it('accepts a soilType of exactly 40 characters', async () => {
            const id = await createCustomerAs(app, agentToken, 'Boundary Soil Farmer', '9876543239');
            const atLimit = 'S'.repeat(40);
            const res = await patch(id, { soilType: atLimit });
            expect(res.body.soilType).toBe(atLimit);
        });

        it('rejects a soilType longer than 40 characters and does not persist it', async () => {
            const id = await createCustomerAs(app, agentToken, 'Long Soil Farmer', '9876543240', { soilType: 'Red loam' });
            const tooLong = 'S'.repeat(41);
            const res = await patch(id, { soilType: tooLong }, 400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            // The prior value must survive a rejected request.
            expect(await soilOf(id)).toBe('Red loam');
            const row = await prisma.customer.findUnique({ where: { id } });
            expect(row?.soilType).toBe('Red loam');
        });

        it('rejects a soilType longer than 40 characters on create', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/v1/customers')
                .set('Authorization', `Bearer ${agentToken}`)
                .send({
                fullName: 'Long Soil Create',
                soilType: 'S'.repeat(41),
                phones: { phones: [{ number: '9876543241', isPrimary: true }] },
            })
                .expect(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(await prisma.customer.count({ where: { fullName: 'Long Soil Create' } })).toBe(0);
        });

        it('returns soilType on the customer detail endpoint', async () => {
            const id = await createCustomerAs(app, agentToken, 'Detail Soil Farmer', '9876543242', { soilType: 'Clay' });
            const res = await request(app.getHttpServer())
                .get(`/api/v1/customers/${id}`)
                .set('Authorization', `Bearer ${agentToken}`)
                .expect(200);
            expect(res.body).toHaveProperty('soilType');
            expect(res.body.soilType).toBe('Clay');
        });

        it('records the soilType change in audit before/after, without a fabricated fullName change', async () => {
            const id = await createCustomerAs(app, agentToken, 'Audit Soil Farmer', '9876543243', { soilType: 'Red loam' });
            await patch(id, { soilType: 'Black cotton' });
            const audit = await prisma.auditEvent.findFirst({
                where: { entityType: 'CUSTOMER', entityId: id, action: 'updated' },
                orderBy: { createdAt: 'desc' },
            });
            expect(audit).toBeTruthy();
            expect(audit?.before).toMatchObject({ soilType: 'Red loam' });
            expect(audit?.after).toMatchObject({ soilType: 'Black cotton' });
            // A soil-only edit must not claim the name changed.
            expect(Object.keys(audit?.after ?? {})).not.toContain('fullName');
            expect(Object.keys(audit?.before ?? {})).not.toContain('fullName');
        });

        it('records clearing soilType in audit as a transition to null', async () => {
            const id = await createCustomerAs(app, agentToken, 'Audit Clear Farmer', '9876543244', { soilType: 'Laterite' });
            await patch(id, { soilType: null });
            const audit = await prisma.auditEvent.findFirst({
                where: { entityType: 'CUSTOMER', entityId: id, action: 'updated' },
                orderBy: { createdAt: 'desc' },
            });
            expect(audit?.before).toMatchObject({ soilType: 'Laterite' });
            expect(audit?.after).toMatchObject({ soilType: null });
        });

        it('does not write an audit event when the submitted soilType is unchanged', async () => {
            const id = await createCustomerAs(app, agentToken, 'Noop Soil Farmer', '9876543245', { soilType: 'Red loam' });
            const before = await prisma.auditEvent.count({
                where: { entityType: 'CUSTOMER', entityId: id, action: 'updated' },
            });
            const res = await patch(id, { soilType: 'Red loam' });
            expect(res.body.soilType).toBe('Red loam');
            const after = await prisma.auditEvent.count({
                where: { entityType: 'CUSTOMER', entityId: id, action: 'updated' },
            });
            expect(after).toBe(before);
        });
    });
});
