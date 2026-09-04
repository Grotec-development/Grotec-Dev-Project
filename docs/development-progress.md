# Development Progress

_Updated continuously. Five full months are dedicated to the CRM; each month ends with a
review/stop gate before the next begins._

## Month 1 — CRM Foundation (in progress)

Goal: strong technical foundation — identity, RBAC, customer/farmer master + phone duplicate
prevention, crops/acreage, leads + lead ownership, audit, API, responsive UI shell.

### Order of work

- [x] Repo scaffold (npm workspaces, git, tooling)
- [x] Docs skeleton (`docs/`)
- [ ] Dev DB (Docker Compose + embedded fallback) running
- [ ] `packages/shared` constants
- [ ] API scaffold (NestJS, Prisma, error envelope, Swagger)
- [ ] Schema migration + seed (roles/permissions/crops/demo)
- [ ] Auth + RBAC guard
- [ ] Employees module
- [ ] Customers module (phones, normalization, duplicate prevention, search)
- [ ] Crops + customer crops
- [ ] Leads + lead ownership
- [ ] Audit
- [ ] Backend tests green
- [ ] Web shell + auth
- [ ] Web: customers / crops / leads / team / audit screens
- [ ] Frontend tests + full check run
- [ ] Final docs, demo, stop gate

### Milestones reached

- (none yet — scaffolding in progress)
