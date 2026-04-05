-- Add trace_id column to smoke_test_results for end-to-end log correlation
ALTER TABLE smoke_test_results ADD COLUMN IF NOT EXISTS trace_id VARCHAR(50);
