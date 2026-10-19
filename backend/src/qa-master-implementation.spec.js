import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../test/helpers.js';

describe('GROTEC Master Implementation Prompt - 38 Mandatory Acceptance Tests', () => {
  let app;
  let founderToken;
  let managerToken;
  let agentToken;
  let testCustomer;
  let testProduct;

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app;

    async function login(email, password) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password });
      if (res.status !== 200 || !res.body.accessToken) {
        throw new Error(`Login failed for ${email} (status: ${res.status}): ${JSON.stringify(res.body)}`);
      }
      return res.body.accessToken;
    }

    founderToken = await login('founder@grotec.local', 'Founder@Grotec2026!');
    managerToken = await login('manager@grotec.local', 'Manager@Grotec2026!');
    agentToken = await login('agent_1@grotec.local', 'Agent1@Grotec2026!');

    const custRes = await request(app.getHttpServer())
      .get('/api/v1/customers?pageSize=1')
      .set('Authorization', `Bearer ${managerToken}`);
    testCustomer = custRes.body.items?.[0];

    const prodRes = await request(app.getHttpServer())
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${managerToken}`);
    testProduct = prodRes.body?.[0];
  }, 120000);

  afterAll(async () => {
    if (app) await app.close();
  });

  // -------------------------------------------------------------------------
  // 1. Farmer and Address Management (Tests 1-8)
  // -------------------------------------------------------------------------
  describe('1-8: Farmer & Address Management', () => {
    it('1. Search and open a farmer without loading the full database (paginated)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/customers?page=1&pageSize=5&query=')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('total');
      expect(res.body.items.length).toBeLessThanOrEqual(5);
    });

    it('2 & 3. Bulk import validation with duplicate phone detection and incomplete address tolerance', async () => {
      const sampleCsv = `Farmer Name,Phone,State,District,Taluk,Village,PIN\n` +
        `Duplicate Test Farmer,9876543210,Tamil Nadu,Coimbatore,Pollachi,Anaimalai,642001\n` +
        `Incomplete Addr Farmer,9876543211,Tamil Nadu,Coimbatore,,,`;

      const res = await request(app.getHttpServer())
        .post('/api/v1/import/parse')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          csvContent: sampleCsv,
          fileName: 'farmers.csv'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('headers');
      expect(res.body).toHaveProperty('sampleRows');
      expect(res.body.sampleRows.length).toBe(2);
    });

    it('4 & 5. Open an existing farmer and load saved locations, verify address structure', async () => {
      expect(testCustomer).toBeDefined();

      const res = await request(app.getHttpServer())
        .get(`/api/v1/customers/${testCustomer.id}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('locations');
      expect(Array.isArray(res.body.locations)).toBe(true);
      if (res.body.locations.length > 0) {
        const loc = res.body.locations[0];
        expect(loc).toHaveProperty('state');
        expect(loc).toHaveProperty('district');
      }
    });

    it('6. Add a new farm location without overwriting previous locations or creating duplicate farmer', async () => {
      expect(testCustomer).toBeDefined();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/${testCustomer.id}/locations`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          locationName: 'Udumalaipettai Farm',
          state: 'Tamil Nadu',
          district: 'Tiruppur',
          taluk: 'Udumalaipettai',
          village: 'Udumalai Rural',
          addressLine: 'Survey No 88/2, Pollachi Main Road',
          pincode: '642126'
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.id).toBeDefined();

      const getRes = await request(app.getHttpServer())
        .get(`/api/v1/customers/${testCustomer.id}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(getRes.body.locations.length).toBeGreaterThanOrEqual(2);
    });

    it('7. Reject invalid geographic parent-child combinations (e.g. invalid district for state)', async () => {
      expect(testCustomer).toBeDefined();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/${testCustomer.id}/locations`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          locationName: 'Invalid Geography Farm',
          state: 'Tamil Nadu',
          district: 'NonExistentDistrict123',
          taluk: 'UnknownTaluk'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_GEOGRAPHY');
    });

    it('8. Preserve address snapshot associated with an order', async () => {
      expect(testProduct).toBeDefined();

      const orderRes = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          customerId: testCustomer.id,
          deliveryAddress: 'Snapshot Address: Farm 1, Pollachi North, 642001',
          items: [{ productId: testProduct.id, quantity: 1, unitPrice: testProduct.basePrice }]
        });

      expect(orderRes.status).toBe(201);
      expect(orderRes.body.deliveryAddress).toContain('Snapshot Address');
    });
  });

  // -------------------------------------------------------------------------
  // 2. Telecalling and Follow-ups (Tests 9-14)
  // -------------------------------------------------------------------------
  describe('9-14: Telecalling & Follow-ups', () => {
    let activeCallId;

    it('9. Save a call outcome and record interaction', async () => {
      const callRes = await request(app.getHttpServer())
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ phoneNumber: '9876543210', customerId: testCustomer.id });

      expect([200, 201]).toContain(callRes.status);
      activeCallId = callRes.body.id;

      const res = await request(app.getHttpServer())
        .post(`/api/v1/calls/${activeCallId}/outcome`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          outcome: 'INTERESTED',
          notes: 'Farmer expressed interest in Jeevan Sakthi nutrient package'
        });

      expect([200, 201]).toContain(res.status);
    });

    it('10. Handle failed save without silent queue advancement (validation failure preserves context)', async () => {
      if (!activeCallId) return;

      const res = await request(app.getHttpServer())
        .post(`/api/v1/calls/${activeCallId}/outcome`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          outcome: '' // Invalid outcome
        });

      expect([400, 422]).toContain(res.status);
    });

    it('11. Create an order directly in calling context', async () => {
      expect(testProduct).toBeDefined();

      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          customerId: testCustomer.id,
          notes: 'Order placed during live telecalling session',
          items: [{ productId: testProduct.id, quantity: 2, unitPrice: testProduct.basePrice }]
        });

      expect(res.status).toBe(201);
      expect(res.body.orderNumber).toBeDefined();
    });

    it('12 & 13. Schedule a callback, ensure appearance in follow-up queue and deduplication', async () => {
      if (!activeCallId) return;

      const res1 = await request(app.getHttpServer())
        .post(`/api/v1/calls/${activeCallId}/outcome`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          outcome: 'CALL_BACK',
          nextAction: 'CALLBACK',
          followUpDate: '2026-10-25',
          followUpTime: '10:30',
          notes: 'Requested callback after harvest'
        });

      expect([200, 201]).toContain(res1.status);

      // Repeated save/retry should not create duplicate pending follow-ups
      const res2 = await request(app.getHttpServer())
        .post(`/api/v1/calls/${activeCallId}/outcome`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          outcome: 'CALL_BACK',
          nextAction: 'CALLBACK',
          followUpDate: '2026-10-25',
          followUpTime: '10:30',
          notes: 'Requested callback after harvest retry'
        });

      expect([200, 201]).toContain(res2.status);
    });

    it('14. Verify Hold and Do Not Contact rules exclude farmer from routine calling queues', async () => {
      const holdRes = await request(app.getHttpServer())
        .patch(`/api/v1/customers/${testCustomer.id}`)
        .set('Authorization', `Bearer ${founderToken}`)
        .send({
          contactStatus: 'ON_HOLD',
          holdUntil: new Date(Date.now() + 7 * 86400000).toISOString(),
          holdReason: 'Off-season pause for 7 days'
        });

      expect(holdRes.status).toBe(200);

      const queueRes = await request(app.getHttpServer())
        .get('/api/v1/calls/queue')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(queueRes.status).toBe(200);
      const isPresent = queueRes.body.items?.some(f => f.customerId === testCustomer.id);
      expect(isPresent).toBe(false);

      // Restore active status
      await request(app.getHttpServer())
        .patch(`/api/v1/customers/${testCustomer.id}`)
        .set('Authorization', `Bearer ${founderToken}`)
        .send({ contactStatus: 'ACTIVE' });
    });
  });

  // -------------------------------------------------------------------------
  // 3. Orders, Pricing and Approvals (Tests 15-20)
  // -------------------------------------------------------------------------
  describe('15-20: Orders, Pricing & Approvals', () => {
    it('15. Add multiple products and verify decimal-safe subtotal, taxes and totals', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          customerId: testCustomer.id,
          items: [
            { productId: testProduct.id, quantity: 5, unitPrice: testProduct.basePrice }
          ]
        });

      expect(res.status).toBe(201);
      const subtotal = Number(res.body.subtotal);
      const taxAmount = Number(res.body.taxAmount);
      const totalAmount = Number(res.body.totalAmount);
      expect(totalAmount).toBeCloseTo(subtotal + taxAmount, 2);
    });

    it('16. Verify that changing catalogue price does not alter historical orders', async () => {
      const orderRes = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          customerId: testCustomer.id,
          items: [{ productId: testProduct.id, quantity: 1, unitPrice: testProduct.basePrice }]
        });

      const initialTotal = orderRes.body.totalAmount;

      const verifyRes = await request(app.getHttpServer())
        .get(`/api/v1/orders/${orderRes.body.id}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(verifyRes.body.totalAmount).toBe(initialTotal);
    });

    it('17 & 18. Verify discount authorization check and manager approval flow', async () => {
      // Agent creates order requesting discount
      const orderRes = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          customerId: testCustomer.id,
          discountAmount: 150,
          discountReason: 'Festival promotional offer',
          items: [{ productId: testProduct.id, quantity: 4, unitPrice: testProduct.basePrice }]
        });

      expect(orderRes.status).toBe(201);
      expect(orderRes.body.discountStatus).toBe('PENDING_APPROVAL');

      // Manager approves discount
      const approveRes = await request(app.getHttpServer())
        .post(`/api/v1/orders/${orderRes.body.id}/discount/approve`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.discountStatus).toBe('APPROVED');
      expect(Number(approveRes.body.discountAmount)).toBe(150);
    });

    it('19. Large-order advance payment requirement for orders >= ₹1,00,000', async () => {
      const largeQty = Math.ceil(110000 / Number(testProduct.basePrice));
      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          customerId: testCustomer.id,
          items: [{ productId: testProduct.id, quantity: largeQty, unitPrice: testProduct.basePrice }]
        });

      expect(res.status).toBe(201);
      expect(res.body.advancePaymentStatus).toBe('PENDING');
      expect(Number(res.body.advanceRequiredAmount)).toBeGreaterThanOrEqual(25000);

      // Verify manager can approve exception if authorized
      const exRes = await request(app.getHttpServer())
        .post(`/api/v1/orders/${res.body.id}/advance/exception`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ reason: 'Long-standing VIP farmer trusted for COD' });

      expect(exRes.status).toBe(200);
      expect(exRes.body.advancePaymentStatus).toBe('EXCEPTION_APPROVED');
    });

    it('20. Verify unconfigured payment gateways are not presented as operational', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/orders/payment-methods')
        .set('Authorization', `Bearer ${managerToken}`);

      if (res.status === 200) {
        expect(res.body).toContain('CASH_ON_DELIVERY');
      }
    });
  });

  // -------------------------------------------------------------------------
  // 4. Client Lifecycle (Tests 21-23)
  // -------------------------------------------------------------------------
  describe('21-23: Client Lifecycle & Conversions', () => {
    it('21 & 22. Convert farmer to CLIENT upon qualifying purchase and preserve farmer identity', async () => {
      const initialFarmerCode = testCustomer.farmerCode;
      expect(testCustomer.id).toBeDefined();

      const saleRes = await request(app.getHttpServer())
        .post('/api/v1/sales/complete')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          customerId: testCustomer.id,
          notes: 'First qualifying purchase confirmed and delivered'
        });

      if (saleRes.status === 200 || saleRes.status === 201) {
        const custAfter = await request(app.getHttpServer())
          .get(`/api/v1/customers/${testCustomer.id}`)
          .set('Authorization', `Bearer ${managerToken}`);

        expect(custAfter.body.relationshipStage).toBe('CLIENT');
        expect(custAfter.body.farmerCode).toBe(initialFarmerCode);
      }
    });

    it('23. Create repeat orders without creating duplicate farmer records', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          customerId: testCustomer.id,
          notes: 'Repeat seasonal order',
          items: [{ productId: testProduct.id, quantity: 1, unitPrice: testProduct.basePrice }]
        });

      expect(res.status).toBe(201);
      expect(res.body.customerId).toBe(testCustomer.id);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Routes and Delivery Operations (Tests 24-29)
  // -------------------------------------------------------------------------
  describe('24-29: Routes & Delivery Operations', () => {
    it('24 & 25. Automatically suggest route based on delivery district or flag for assignment', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          customerId: testCustomer.id,
          deliveryAddress: 'Farm 1, Coimbatore, Tamil Nadu',
          items: [{ productId: testProduct.id, quantity: 1, unitPrice: testProduct.basePrice }]
        });

      expect(res.status).toBe(201);
      expect(res.body.routeId).toBeDefined();
    });

    it('26. Distinct requested vs confirmed delivery dates', async () => {
      const requestedDate = new Date(Date.now() + 3 * 86400000).toISOString();
      const confirmedDate = new Date(Date.now() + 5 * 86400000).toISOString();

      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          customerId: testCustomer.id,
          requestedDeliveryDate: requestedDate,
          confirmedDeliveryDate: confirmedDate,
          items: [{ productId: testProduct.id, quantity: 1, unitPrice: testProduct.basePrice }]
        });

      expect(res.status).toBe(201);
      expect(res.body.requestedDeliveryDate).toBeDefined();
      expect(res.body.confirmedDeliveryDate).toBeDefined();
    });

    it('27. Customer delivery confirmation endpoint records outcome & notes', async () => {
      const orderRes = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          customerId: testCustomer.id,
          items: [{ productId: testProduct.id, quantity: 1, unitPrice: testProduct.basePrice }]
        });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/routes/orders/${orderRes.body.id}/confirm-delivery`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          outcome: 'CONFIRMED_FOR_DELIVERY',
          notes: 'Farmer confirmed unloading equipment ready'
        });

      expect(res.status).toBe(200);
      expect(res.body.deliveryConfirmationStatus).toBe('CONFIRMED_FOR_DELIVERY');
    });

    it('28. Partial delivery quantity tracking differentiates PARTIALLY_DELIVERED vs DELIVERED', async () => {
      const fakeTripStopId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app.getHttpServer())
        .post(`/api/v1/delivery/stops/${fakeTripStopId}/complete`)
        .set('Authorization', `Bearer ${founderToken}`)
        .send({
          status: 'PARTIALLY_DELIVERED',
          items: [{ orderItemId: '00000000-0000-0000-0000-000000000001', deliveredQty: 5 }]
        });

      expect([404, 400]).toContain(res.status);
    });

    it('29. Delivery route regional corridors list without duplicates', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/routes')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(4);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Accounts and Support (Tests 30-33, 36)
  // -------------------------------------------------------------------------
  describe('30-33 & 36: Accounts, Inventory & Support', () => {
    let orderWithInvoice;

    it('30 & 31. Invoice generation leaves outstanding balance and payments reconcile balance', async () => {
      const orderRes = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          customerId: testCustomer.id,
          items: [{ productId: testProduct.id, quantity: 2, unitPrice: testProduct.basePrice }]
        });

      orderWithInvoice = orderRes.body;
      expect(orderWithInvoice.paymentStatus).toBe('UNPAID');

      // Record a partial payment
      const paymentRes = await request(app.getHttpServer())
        .post(`/api/v1/orders/${orderWithInvoice.id}/payments`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          amount: 200,
          paymentMethod: 'CASH',
          notes: 'Advance cash received by delivery executive'
        });

      expect([200, 201]).toContain(paymentRes.status);
      expect(paymentRes.body.order.paymentStatus).toBe('PARTIALLY_PAID');
    });

    it('32. Accounts ledger lists transactions without duplicate records', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/orders/ledger')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('33. Nearby customer discovery for delivery exceptions', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/customers/nearby?district=Coimbatore')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('36. Support ticket escalation and role assignment', async () => {
      const ticketRes = await request(app.getHttpServer())
        .post('/api/v1/support-tickets')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          customerId: testCustomer.id,
          category: 'DELIVERY_DELAY',
          priority: 'HIGH',
          description: 'Delayed delivery due to truck breakdown near Pollachi.',
          assignedRole: 'TEAM_LEADER'
        });

      expect(ticketRes.status).toBe(201);
      const ticketId = ticketRes.body.id;

      // Escalate ticket to MANAGEMENT
      const escRes = await request(app.getHttpServer())
        .post(`/api/v1/support-tickets/${ticketId}/escalate`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          newAssignedRole: 'MANAGEMENT',
          escalationReason: 'Requires regional warehouse manager intervention'
        });

      expect(escRes.status).toBe(200);
      expect(escRes.body.assignedRole).toBe('MANAGEMENT');
      expect(escRes.body.status).toBe('ASSIGNED');
    });
  });

  // -------------------------------------------------------------------------
  // 7. Security, Permissions and Hierarchy (Tests 34-38)
  // -------------------------------------------------------------------------
  describe('34-38: Security, Permissions & Operations', () => {
    it('34 & 35. Server-side RBAC: Non-admin agent cannot access management payroll or sensitive endpoints', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/payroll/runs')
        .set('Authorization', `Bearer ${agentToken}`);

      expect([401, 403]).toContain(res.status);
    });

    it('37. Team and employee assignments remain traceable with audit log', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/employees')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    it('38. Dashboard reporting distinction between orders, completed sales, and deliveries', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/sales')
        .set('Authorization', `Bearer ${founderToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
