# Shopify Tracking Project

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
