# Klar Parat Monorepo

This repository hosts the Klar Parat product with a TypeScript-first monorepo. The stack is set up so future iterations can focus on delivering features instead of wiring.

## Structure

```
/apps
  /api   # Express + Prisma (SQLite)
  /web   # React + Vite + Tailwind-ready styling
/packages
  /shared  # Reusable types and feature flag contracts
/prisma     # Prisma schema and migrations
/.github/workflows # Continuous integration
```

## Getting Started

```bash
pnpm install

# Start the API (http://localhost:3000)
pnpm --filter api dev

# Start the web app (http://localhost:5173)
pnpm --filter web dev
```

The web app will report `Web App: OK` locally. When the API is running the status check will show `API: OK` thanks to the `/health` endpoint.

### Environment

Copy `.env.example` to `.env` at the project root and update secrets as needed. The defaults keep fake providers enabled for local development.

```
DATABASE_URL="file:./prisma/dev.db"
OPENAI_API_KEY=""
TTS_PROVIDER_API_KEY=""
TTS_PROVIDER_VOICE=""
USE_FAKE_LLM="true"
USE_FAKE_TTS="true"
ENABLE_URGENCY="false"
ENABLE_MEDALS="false"
```

### Scripts

| Command | Description |
| ------- | ----------- |
| `pnpm lint` | Runs ESLint across the workspace. |
| `pnpm typecheck` | Executes TypeScript in `--noEmit` mode for all packages. |
| `pnpm test` | Executes Vitest across all packages. |
| `pnpm build` | Runs package build pipelines. |

CI (see `.github/workflows/ci.yml`) installs dependencies, lints, typechecks, and runs tests to guard the main branch.
