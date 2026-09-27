# GROTEC FarmerOS — Technical Handover Document
**Phase 1 Finalisation & Management Closure (September 2026)**
*Prepared for: GROTEC Management (A. Arulkumar)*

---

## 1. Executive Summary
GROTEC FarmerOS is an enterprise-grade agricultural CRM, field operations, and farmer lifecycle management system tailored for the agro-input and bio-stimulant industry in Tamil Nadu.

This handover document codifies the full technical implementation completed in accordance with the *GROTEC FarmerOS Phase 1 — Management Review & Finalisation Note (September 2026)*.

---

## 2. Core Modules & Architecture Overview

```
                        ┌────────────────────────────────────────┐
                        │      GROTEC Web & Android Client       │
                        │ (Vite + React 18 + TS + Tailwind + PWA)│
                        └──────────────────┬─────────────────────┘
                                           │ HTTPS / WSS
                                           ▼
                        ┌────────────────────────────────────────┐
                        │          NestJS API Gateway            │
                        │    (Fastify Engine, JWT Auth, RBAC)    │
                        └─────────┬────────────────────┬─────────┘
                                  │                    │
              ┌───────────────────┴───────┐   ┌────────┴─────────────────┐
              │ PostgreSQL (Prisma ORM)   │   │ Async Worker / Event Bus │
              │ - Farmer Master 360       │   │ - WhatsApp/SMS Advisory  │
              │ - Call Outcome Master     │   │ - Telephony Events       │
              │ - Commercial Funnel       │   │ - Audit Logging          │
              │ - Dynamic Roles/Perms     │   └──────────────────────────┘
              └───────────────────────────┘
```

### 2.1 Technology Stack
- **Backend**: Node.js v20+, NestJS v10 (Fastify HTTP adapter), Prisma ORM v5, PostgreSQL 15+.
- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite 5, React Query (TanStack), React Router v6.
- **Shared Architecture**: `@grotec/shared` monorepo package housing canonical constants, role enums, permission codes, phone formatting (E.164), and business validators.

---

## 3. Key Enhancements Implemented

### 3.1 Dual Calling Mode & Manual Telephony Independence
- **Zero Cloud-Telephony Dependency for Pilot**: Field Sales Executives (FSEs) can operate entirely via direct device SIM dialling (`tel:` URI links) without requiring Exotel credentials or VoIP gateways.
- **Farmer 360° Call Screen**:
  - Live call duration timer and quick notes scratchpad.
  - Commercial intent capture: Product Interest, Crop Interest, and Expected Booking Value (₹).
  - 1-Click "Save & Next" progression automatically advancing to the next assigned farmer in the active queue.
  - Seamless toggle between "Mobile SIM Dial" and "Exotel Cloud Dialler" modes.

### 3.2 Dynamic Call Outcome Master
- Replaced rigid hardcoded dispositions with an admin-configurable master (`CallOutcomeMaster`).
- Supports active/inactive flags, display orders, category groupings, and automatic follow-up triggers.
- Preserves historical integrity: Renaming or deactivating an outcome does not mutate existing call logs.
- Bootstrapped with canonical GROTEC dispositions:
  1. `INTERESTED` — Farmer expressed commercial interest (triggers lead creation & commercial tracking).
  2. `ORDER_PLACED` — Immediate booking confirmed.
  3. `CALLBACK_REQ` — Requested callback at specific date/time.
  4. `FOLLOWUP_REQ` — Follow-up required post crop cycle event.
  5. `EXISTING_CUST` — Existing customer needing support or replenishment.
  6. `NOT_ANSWERED` — Ringing unattended (auto-rescheduled).
  7. `BUSY` — Line busy.
  8. `NOT_INTERESTED` — Uninterested (reason captured in notes).
  9. `WRONG_NUMBER` — Invalid or outdated phone.

### 3.3 GROTEC Business Roles & Dynamic Permission Model
- Registered official business roles:
  - `SUPER_ADMIN` (Break-glass access)
  - `FOUNDER` (Executive oversight)
  - `FARMER_SUCCESS_MANAGER` (Telecalling operations & performance)
  - `GROUP_LEADER` (Team supervisory oversight)
  - `FSE` (Farmer Success Executive - Field/Outbound telecalling)
  - `HR_ADMIN` (Personnel & attendance management)
  - `ACCOUNTS_FINANCE` (Invoicing & cash collections)
  - `TECHNICAL_AGRONOMY` (Crop catalog & dosage guidance)
  - `STORES_DISPATCH` (Inventory & order fulfilment)
  - `DELIVERY` (Phase 2 delivery agent)
- **Dynamic Database Assignment**: Administrators can configure permissions per role through the UI (`TeamPage.tsx` > "Configure Permissions") without requiring code modifications or backend redeployment (`PUT /api/v1/roles/:id/permissions`).
- **Server-Side Enforcement**: All endpoints are strictly guarded using `@RequirePermission(...)` guards.

### 3.4 FSE 360° Commercial Conversion Funnel
- 12-Stage end-to-end commercial pipeline tracking:
  1. `Assigned Base`
  2. `Calling Attempts` (Attempt Rate %)
  3. `Connected Calls` (Connection Rate %)
  4. `Quality Conversations` (>90s conversation rate %)
  5. `Qualified Leads` (Lead Conversion %)
  6. `Active Follow-Ups`
  7. `Bookings Created` (Booking Conversion %)
  8. `Booking Value` (Gross ₹)
  9. `Dispatches Released` (Dispatch Rate %)
  10. `Delivered Orders` (Delivery Rate %)
  11. `Delivered Value` (Delivered ₹)
  12. `Collections Received` (Collection Rate %)
  *(Plus Returns & Cancellation metrics)*
- Includes team-wide benchmark tables for ranking and coaching individual FSEs.

### 3.5 Dynamic Business Intelligence (BI) Engine
- Fast multi-dimensional filtering over commercial orders and farmer records:
  - District, Taluk, Village, Product Name, Delivery Status, Payment Status, Date Ranges.
  - Live KPI summary ribbon: Total Orders, Unique Farmers Reached, Total Booking Value (₹), Total Collected Value (₹).
  - High-performance streaming CSV export (`GET /api/v1/reports/dynamic-bi/export`).

### 3.6 Farmer Segmentation & Communication Compliance
- Saved dynamic segments (`FarmerSegment`) by district, taluk, village, crop, and status.
- Campaign preview interface with estimated audience count and sample message rendering.
- Strict compliance safeguards: Automatically enforces opt-out footers (`"Text STOP to opt-out"`) to guarantee TRAI and WhatsApp Business API compliance.

### 3.7 Security Fixes & Production Hardening
- **CORS Allow-List**: Modified `app-setup.js` so that `CORS_ORIGINS` strictly controls allowed domains; removed permissive localhost wildcards in production environments.
- **Database Safety**: Added automated backup, restore, and production pre-flight audit scripts in `scripts/`.

---

## 4. Phase 2 Scope Boundaries
Per GROTEC management guidelines, Phase 2 features remain modeled in database schemas but are strictly deferred from Phase 1 operations:
- Factory production batches & formula blending.
- Fleet vehicle GPS tracking and live route maps.
- Physical dispatch barcode loading scans.
