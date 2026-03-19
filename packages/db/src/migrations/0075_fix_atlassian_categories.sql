-- Fix Atlassian categories: replace 19 old/incorrect slugs with the 10 official ones
-- from marketplace.atlassian.com/categories

-- Delete snapshots referencing old categories first (FK constraint)
DELETE FROM category_snapshots
WHERE category_id IN (
  SELECT id FROM categories
  WHERE platform = 'atlassian'
    AND slug IN (
      'charts-diagramming', 'cloud-security', 'code-quality', 'code-review',
      'continuous-integration', 'design-tools', 'documentation', 'integrations',
      'it-service-management', 'macros', 'migration', 'monitoring',
      'reports', 'security', 'testing-qa', 'time-tracking', 'workflow'
    )
);

-- Delete old categories that no longer exist on the marketplace
-- (keeping project-management and admin-tools which have correct slugs)
DELETE FROM categories
WHERE platform = 'atlassian'
  AND slug IN (
    'charts-diagramming',
    'cloud-security',
    'code-quality',
    'code-review',
    'continuous-integration',
    'design-tools',
    'documentation',
    'integrations',
    'it-service-management',
    'macros',
    'migration',
    'monitoring',
    'reports',
    'security',
    'testing-qa',
    'time-tracking',
    'workflow'
  );

-- Upsert the 10 correct categories with proper names and URLs
INSERT INTO categories (platform, slug, title, url, category_level, parent_slug)
VALUES
  ('atlassian', 'project-management', 'Project management', 'https://marketplace.atlassian.com/categories/project-management', 0, NULL),
  ('atlassian', 'admin-tools', 'Administrative tools', 'https://marketplace.atlassian.com/categories/admin-tools', 0, NULL),
  ('atlassian', 'content-communication', 'Content and communication', 'https://marketplace.atlassian.com/categories/content-communication', 0, NULL),
  ('atlassian', 'data-analytics', 'Data and analytics', 'https://marketplace.atlassian.com/categories/data-analytics', 0, NULL),
  ('atlassian', 'software-development', 'Software development', 'https://marketplace.atlassian.com/categories/software-development', 0, NULL),
  ('atlassian', 'it-support-service', 'IT support and service', 'https://marketplace.atlassian.com/categories/it-support-service', 0, NULL),
  ('atlassian', 'design-diagramming', 'Design and diagramming', 'https://marketplace.atlassian.com/categories/design-diagramming', 0, NULL),
  ('atlassian', 'security-compliance', 'Security and compliance', 'https://marketplace.atlassian.com/categories/security-compliance', 0, NULL),
  ('atlassian', 'hr-team-building', 'HR and team building', 'https://marketplace.atlassian.com/categories/hr-team-building', 0, NULL),
  ('atlassian', 'sales-customer-relations', 'Sales and customer relations', 'https://marketplace.atlassian.com/categories/sales-customer-relations', 0, NULL)
ON CONFLICT (platform, slug) DO UPDATE SET
  title = EXCLUDED.title,
  url = EXCLUDED.url,
  category_level = EXCLUDED.category_level,
  parent_slug = EXCLUDED.parent_slug;
