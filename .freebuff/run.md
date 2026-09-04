# Preview run doc — GROTEC FarmerOS CRM

How to stand up the live preview (React SPA on :5173 proxying the Nest API on :3000,
both backed by embedded PostgreSQL on :5432). Written from the working setup.

## 0. Workspace layout

- Monorepo (npm workspaces): `apps/api` (NestJS + Prisma), `apps/web` (React + Vite + Tailwind), `packages/shared`.
- All servers must run from this same checkout (root = `C:\Users\narra\OneDrive\Documents\grotec project`).
- Paths contain a space — quote them; `Start-Process` needs the executable named exactly (`node.exe`, `npm.cmd`).
- Windows detach recipe used throughout (stdout/stderr must go to DIFFERENT files):

```powershell
powershell -NoProfile -Command "(Start-Process -FilePath '<exe>' -ArgumentList <args...> -WorkingDirectory '<cwd>' -RedirectStandardOutput '<log>' -RedirectStandardError '<log>.err' -WindowStyle Hidden -PassThru).Id"
```

## 1. Reproduce the artifacts a fresh checkout needs

```bash
npm install                                  # workspaces; embedded-postgres + prisma engines
cp apps/api/.env.example apps/api/.env       # dev defaults (DATABASE_URL, JWT secrets, seeds)
npm run build:shared                         # packages/shared -> dist (API consumes CJS)
cd apps/api && npm run build                 # tsc -> apps/api/dist (node dist/main.js)
```

DB state (schema + seed) lives in the git-ignored `.pgdata/` directory. For a brand-new
data dir only, after the DB is up (step 2):

```bash
cd apps/api && npx prisma migrate deploy && npx tsx prisma/seed.ts
```

`migrate deploy`/`seed` are idempotent and safe to re-run anytime.

## 2. Database (embedded PostgreSQL, port 5432)

Start with `infra/dev-db.mjs serve` — NOT `start`. `start` exits its node parent and the
postgres child dies with it; `serve` holds the process open. The script skips initdb when
`.pgdata/PG_VERSION` exists and auto-clears the stale `postmaster.pid` left by unclean
shutdowns (machine/session restarts).

```powershell
powershell -NoProfile -Command "(Start-Process -FilePath 'node.exe' -ArgumentList 'infra/dev-db.mjs','serve' -WorkingDirectory 'C:\Users\narra\OneDrive\Documents\grotec project' -RedirectStandardOutput 'C:\Users\narra\OneDrive\Documents\grotec project\.freebuff\db-serve.log' -RedirectStandardError 'C:\Users\narra\OneDrive\Documents\grotec project\.freebuff\db-serve.log.err' -WindowStyle Hidden -PassThru).Id"
```

Check: `node infra/dev-db.mjs status` → `running on 127.0.0.1:5432`.

## 3. API (NestJS, port 3000)

Run the compiled app from `apps/api` so `@nestjs/config` finds `.env` there.
`main.ts` maps a shell-inherited `PORT=0` back to 3000, so no env juggling is needed.

```powershell
powershell -NoProfile -Command "(Start-Process -FilePath 'node.exe' -ArgumentList 'dist/main.js' -WorkingDirectory 'C:\Users\narra\OneDrive\Documents\grotec project\apps\api' -RedirectStandardOutput 'C:\Users\narra\OneDrive\Documents\grotec project\.freebuff\api.log' -RedirectStandardError 'C:\Users\narra\OneDrive\Documents\grotec project\.freebuff\api.log.err' -WindowStyle Hidden -PassThru).Id"
```

Check: `curl http://localhost:3000/api/v1/health` → `{"status":"ok","db":"up"}`.

Gotcha: an instance that boots but never binds/logs usually means a zombie copy holds the
port — kill listeners on 3000 first (`netstat -ano | grep :3000`, then `taskkill //PID <pid> //F`).

## 4. Web (Vite dev server, port 5173)

Vite defaults to binding IPv6-only (`[::1]`); the preview checker needs IPv4, so always
pin `--host 127.0.0.1`. `vite.config.ts` sets `port: 5173, strictPort` and proxies `/api` → `:3000`.

```powershell
powershell -NoProfile -Command "(Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev','--','--host','127.0.0.1' -WorkingDirectory 'C:\Users\narra\OneDrive\Documents\grotec project\apps\web' -RedirectStandardOutput 'C:\Users\narra\OneDrive\Documents\grotec project\.freebuff\preview-4596140b-481f-4177-bd10-d225e5b03ed3.log' -RedirectStandardError 'C:\Users\narra\OneDrive\Documents\grotec project\.freebuff\preview-4596140b-481f-4177-bd10-d225e5b03ed3.log.err' -WindowStyle Hidden -PassThru).Id"
```

Wait until the log shows `VITE v5.4.21 ready` (first boot can take ~15 s), then verify
`curl http://127.0.0.1:5173/agent` returns 200 before registering the preview.

Register: `register_preview` with `url: http://localhost:5173/agent` and the pid of the
vite listener (find it via `netstat -ano | grep ":5173.*LISTEN"` — it is the node child
of the npm wrapper pid that Start-Process prints).

## 5. Demo logins (dev seeds only)

`founder@grotec.local`, `manager@grotec.local`, `agent@grotec.local`, `staff@grotec.local` —
password from `FOUNDER_PASSWORD` in `apps/api/.env` (default `Founder@123`). The login page
shows one-click role cards.

## 6. Logs & troubleshooting

| Server | Log | Stderr |
|---|---|---|
| DB serve | `.freebuff/db-serve.log` | `.freebuff/db-serve.log.err` |
| API | `.freebuff/api.log` | `.freebuff/api.log.err` |
| Vite | `.freebuff/preview-4596140b-481f-4177-bd10-d225e5b03ed3.log` | same + `.err` |

- After any machine/session restart everything is gone: redo steps 2 → 3 → 4 (artifacts and
  `.pgdata` persist; step 1 only on a fresh clone).
- `node infra/dev-db.mjs status` distinguishes DB-down from DB-up before debugging the API.
- `PORT=0` in the shell env is expected and handled by `apps/api/src/main.ts`.
