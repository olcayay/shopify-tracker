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

## Linear Task Workflow

### Creating tasks ("task aç", "issue aç", etc.)
When the user asks to create a task, use the **Linear GraphQL API via `curl`** to create an issue in the PLA project:
- **Team ID:** `13127a86-8941-4c00-9031-9efb4a4fb91b`
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
