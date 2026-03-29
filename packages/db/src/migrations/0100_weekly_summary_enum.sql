-- Add weekly_summary to scraper_type enum
ALTER TYPE scraper_type ADD VALUE IF NOT EXISTS 'weekly_summary';
