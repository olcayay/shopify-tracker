-- Seed Atlassian Marketplace categories (flat, no hierarchy)
INSERT INTO categories (platform, slug, title, url, category_level, parent_slug)
VALUES
  ('atlassian', 'admin-tools', 'Admin Tools', 'https://marketplace.atlassian.com/categories/admin-tools', 0, NULL),
  ('atlassian', 'charts-diagramming', 'Charts & Diagramming', 'https://marketplace.atlassian.com/categories/charts-diagramming', 0, NULL),
  ('atlassian', 'cloud-security', 'Cloud Security', 'https://marketplace.atlassian.com/categories/cloud-security', 0, NULL),
  ('atlassian', 'code-quality', 'Code Quality', 'https://marketplace.atlassian.com/categories/code-quality', 0, NULL),
  ('atlassian', 'code-review', 'Code Review', 'https://marketplace.atlassian.com/categories/code-review', 0, NULL),
  ('atlassian', 'continuous-integration', 'Continuous Integration', 'https://marketplace.atlassian.com/categories/continuous-integration', 0, NULL),
  ('atlassian', 'design-tools', 'Design Tools', 'https://marketplace.atlassian.com/categories/design-tools', 0, NULL),
  ('atlassian', 'documentation', 'Documentation', 'https://marketplace.atlassian.com/categories/documentation', 0, NULL),
  ('atlassian', 'integrations', 'Integrations', 'https://marketplace.atlassian.com/categories/integrations', 0, NULL),
  ('atlassian', 'it-service-management', 'IT Service Management', 'https://marketplace.atlassian.com/categories/it-service-management', 0, NULL),
  ('atlassian', 'macros', 'Macros', 'https://marketplace.atlassian.com/categories/macros', 0, NULL),
  ('atlassian', 'migration', 'Migration', 'https://marketplace.atlassian.com/categories/migration', 0, NULL),
  ('atlassian', 'monitoring', 'Monitoring', 'https://marketplace.atlassian.com/categories/monitoring', 0, NULL),
  ('atlassian', 'project-management', 'Project Management', 'https://marketplace.atlassian.com/categories/project-management', 0, NULL),
  ('atlassian', 'reports', 'Reports', 'https://marketplace.atlassian.com/categories/reports', 0, NULL),
  ('atlassian', 'security', 'Security', 'https://marketplace.atlassian.com/categories/security', 0, NULL),
  ('atlassian', 'testing-qa', 'Testing & QA', 'https://marketplace.atlassian.com/categories/testing-qa', 0, NULL),
  ('atlassian', 'time-tracking', 'Time Tracking', 'https://marketplace.atlassian.com/categories/time-tracking', 0, NULL),
  ('atlassian', 'workflow', 'Workflow', 'https://marketplace.atlassian.com/categories/workflow', 0, NULL)
ON CONFLICT (platform, slug) DO UPDATE SET
  title = EXCLUDED.title,
  url = EXCLUDED.url,
  category_level = EXCLUDED.category_level,
  parent_slug = EXCLUDED.parent_slug;
