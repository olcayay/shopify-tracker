CREATE TABLE IF NOT EXISTS dead_letter_jobs (
  id SERIAL PRIMARY KEY,
  job_id VARCHAR(255) NOT NULL,
  queue_name VARCHAR(100) NOT NULL,
  job_type VARCHAR(100) NOT NULL,
  platform VARCHAR(50),
  payload JSONB NOT NULL,
  error_message TEXT,
  error_stack TEXT,
  attempts_made INTEGER NOT NULL DEFAULT 0,
  failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  replayed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dlj_job_type ON dead_letter_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_dlj_failed_at ON dead_letter_jobs(failed_at);
CREATE INDEX IF NOT EXISTS idx_dlj_platform ON dead_letter_jobs(platform);
