Read and follow the comprehensive guide at `files/ADDING_NEW_PLATFORM.md` to add a new marketplace platform to the AppRanks tracking system.

This guide covers all 7 phases:
1. Platform Configuration (constants, URL builders, similarity, metadata limits)
2. Database (migrations for platform access, categories, visibility)
3. Scraper Module (PlatformModule, parsers, registry, scheduler)
4. API Routes (live-search, developer info, capability gating)
5. Dashboard UI (VALID_PLATFORMS x3, sidebar, badges, labels/colors/brands, preview, field labels, capability gates)
6. Workers & Scheduler (cron jobs, job cascading)
7. Account Access Control (platform access, visibility, package limits)

Start by reading `files/ADDING_NEW_PLATFORM.md` in full, then follow the Quick Checklist. The user will provide the platform name and marketplace URL. Use the guide's phase order and verification checklist.

Platform argument (if provided): $ARGUMENTS
