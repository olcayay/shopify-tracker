-- Add maxResearchProjects limit to packages and accounts tables

-- Packages table: plan-level defaults
ALTER TABLE packages ADD COLUMN max_research_projects integer NOT NULL DEFAULT 1;

-- Set per-tier defaults: free=1, starter=2, pro=5, enterprise=10
UPDATE packages SET max_research_projects = 1  WHERE slug = 'free';
UPDATE packages SET max_research_projects = 2  WHERE slug = 'starter';
UPDATE packages SET max_research_projects = 5  WHERE slug = 'pro';
UPDATE packages SET max_research_projects = 10 WHERE slug = 'enterprise';

-- Accounts table: per-account override
ALTER TABLE accounts ADD COLUMN max_research_projects integer NOT NULL DEFAULT 1;

-- Set existing accounts to their package default (or 1 if no package)
UPDATE accounts a
SET max_research_projects = COALESCE(
  (SELECT p.max_research_projects FROM packages p WHERE p.id = a.package_id),
  1
);
