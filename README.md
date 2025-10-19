# Klar Parat

Monorepo scaffolding for the Klar Parat morning routine companion. The project follows the plan in [`PLAN.md`](./PLAN.md) and the product contract in [`PRD.md`](./PRD.md).

## Structure

```
/apps
  /api    # Express API + Prisma (SQLite)
  /web    # React + Vite + Tailwind UI
/packages
  /shared # TypeScript types and utilities
```

## Prerequisites

- Node.js 20+
- npm 9+

Copy the example environment file and adjust values as needed:

```bash
cp .env.example .env
```

The generated `.env` configures Prisma to use a local SQLite database file (`DATABASE_URL="file:./dev.db"`). The API will create
and manage this file automatically—no separate database server is required. If you change the location, update `DATABASE_URL`
accordingly.

## Install

```bash
npm install
```

The root `postinstall` hook automatically runs `prisma generate` for the API workspace. If you change the Prisma schema later, rerun:

```bash
npm run prisma:generate --workspace @klar-parat/api
```

## Development

Run the API (port 4000 by default):

```bash
npm run dev --workspace @klar-parat/api
```

The API dev server automatically applies pending Prisma migrations to the local SQLite database. If you need to apply them
manually (for example after pulling new migrations on a running process), run:

```bash
npm run prisma:migrate:deploy --workspace @klar-parat/api
```

Run the web app (port 5173 by default):

```bash
npm run dev --workspace @klar-parat/web
```

The Vite dev server proxies `/api/*` requests to the API at `http://localhost:4000`, so keep the API dev server running alongside the web shell to avoid network errors.

Visit `http://localhost:4000/health` and `http://localhost:5173/` to confirm both surfaces respond with `OK` for iteration 0.

## Quality Checks

```bash
npm run lint
npm run typecheck
npm run test
```

Each command fans out to every workspace so the repo stays consistent.
