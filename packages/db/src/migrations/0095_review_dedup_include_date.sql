-- PLA-255: Change review deduplication to include review_date,
-- so updated reviews from the same reviewer on different dates are preserved.
-- Same reviewer + same date = deduped (captures edits on same day).

-- Drop old unique index (appId, reviewerName)
DROP INDEX IF EXISTS idx_reviews_dedup;

-- Create new unique index (appId, reviewerName, reviewDate)
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_dedup ON reviews (app_id, reviewer_name, review_date);
