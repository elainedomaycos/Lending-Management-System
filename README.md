# Lending Management System

A frontend-only lending and collections workspace for small local lending businesses.

## Run & Operate

- `pnpm --filter lending-management-system dev` — run the frontend app (defaults to port `5000`)
- `pnpm --filter @workspace/api-server dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Frontend auth: the sign-in screen posts the PIN to the API (`VITE_API_URL`, defaults to `/api`); the API verifies it against the `users` table's scrypt hash. Seed via `supabase/migrations/0003_users.sql` — it provisions the owner (`Divine Valdez`) with demo PIN `1234`. Change the PIN by updating `users.pin_hash` with a new `scrypt$N$r$p$<salt>$<hash>` string (e.g. `node -e "console.log('scrypt$16384$8$1$'+require('node:crypto').randomBytes(16).toString('base64')+'$'+require('node:crypto').scryptSync(process.env.NEW_PIN,require('node:crypto').randomBytes(16),64,{N:16384,r:8,p:1}).toString('base64'))"`).
- Vercel deploy: ONE project. Import/git-push with Root Directory `artifacts/lending-management-system` — `vercel.json` there declares the Vite build (`pnpm run vercel:build`), which builds the frontend (→ `dist/public`) and bundles the API (`artifacts/api-server`) into `api/app.mjs`. Requests to `/api/*` go to the API function; everything else is the SPA (fallback to `/index.html`). Env vars to set in this one project: `DATABASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. No separate API deployment exists anymore.

The frontend dev server reads optional `PORT` and `BASE_PATH` environment variables and falls back to `5000` and `/` respectively.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/lending-management-system/src/App.tsx` — frontend-only app shell, routes, local mock state, business calculations, and page flows
- `artifacts/lending-management-system/src/index.css` — Lending Management System theme, responsive layout, tables, modals, status badges, and mobile navigation
- `attached_assets/` — visual references used for the dashboard direction

## Architecture decisions

- The first release is intentionally frontend-only with realistic local mock data; a full backend API, database persistence, and account recovery (phone/email) are deferred. The sign-in PIN is validated server-side against a hashed `users.pin_hash` when the API is reachable; offline demo mode falls back to any 4-digit PIN.
- Wouter provides flat, prefix-aware client routing and the main product shell keeps navigation available across pages.
- Lending calculations are kept transparent in the UI: interest, total due, daily target, partner profit, payment status, and remaining balance are derived from local state.
- The primary experience is tablet landscape, with a collapsed mobile header and bottom navigation for phone use.

## Product

Lending Management System lets an operator manage borrowers, create and inspect daily/monthly loans, record payments, review missed collections, track partner profit and settlements, and view lending reports. It includes realistic Philippine names and peso-denominated mock records so the workflow can be demonstrated end to end.

## User preferences

- Keep the interface in English and use Philippine Peso formatting.
- Favor simple, professional, scan-friendly workflows over banking-style complexity.

## Gotchas

- The app's business data is intentionally local mock state and will reset on refresh; do not describe it as production persistence.
- The API and database workspace packages remain scaffolded but are not required by the current frontend prototype.