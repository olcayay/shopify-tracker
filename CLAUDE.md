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
- **Icon library:** Use Lucide React (`lucide-react`) exclusively for all icons. Do NOT use Heroicons, FontAwesome, or other icon libraries. Dashboard header icons must use `h-4 w-4` size with `h-8 w-8` button wrappers. Page-level section icons use `h-5 w-5` or `h-6 w-6`.
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
- **Bug fix prevention rule.** When fixing any bug, always ask: "What test or guard would have caught this before deployment?" Then:
  1. Add a test that reproduces the specific bug.
  2. Proactively add tests/guards for similar variations of the same bug class — don't just fix the one instance.
  3. Consider structural safeguards (types, validation, shared constants, lint rules) that could prevent the entire category.
  4. The fix must include both the code change AND the preventive measures — never ship a fix without them.
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

- **Project:** [Shopify App Tracker](https://linear.app/plan-b-side-projects/project/shopify-app-tracker-0c73ee47f3c9/)
- **Team ID:** `13127a86-8941-4c00-9031-9efb4a4fb91b`
- **Project ID:** `ee05a847-f284-4134-974f-6f3cfc7cec7a` — all tasks must be created under this project. Add `projectId` to the `IssueCreateInput`.
- **Label (always):** `auto-generated` (ID: `25dbb951-787e-4845-9dba-984d57a57fae`)
- All Linear API calls use `curl` with JSON payload written to `/tmp/linear-*.json` (heredoc with `'JSONEOF'`)

### Creating tasks ("task aç", "issue aç", etc.)

**Single task:**
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
- Use mutation with variables: `mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier url } } }`

**Batch/group task creation (multiple related tasks):**
When creating a group of related tasks (e.g., a feature epic, a redesign project):
1. **Create a topic-specific label** for the group (e.g., `app-detail-v2`, `auth-refactor`). Use `issueLabelCreate` mutation. Add this label to ALL tasks in the group alongside `auto-generated`.
2. **Set priority** on each task to show relative importance within the group. Use the `priority` field in `IssueCreateInput` (1=Urgent, 2=High, 3=Medium, 4=Low, 0=None).
3. **Add phase prefix to titles** if the tasks are organized into phases. Format: `Phase N: <title>` (e.g., `Phase 0: Create directory structure`, `Phase 2: Build enhanced keywords page`).

### Implementing tasks ("task çöz", "implement et", etc.)
When the user asks to implement tasks:
1. **Fetch Todo tasks** from Linear via GraphQL API (filter by team PLA, state "Todo", project Shopify App Tracker)
2. **Read comments** on each task before starting — comments may contain extra context, clarifications, or updated requirements. Use: `query { issue(id: "...") { comments { nodes { body createdAt } } } }`
3. **Prioritize and order tasks** based on:
   - Priority field (1=Urgent first, then 2=High, etc.)
   - Phase prefix in title (Phase 0 before Phase 1, etc.)
   - Dependencies between tasks (blockers first)
4. **Work on each task individually** — one task, one commit
5. **For each task:**
   a. Move Linear issue to **In Progress** state
   b. Implement the solution, add tests, verify all tests pass
   c. Commit with message referencing the issue (e.g., `Fix dashboard /health endpoint (PLA-90)`)
   d. **If the task references a document** (e.g., a design doc, spec, or guide), update that document to reflect the task's completion (mark as done, update status, add implementation notes)
   e. Add a **comment** to the Linear issue with the following structure:
      - **Ne yapıldı:** Short summary of what was implemented
      - **Nasıl yapıldı:** Key technical decisions, files changed, approach taken
      - **Proje etkisi:** What this change enables, potential side effects, what to watch out for
      - **Test adımları:** Step-by-step manual testing instructions (how to verify the change works)
      - Commit hash as a clickable link: `[commit_hash](https://github.com/olcayay/shopify-tracker/commit/commit_hash)`
   f. Move Linear issue to **In Review** state — **NEVER move to Done**. Only the user moves tasks to Done after manual testing.
   g. Use Linear GraphQL API via `curl` for comments — write JSON payload to `/tmp/linear-comment.json`, then `curl -d @/tmp/linear-comment.json`
   h. Use mutation: `mutation($input: CommentCreateInput!) { commentCreate(input: $input) { success } }`
