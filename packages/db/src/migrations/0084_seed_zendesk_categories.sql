-- Seed Zendesk Marketplace categories (16 flat categories)
-- URL format: ?categories.name={Display Name} (not ?category=)
INSERT INTO categories (platform, slug, title, url, category_level, parent_slug)
VALUES
  ('zendesk', 'ai-and-bots', 'AI and Bots', 'https://www.zendesk.com/marketplace/apps/?categories.name=AI+and+Bots', 0, NULL),
  ('zendesk', 'agent-productivity', 'Agent Productivity', 'https://www.zendesk.com/marketplace/apps/?categories.name=Agent+Productivity', 0, NULL),
  ('zendesk', 'contact-center', 'Contact Center', 'https://www.zendesk.com/marketplace/apps/?categories.name=Contact+Center', 0, NULL),
  ('zendesk', 'crm-and-marketing', 'CRM and Marketing', 'https://www.zendesk.com/marketplace/apps/?categories.name=CRM+and+Marketing', 0, NULL),
  ('zendesk', 'ecommerce-and-payments', 'eComm and Payments', 'https://www.zendesk.com/marketplace/apps/?categories.name=eComm+and+Payments', 0, NULL),
  ('zendesk', 'it-and-hr', 'IT and HR', 'https://www.zendesk.com/marketplace/apps/?categories.name=IT+and+HR', 0, NULL),
  ('zendesk', 'knowledge-and-content-management', 'Knowledge and Content Management', 'https://www.zendesk.com/marketplace/apps/?categories.name=Knowledge+and+Content+Management', 0, NULL),
  ('zendesk', 'messaging', 'Messaging', 'https://www.zendesk.com/marketplace/apps/?categories.name=Messaging', 0, NULL),
  ('zendesk', 'product-and-project-management', 'Product and Project Management', 'https://www.zendesk.com/marketplace/apps/?categories.name=Product+and+Project+Management', 0, NULL),
  ('zendesk', 'reporting-and-analytics', 'Reporting and Analytics', 'https://www.zendesk.com/marketplace/apps/?categories.name=Reporting+and+Analytics', 0, NULL),
  ('zendesk', 'security-risk-and-compliance', 'Security, Risk and Compliance', 'https://www.zendesk.com/marketplace/apps/?categories.name=Security,+Risk+and+Compliance', 0, NULL),
  ('zendesk', 'surveys-and-reviews', 'Surveys and Reviews', 'https://www.zendesk.com/marketplace/apps/?categories.name=Surveys+and+Reviews', 0, NULL),
  ('zendesk', 'translations', 'Translations', 'https://www.zendesk.com/marketplace/apps/?categories.name=Translations', 0, NULL),
  ('zendesk', 'video', 'Video', 'https://www.zendesk.com/marketplace/apps/?categories.name=Video', 0, NULL),
  ('zendesk', 'wem', 'WEM', 'https://www.zendesk.com/marketplace/apps/?categories.name=WEM', 0, NULL),
  ('zendesk', 'workflows', 'Workflows', 'https://www.zendesk.com/marketplace/apps/?categories.name=Workflows', 0, NULL)
ON CONFLICT (platform, slug) DO UPDATE SET
  title = EXCLUDED.title,
  url = EXCLUDED.url,
  category_level = EXCLUDED.category_level,
  parent_slug = EXCLUDED.parent_slug;

-- Remove the non-existent 'collaboration' category if it was previously seeded
DELETE FROM categories WHERE platform = 'zendesk' AND slug = 'collaboration';
