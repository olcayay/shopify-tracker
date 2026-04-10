-- Notifications: optimize unread-count query (filters on user_id, is_read, is_archived)
-- Existing idx_notifications_user_unread covers (user_id, created_at) which misses filter columns
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_archived
ON notifications (user_id, is_read, is_archived);

-- App category rankings: optimize PARTITION BY (app_id, category_slug) ORDER BY scraped_at DESC
-- Used by competitors endpoint windowed queries and starred-categories DISTINCT ON
CREATE INDEX IF NOT EXISTS idx_app_cat_rankings_app_cat_scraped
ON app_category_rankings (app_id, category_slug, scraped_at DESC);

-- App snapshots: expression index on developer->>'name' for developer queries
-- Used by developers endpoint CTE, admin developer list, and developer detail
CREATE INDEX IF NOT EXISTS idx_app_snapshots_developer_name
ON app_snapshots ((developer->>'name'));
