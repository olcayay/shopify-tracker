ALTER TABLE scrape_item_errors ADD COLUMN IF NOT EXISTS linear_issue_id VARCHAR(50);
ALTER TABLE scrape_item_errors ADD COLUMN IF NOT EXISTS linear_issue_url VARCHAR(512);
