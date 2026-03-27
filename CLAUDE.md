# Shopify Tracking Project

## Production Server
- **SSH:** `ssh root@5.78.101.102`
- **Hosting:** Coolify (self-hosted PaaS) on Hetzner VPS
- **Proxy:** Cloudflare → Traefik (Coolify) → Docker containers
- **Domains:** `appranks.io` (dashboard), `api.appranks.io` (API)
- **Containers:** API (port 3001), Dashboard (port 3000), Worker, Worker-Interactive, PostgreSQL, Redis
- **Container names:** Random Coolify IDs (use `docker ps` to find them)
- **DB container:** PostgreSQL with default `postgres` database (not `shopify_tracking`)

## Rules
- All user-facing text in the dashboard must be in English. Never use Turkish or any other language for UI text, labels, warnings, descriptions, or placeholder text.
- Commits should include both `files/tasks.txt` and `files/notes.txt`
- **`files/ADDING_NEW_PLATFORM.md` must always be kept up to date.** This is the critical reference guide for adding new platforms. Whenever you:
  - Add a new platform or modify platform integration code
  - Discover a new hardcoded platform check that needs updating for new platforms
  - Encounter a bug caused by a missing platform check (e.g., missing from `isFlat`, `VALID_PLATFORMS`, browser init, etc.)
  - Add a new file or code pattern that requires per-platform configuration
  - Learn a new pitfall or lesson from platform work

  You MUST update `files/ADDING_NEW_PLATFORM.md` accordingly — add the new file/check to the Quick Checklist, update code snippets, add rows to reference tables, or add a new Pitfall entry. Never leave the guide stale.
- **Always add unit tests:**
  - When implementing a new feature, add unit tests covering the new functionality.
  - When fixing a bug, add a unit test that reproduces the bug to prevent regression.
- **All tests must pass before committing.** Run `npm test` (which runs all 4 packages via turbo) and verify 0 failures before every commit. Pre-commit and pre-push hooks enforce this automatically.
- **Smoke test after scraper changes.** When modifying any platform's scraper code (parsers, fetchers, CLI commands, platform modules), run `./scripts/smoke-test.sh --platform <name>` to verify the affected platform still works end-to-end. If any check fails, fix it before committing. The smoke test must always have 0 SKIPs.
- **Database migration safety rules.** When creating or modifying migrations:
  1. **Always update the journal.** After creating a new `.sql` file in `packages/db/src/migrations/`, add the corresponding entry to `packages/db/src/migrations/meta/_journal.json`. Without this, Drizzle will silently skip the migration on deploy.
  2. **Use `IF NOT EXISTS` / `ON CONFLICT`.** All `CREATE TABLE`, `CREATE INDEX`, and seed `INSERT` statements must be idempotent.
  3. **Use `CONCURRENTLY` for indexes on large tables.** `CREATE INDEX CONCURRENTLY` avoids table locks. Note: this cannot run inside a transaction, so add `-- breakpoint` before it.
  4. **Split destructive migrations into phases.** If a migration needs to (a) add columns, (b) backfill data, (c) add constraints — use separate numbered migration files (e.g., 0091, 0092, 0093). Each phase must be independently safe.
  5. **Never DROP or ALTER columns with data without a backfill plan.** Adding a `NOT NULL` column requires a default or a prior backfill migration.
  6. **Test migration locally before committing.** Run `npm run db:migrate` against a local DB (or use `docker compose up postgres` + run the SQL manually) to verify it applies cleanly.
  7. **Verify journal entry format.** Each entry needs: `idx` (sequential), `version: "7"`, `when` (Unix ms timestamp), `tag` (filename without .sql), `breakpoints: true`.
  8. **Migrations run on API startup** (`apps/api/src/index.ts`). If a migration fails, the API container won't start. There is no automatic rollback — manual SQL cleanup is required.

## Linear Task Workflow

### Creating tasks ("task aç", "issue aç", etc.)
When the user asks to create a task, use the **Linear GraphQL API via `curl`** to create an issue in the PLA project:
- **Team ID:** `13127a86-8941-4c00-9031-9efb4a4fb91b`
- **Project ID:** `ee05a847-f284-4134-974f-6f3cfc7cec7a` (Shopify App Tracker) — all tasks must be created under this project. Add `projectId` to the `IssueCreateInput`.
- **Label:** Always add `auto-generated` label (ID: `25dbb951-787e-4845-9dba-984d57a57fae`)
- **Title:** Clear, descriptive, action-oriented (English)
- **Body structure:**
  ```
  ## Problem
  What's broken or missing, with observable symptoms

  ## Root Cause
  Why it happens — specific files, line numbers, code paths

  ## Solution Options
  ### Option A: (recommended)
  What to do, which files to change
  ### Option B:
  Alternative approach

  ## Acceptance Criteria
  - Concrete, testable outcomes
  ```
- Write the JSON payload to `/tmp/linear-create.json` (heredoc with `'JSONEOF'`), then `curl -d @/tmp/linear-create.json`
- Use mutation with variables: `mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier url } } }`

### Implementing tasks ("task çöz", "implement et", etc.)
When the user asks to implement tasks:
1. **Fetch Todo tasks** from Linear via GraphQL API (filter by team PLA, state "Todo")
2. **Work on each task individually** — one task, one commit
3. **For each task:**
   a. Move Linear issue to **In Progress** state
   b. Implement the solution, add tests, verify all tests pass
   c. Commit with message referencing the issue (e.g., `Fix dashboard /health endpoint (PLA-90)`)
   d. Move Linear issue to **Done** state
   e. Add a **comment** to the Linear issue with:
      - Implementation summary (what was done, how it works, files changed)
      - Commit hash as a clickable link: `[commit_hash](https://github.com/olcayay/shopify-tracker/commit/commit_hash)`
   f. Use Linear GraphQL API via `curl` for comments — write JSON payload to `/tmp/linear-comment.json`, then `curl -d @/tmp/linear-comment.json`
   g. Use mutation: `mutation($input: CommentCreateInput!) { commentCreate(input: $input) { success } }`
