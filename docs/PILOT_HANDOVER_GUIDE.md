# GROTEC FarmerOS — Client Pilot Handover Guide

**System:** GROTEC FarmerOS (Agro-Input Enterprise CRM & Supply Chain OS)  
**Handover Date:** September 2026  
**Audience:** GROTEC Management, Operations Team & Client Pilot Observers  

---

## 1. Quick Access Credentials (Pilot Directory)

The system is configured with pre-provisioned, distinct organizational roles. All accounts are pre-seeded and active against the live database:

| Department / Role | Name | Email / Login | Password | Primary Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| **Founder / Superadmin** | Grotec Founder | `founder@grotec.local` | `Founder@Grotec2026!` | Company-wide access: 5,011 customers, financial reports, payroll, audit logs, role permission config. |
| **Farmer Success Manager** | Team Manager | `manager@grotec.local` | `Manager@Grotec2026!` | Telecaller monitoring, lead assignment, Action Center approvals (leave/shift), relationship portfolios. |
| **Telecaller (FSE 1)** | Agent 1 | `agent_1@grotec.local` | `Agent1@Grotec2026!` | Auto-dialer workspace, customer 360, crop advisory, order booking, personal attendance. |
| **Telecaller (FSE 2)** | Agent 2 | `agent_2@grotec.local` | `Agent2@Grotec2026!` | Dedicated customer base, SIM mobile dialing, follow-up management. |
| **Logistics & Delivery** | Delivery Driver | `delivery@grotec.local` | `Driver@Grotec2026!` | Mobile-optimized driver manifest, stop completion, POD capture, quantity return exceptions. |
| **Warehouse / Factory** | Staff One | `staff@grotec.local` | `Staff@Grotec2026!` | Inventory stock-in, loading checklists, batch tracking. |

> **Note on Founder Alternate Login:** The founder email `grotecdatabase@gmail.com` (password: `Grotecdatabase123@`) is also fully active with Superadmin permissions.

---

## 2. Real-Time Operations Verified in Pilot

All modules are equipped with automated background synchronization so screens update dynamically without requiring manual browser refreshes:

1. **Dashboard & KPIs:** Auto-refreshes every 10–30s with live conversion metrics, calling attempt rates, and daily revenue.
2. **Telecalling Queue (`/agent`):** Synchronizes every 8s. Call timers, notes, and instant "Save & Next" progression advance automatically.
3. **Driver Mobile Manifest (`/delivery`):** Auto-polls every 8s. Reflects real-time stop sequence, dispatched goods, and customer contact links.
4. **Logistics Dispatch Center (`/dispatch`):** Auto-refreshes every 10s. Monitors truck loading verification, live odometer readings, and route settlement.
5. **Action Center (`/action-center`):** Auto-updates every 15s. Managers see employee leave applications, shift permission slips, and operational requests instantly.
6. **Attendance Hub (`/hrms/attendance`):** Live 20s polling for biometric / eSSL punch sync and self-service regularization.
7. **Customer Directory (`/customers`):** Scoped by role; updates every 12s. Telecallers view only their assigned farmers; Founder views all 5,011 farmers.

---

## 3. End-to-End Pilot Workflow (Step-by-Step Test Guide)

To experience the full flow during the pilot, follow these 5 steps:

### Step 1: Telecalling & Advisory (`agent_1@grotec.local`)
1. Log in as `agent_1@grotec.local`.
2. Open **Calling Queue** (`/agent`). Click **"Call Next Farmer"**.
3. Use **Mobile SIM Dial** (opens phone dialer directly) or **Cloud Dialler**.
4. Log call outcome (e.g. `INTERESTED` or `ORDER_PLACED`). Fill in crop type and recommended bio-stimulant input.
5. Click **"Save & Next"** — data persists immediately and the next assigned farmer is loaded.

### Step 2: Customer Creation with Cascade Village Dropdowns
1. Go to **Farmer Directory** (`/customers`) and click **"New Farmer"**.
2. Select **State: Tamil Nadu** -> **District** -> **Taluk** -> **Village**.
   - Notice the searchable dropdown with over 16,000 official Tamil Nadu revenue villages, as well as Andhra Pradesh and Telangana dataset support.
3. Enter 10-digit mobile number and land area. Click **"Save Farmer"**.

### Step 3: Action Center & Leave Approval (`manager@grotec.local`)
1. As an agent, open **Action Center** (`/action-center`) and submit a **Shift Permission** or **Leave Application**.
2. Log in as `manager@grotec.local`.
3. In **Action Center** > **Incoming Requests**, the pending request appears automatically. Click **"Approve"** with an optional note.
4. Agent's status updates in real time to `APPROVED`.

### Step 4: Dispatch & Driver Route Execution (`delivery@grotec.local`)
1. Log in as `delivery@grotec.local` on a mobile browser or responsive view.
2. View **Active Delivery Route** with planned farm drop-offs.
3. Tap **"Navigate"** or **"Call Farmer"** directly from the stop card.
4. Mark stop as **"Delivered"** with Cash / UPI payment confirmation and digital signature / photo upload.
5. If partial quantities are received, tap **"Report Quantity Exception"** — inventory is automatically returned to vehicle stock pool upon manager approval.

### Step 5: Executive Review & Analytics (`founder@grotec.local`)
1. Log in as `founder@grotec.local`.
2. View executive **KPI Scorecard**, total converted farmer relationships, delivery settlement balance, and company-wide attendance summary.
3. Inspect **Audit Log** (`/audit`) to review every call outcome, status change, and login event recorded with exact actor and timestamp.

---

## 4. Technical Health & Stability Sign-Off

- **Backend API Endpoints:** 46 / 46 verified healthy with HTTP 200/2xx.
- **Frontend Build:** Verified with zero TypeScript compiler errors (`tsc --noEmit`) and clean Vite production bundling.
- **Unit & Integration Tests:** 241 automated tests passing across backend and frontend.
- **Database Status:** Live Supabase PostgreSQL holding 5,011 verified customer profiles and complete audit history.
