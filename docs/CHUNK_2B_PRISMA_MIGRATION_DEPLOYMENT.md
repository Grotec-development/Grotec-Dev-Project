# CHUNK 2B - Automatic Prisma Migration Deployment Safety

Status: PASS WITH WARNINGS. Repository startup gate implemented and validated; Render settings and a deployment of this change were not verified.

## 1. Problem
The backend Docker image previously started NestJS directly, without automatically applying committed migrations. An image could therefore start against a database missing migrations expected by its code.

## 2. Current architecture
Frontend: Vercel. Backend: NestJS/Prisma on Render, with a repository Docker build definition.

There is one production database: Supabase PostgreSQL.

`prisma migrate deploy` applies committed Prisma migrations to the existing database; it does not create another database.

This statement describes the intended existing, configured Supabase target. This change neither provisions a database nor changes either connection URL. The command still depends on Render pointing both URLs at the correct existing database.

## 3. Existing Render deployment flow
Repository evidence:
- No render.yaml or other Render service definition exists. Actual dashboard build/start overrides and service plan cannot be confirmed from repository files.
- backend/Dockerfile defines a two-stage node:20-alpine Docker image. Its COPY paths require repository-root build context.
- Build sequence: npm ci; npm run build:shared; then, from backend, npx prisma generate && npm run build.
- Backend build is tsc -p tsconfig.build.json, producing backend/dist/main.js.
- The runtime includes builder node_modules (including the Prisma CLI), the shared package, compiled backend, and the entire backend/prisma directory with schema and migrations.
- Runtime WORKDIR is /app/backend. Previous Docker start command: node dist/main.js.
- backend/package.json also has a source-loader npm start command; the Dockerfile does not use it.
- No repository-configured pre-deploy command exists. This does not establish whether one exists in Render's dashboard.
- .github/workflows/ci.yml validates shared/backend/frontend code and builds the frontend; it contains no Render deployment or production migration step.
- docker-compose.yml uses the root-context Dockerfile and environment files; it defines backend/frontend services, not an alternative production PostgreSQL service. infrastructure contains only a PDF extraction utility.
- Fourteen migration.sql files and migration_lock.toml are tracked by Git. Existing prisma:migrate-deploy and prisma:migrate-dev scripts confirm a migration-based workflow. Schema and migration files were not changed.

## 4. Selected solution
Option B: one migration gate in the existing Docker runtime CMD. No separate pre-deploy migration mechanism was added.

Render supports pre-deploy commands for paid services, including Docker. It is a good option when service configuration is available, but this repository has no Render configuration and no verified plan/dashboard access. The small Docker change provides the gate without inventing a service blueprint, service identity, or paid-plan setting.

Sources: https://render.com/docs/deploys and https://render.com/docs/docker (consulted for pre-deploy availability and Docker CMD override behavior).

## 5. Exact migration command
From /app/backend:

```sh
npm run prisma:migrate-deploy
```

The existing package script executes `prisma migrate deploy` using the installed Prisma CLI. It does not download a CLI at startup.

Complete Docker CMD:

```dockerfile
CMD ["sh", "-c", "npm run prisma:migrate-deploy && exec node dist/main.js"]
```

Do not prepend cd backend: the image is already in /app/backend.

## 6. Where it runs
In the runtime container at startup, after image build, Prisma Client generation, and TypeScript compilation. Production database credentials are not required for migration execution during image build because no migration runs there. Every startup using this image CMD, including restarts, checks/applies committed migrations.

## 7. Startup ordering
The shell waits for the migration script to return success before executing Node. NestJS cannot begin listening through this CMD until migrations succeed. `exec` replaces the shell with Node, preserving normal container shutdown signal handling.

## 8. Failure behavior
A nonzero migration result prevents the right-hand command from running and exits the container nonzero. Prisma/npm errors remain visible; no semicolon continuation, error suppression, or `|| true` was added. The new instance cannot become healthy. Render may retain the previous healthy deployment while the new deployment fails; this is not a claim that the old service stops serving traffic.

An isolated test ran the exact CMD chain through Bash with npm and exec stubbed: exit 0 reached the Node start attempt; exit 37 did not, and returned 37. Neither Prisma nor NestJS was invoked in this test. This verifies shell gating, not migration SQL or Linux image execution.

## 9. Supabase database behavior
schema.prisma retains provider postgresql, url env(DATABASE_URL), and directUrl env(DIRECT_URL). Prisma's migration connection uses the configured direct URL; runtime Prisma uses the application configuration. Both must identify the SAME existing Supabase production database. No alternative production database or new database resource was added.

Both local URL variables classify as Supabase targets. TEST_DATABASE_URL was absent from backend/.env; no safe existing test database was established. No migrate status or migrate deploy was executed. Production being up to date is prior user-provided context, not a status check performed in this chunk.

## 10. Environment variable handling
- No URL values, passwords, JWT secrets, or API keys were printed or added.
- No credentials or database URL are hardcoded in the changed Docker command.
- Render environment variables remain the source of production DATABASE_URL and DIRECT_URL values; their dashboard values were not inspected or changed.
- Git tracks only root/backend .env.example files, not actual .env files. Docker ignore rules exclude local .env files from image context.
- No environment, schema, migration, RBAC, auth, or calling files changed in this chunk.

## 11. Validation performed
- npm run build:shared: PASS.
- Backend npm run prisma:generate: PASS, Prisma Client 6.19.3 generated locally. Initial sandbox engine-download failure was resolved by an approved retry. Generation is not a database migration.
- Backend npm run build: PASS, including after generation. Compiled dist/main.js remains the startup target.
- Exact startup chain with success/failure stubs: PASS for exit 0 and exit 37.
- npx vitest run --config vitest.step1.config.js: PASS, 17 database-independent health/CORS tests. Initial sandbox spawn restriction was resolved by an approved retry. No destructive global test setup was run.
- Read-only GET to the documented public Render origin's /api/v1/health: HTTP 200, {"status":"ok","db":"up"}. The origin was taken from frontend/vercel.json. This checks the EXISTING deployment, not this undeployed change.
- Frontend production build is not part of the backend image build. It passed in the immediately preceding Chunk 2A on the same frontend code; no frontend files were changed or rebuild required by this Docker-only change. GitHub CI still contains its unchanged frontend build check.
- Full Docker image build/start: NOT RUN; Docker CLI exists but its Linux daemon pipe is absent. No daemon was started.
- Real node dist/main.js after a migration: NOT EXECUTED locally, because local credentials target Supabase and application background jobs could mutate production. Compilation, shell gating, isolated health tests, and the existing service health probe are the available evidence.
- git diff --check: PASS. Full git diff reviewed. The two pre-existing frontend modifications belong to Chunk 2A and were preserved.
- Existing Prisma package.json configuration and Vite CJS deprecation warnings remain; no toolchain migration was introduced.

## 12. Remaining Render configuration and files
No Render dashboard access or update was performed. Before deploying this change, verify the EXISTING service uses Docker, backend/Dockerfile, and repository-root build context. The Docker Command field must be empty to use the new image CMD. If it currently overrides CMD with node dist/main.js, clear that override. Verify that no separate pre-deploy migration command is configured, so only the selected mechanism runs. No new pre-deploy command is required for this solution.

If the service is actually using a native Node runtime, this Docker change will not affect it: its actual build/start configuration must first be confirmed. Do not claim automatic production migration deployment is active until the existing service consumes this Dockerfile and its CMD. Verify Render's health-check path is /api/v1/health during that review.

Files changed in Chunk 2B:
- backend/Dockerfile
- docs/CHUNK_2B_PRISMA_MIGRATION_DEPLOYMENT.md

The report exists locally but docs/ is ignored by .gitignore, so it does not appear in ordinary git status/diff. Ignore rules and Git index were not changed.

## 13. Rollback considerations
Rolling back an application image does not undo migrations already applied. Future committed migrations should remain compatible with the old application during rolling deployment and rollback. A failed migration may require diagnosis and an explicit recovery procedure; this startup gate never resets, repairs, or marks migrations resolved automatically. Review Prisma locking/concurrent-start failures and Render startup time limits if migration duration or replica count increases. Keep existing Supabase backup/recovery procedures; no backup setting was changed here.

No deployment, production migration execution, database reset/push, new database, new migration, schema edit, commit, or push occurred.
