-- Seed: Google Workspace Marketplace categories
-- Discovered from live sidebar navigation
-- Hierarchical: parent (hub, level 0) → child (listing, level 1)
-- Slug uses '--' separator for parent--child paths
-- NOTE: Curated/editorial sections (popular-apps, top-rated, etc.) are NOT categories.
-- They are handled as featured_app_sightings by the scraper.

INSERT INTO categories (platform, slug, title, url, parent_slug, category_level, is_tracked, is_listing_page) VALUES
  -- Parent categories (hub pages, level 0)
  ('google_workspace', 'business-tools', 'Business Tools', 'https://workspace.google.com/marketplace/category/business-tools', NULL, 0, true, true),
  ('google_workspace', 'communication', 'Communication', 'https://workspace.google.com/marketplace/category/communication', NULL, 0, true, true),
  ('google_workspace', 'productivity', 'Productivity', 'https://workspace.google.com/marketplace/category/productivity', NULL, 0, true, true),
  ('google_workspace', 'education', 'Education', 'https://workspace.google.com/marketplace/category/education', NULL, 0, true, true),
  ('google_workspace', 'utilities', 'Utilities', 'https://workspace.google.com/marketplace/category/utilities', NULL, 0, true, true),
  ('google_workspace', 'enterprise-apps', 'Enterprise Apps', 'https://workspace.google.com/marketplace/category/enterprise-apps', NULL, 0, true, true),

  -- Business Tools children (level 1)
  ('google_workspace', 'business-tools--accounting-and-finance', 'Accounting and Finance', 'https://workspace.google.com/marketplace/category/business-tools/accounting-and-finance', 'business-tools', 1, true, true),
  ('google_workspace', 'business-tools--administration-and-management', 'Administration and Management', 'https://workspace.google.com/marketplace/category/business-tools/administration-and-management', 'business-tools', 1, true, true),
  ('google_workspace', 'business-tools--erp-and-logistics', 'ERP and Logistics', 'https://workspace.google.com/marketplace/category/business-tools/erp-and-logistics', 'business-tools', 1, true, true),
  ('google_workspace', 'business-tools--hr-and-legal', 'HR and Legal', 'https://workspace.google.com/marketplace/category/business-tools/hr-and-legal', 'business-tools', 1, true, true),
  ('google_workspace', 'business-tools--marketing-and-analytics', 'Marketing and Analytics', 'https://workspace.google.com/marketplace/category/business-tools/marketing-and-analytics', 'business-tools', 1, true, true),
  ('google_workspace', 'business-tools--sales-and-crm', 'Sales and CRM', 'https://workspace.google.com/marketplace/category/business-tools/sales-and-crm', 'business-tools', 1, true, true),

  -- Productivity children (level 1)
  ('google_workspace', 'productivity--creative-tools', 'Creative Tools', 'https://workspace.google.com/marketplace/category/productivity/creative-tools', 'productivity', 1, true, true),
  ('google_workspace', 'productivity--office-applications', 'Office Applications', 'https://workspace.google.com/marketplace/category/productivity/office-applications', 'productivity', 1, true, true),
  ('google_workspace', 'productivity--task-management', 'Task Management', 'https://workspace.google.com/marketplace/category/productivity/task-management', 'productivity', 1, true, true),
  ('google_workspace', 'productivity--web-development', 'Web Development', 'https://workspace.google.com/marketplace/category/productivity/web-development', 'productivity', 1, true, true),

  -- Education children (level 1)
  ('google_workspace', 'education--academic-resources', 'Academic Resources', 'https://workspace.google.com/marketplace/category/education/academic-resources', 'education', 1, true, true),
  ('google_workspace', 'education--teacher-and-admin-tools', 'Teacher and Admin Tools', 'https://workspace.google.com/marketplace/category/education/teacher-and-admin-tools', 'education', 1, true, true)

ON CONFLICT (platform, slug) DO UPDATE SET title = EXCLUDED.title, url = EXCLUDED.url, parent_slug = EXCLUDED.parent_slug, category_level = EXCLUDED.category_level;
