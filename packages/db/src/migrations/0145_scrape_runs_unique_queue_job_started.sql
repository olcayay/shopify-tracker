-- PLA-1064: composite unique index on (queue, job_id, started_at) for non-null
-- jobIds. Defense-in-depth against future duplicate inserts after PLA-1060's
-- per-platform lock and PLA-1065's Redis noeviction flip already eliminated
-- the practical race. Partial index — scheduler-internal rows with no jobId
-- are not constrained.

-- Phase 1 (dedup): no-op safety net. As of 2026-04-13 there are 0 duplicate
-- (queue, job_id, started_at) groups in prod scrape_runs. The DELETE below is
-- idempotent and runs in milliseconds when there are no duplicates; if any
-- appear later, it keeps the row with the most-complete metadata + latest
-- completed_at, deleting older sibling rows.
WITH ranked AS (
  SELECT
    id,
    queue,
    job_id,
    started_at,
    ROW_NUMBER() OVER (
      PARTITION BY queue, job_id, started_at
      ORDER BY
        (CASE WHEN metadata IS NOT NULL THEN 1 ELSE 0 END) DESC,
        completed_at DESC NULLS LAST,
        created_at DESC
    ) AS rn
  FROM scrape_runs
  WHERE job_id IS NOT NULL
)
DELETE FROM scrape_runs s
USING ranked r
WHERE s.id = r.id AND r.rn > 1;

-- Phase 2 (constraint): plain CREATE UNIQUE INDEX. Drizzle runs migrations in
-- a transaction so CONCURRENTLY isn't allowed (migration-integrity guard);
-- a partial unique index over ~3k non-null-jobid rows builds in milliseconds
-- and the brief AccessShareLock is acceptable. If scrape_runs grows much
-- larger, split this into a separate non-transactional migration.
CREATE UNIQUE INDEX IF NOT EXISTS
  uniq_scrape_runs_queue_jobid_startedat
ON scrape_runs (queue, job_id, started_at)
WHERE job_id IS NOT NULL;
