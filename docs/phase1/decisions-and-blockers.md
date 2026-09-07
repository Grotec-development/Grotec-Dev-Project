# GROTEC FarmerOS Phase 1 — Decisions and Blockers

## Open Business Decisions (Documented as Configurable Policy)
1. **Total Revenue Data Source (PRD §7.4.1)**:
   - *Status*: Pending confirmation from GROTEC.
   - *Resolution*: Displayed as "Source Pending (Phase 2 Sales)" in UI; metric interface and calculation pipeline prepared without fabricating fictitious numbers.
2. **Product-Message Trigger (PRD §6.3.10 vs §6.3.7)**:
   - *Status*: Configurable trigger policy.
   - *Resolution*: Supported for both `SALES` and `INTERESTED` paths via a configurable policy flag (`NOTIF_TRIGGER_ON_SALES_ONLY=true` by default) to prevent duplicate sends.
3. **Founder vs Manager/Admin Restricted Control Boundary (PRD §5.1.2)**:
   - *Status*: Working definition implemented.
   - *Resolution*: Full audit logs, sensitive payroll locking/unlocking, system administration reserved to Founder; Manager/Admin has operational access to HRMS and CRM approvals.
4. **Staff Role Permissions (PRD §5.1.4)**:
   - *Status*: Working definition implemented.
   - *Resolution*: Staff can view assigned employees, prepare attendance/leave/payroll drafts, but cannot approve or publish payroll or approve leave.
5. **Auto-Dialer and ESSL Vendors (PRD §12)**:
   - *Status*: Abstracted behind internal adapter interfaces.
   - *Resolution*: `DialerProvider` and `EsslAdapter` interfaces implemented with comprehensive mock/sandbox implementations and webhook handlers.

## External Blockers
- None blocking Phase 1 local web and API development. Real production provider credentials (e.g. GoDial, specific ESSL cloud API, SMS/WhatsApp gateways) are pending client selection and will plug directly into the implemented provider adapters.
