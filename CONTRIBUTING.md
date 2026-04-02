# Contributing to AppRanks

## Prerequisites

- **Node.js** v22+ (use [nvm](https://github.com/nvm-sh/nvm): `nvm use`)
- **Docker** (for PostgreSQL and Redis via docker compose)
- **npm** v10+

## Getting Started

```bash
# Clone the repository
git clone https://github.com/olcayay/shopify-tracker.git
cd shopify-tracker

# Install dependencies (all workspaces)
npm install

# Start PostgreSQL + Redis
docker compose up -d postgres redis

# Copy environment variables
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/dashboard/.env.example apps/dashboard/.env.local
cp apps/scraper/.env.example apps/scraper/.env

# Build shared packages
npx turbo run build --filter=@appranks/shared --filter=@appranks/db

# Run database migrations
npm run db:migrate --workspace=@appranks/api

# Start development servers
npx turbo run dev --filter=@appranks/api --filter=@appranks/dashboard
```

## Project Structure

```
apps/
  api/          — Fastify REST API (port 3001)
  dashboard/    — Next.js frontend (port 3000)
  scraper/      — BullMQ workers, platform scrapers, CLI tools
packages/
  db/           — Drizzle ORM schema, migrations, DB utilities
  shared/       — Shared types, constants, logger, platform definitions
```

## Development Workflow

### Running Tests

```bash
# All packages
npm test

# Single package
npx turbo run test --filter=@appranks/api
npx turbo run test --filter=@appranks/dashboard
npx turbo run test --filter=@appranks/scraper
```

All tests must pass before committing. Pre-commit hooks enforce lint + typecheck + tests.

### Code Style

- **TypeScript** everywhere — strict mode
- **ESLint** for linting (warnings OK, errors block commit)
- **Icons:** Use `lucide-react` exclusively (no Heroicons, FontAwesome)
- **UI components:** shadcn/ui in `apps/dashboard/src/components/ui/`
- **All user-facing text must be in English**

### Database Migrations

1. Create a new `.sql` file in `packages/db/src/migrations/`
2. Add the entry to `packages/db/src/migrations/meta/_journal.json`
3. Use `IF NOT EXISTS` / `ON CONFLICT` for idempotency
4. Use `CREATE INDEX CONCURRENTLY` for large tables (add `-- breakpoint`)
5. Test locally: `npm run db:migrate --workspace=@appranks/api`

See `CLAUDE.md` for detailed migration safety rules.

### Commit Messages

Format: `<action> <what> (<ticket>)`

```
Implement password reset flow (PLA-541)
Fix dark mode for notification bell (PLA-539)
Add HTTP caching headers to public endpoints (PLA-545)
```

### Adding a New Platform

Follow the guide in `files/ADDING_NEW_PLATFORM.md`.

## Testing Requirements

- **New features:** Add unit tests covering the functionality
- **Bug fixes:** Add a test that reproduces the bug
- **Run `npm test`** and verify 0 failures before every commit
- **Scraper changes:** Run `./scripts/smoke-test.sh --platform <name>`

## Pull Requests

1. Create a feature branch from `main`
2. Make your changes with tests
3. Ensure `npm test` passes (all packages)
4. Push and create a PR with a clear description
