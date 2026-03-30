-- PLA-451: AI suggestion cache tables

CREATE TABLE IF NOT EXISTS ai_keyword_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  platform VARCHAR(20) NOT NULL,
  app_summary TEXT,
  primary_category VARCHAR(200),
  target_audience TEXT,
  keywords JSONB,
  ngram_keywords JSONB,
  merged_keywords JSONB,
  model VARCHAR(50),
  ai_log_id UUID,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  cost_usd NUMERIC(10, 6),
  duration_ms INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  generated_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_kw_sugg_account_app
  ON ai_keyword_suggestions (account_id, app_id);
CREATE INDEX IF NOT EXISTS idx_ai_kw_sugg_expires
  ON ai_keyword_suggestions (expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_kw_sugg_status
  ON ai_keyword_suggestions (status);

CREATE TABLE IF NOT EXISTS ai_competitor_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  platform VARCHAR(20) NOT NULL,
  app_summary TEXT,
  market_context TEXT,
  competitors JSONB,
  jaccard_competitors JSONB,
  merged_competitors JSONB,
  model VARCHAR(50),
  ai_log_id UUID,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  cost_usd NUMERIC(10, 6),
  duration_ms INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  generated_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_comp_sugg_account_app
  ON ai_competitor_suggestions (account_id, app_id);
CREATE INDEX IF NOT EXISTS idx_ai_comp_sugg_expires
  ON ai_competitor_suggestions (expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_comp_sugg_status
  ON ai_competitor_suggestions (status);
