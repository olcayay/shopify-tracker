-- Seed Zendesk Marketplace categories (16 flat categories)
INSERT INTO categories (platform, slug, title, url, category_level, parent_slug)
VALUES
  ('zendesk', 'ai-and-bots', 'AI and Bots', 'https://www.zendesk.com/marketplace/apps/?category=ai-and-bots', 0, NULL),
  ('zendesk', 'agent-productivity', 'Agent Productivity', 'https://www.zendesk.com/marketplace/apps/?category=agent-productivity', 0, NULL),
  ('zendesk', 'contact-center', 'Contact Center', 'https://www.zendesk.com/marketplace/apps/?category=contact-center', 0, NULL),
  ('zendesk', 'crm-and-marketing', 'CRM and Marketing', 'https://www.zendesk.com/marketplace/apps/?category=crm-and-marketing', 0, NULL),
  ('zendesk', 'ecommerce-and-payments', 'E-Commerce and Payments', 'https://www.zendesk.com/marketplace/apps/?category=ecommerce-and-payments', 0, NULL),
  ('zendesk', 'it-and-hr', 'IT and HR', 'https://www.zendesk.com/marketplace/apps/?category=it-and-hr', 0, NULL),
  ('zendesk', 'knowledge-and-content-management', 'Knowledge and Content Management', 'https://www.zendesk.com/marketplace/apps/?category=knowledge-and-content-management', 0, NULL),
  ('zendesk', 'messaging', 'Messaging', 'https://www.zendesk.com/marketplace/apps/?category=messaging', 0, NULL),
  ('zendesk', 'product-and-project-management', 'Product and Project Management', 'https://www.zendesk.com/marketplace/apps/?category=product-and-project-management', 0, NULL),
  ('zendesk', 'reporting-and-analytics', 'Reporting and Analytics', 'https://www.zendesk.com/marketplace/apps/?category=reporting-and-analytics', 0, NULL),
  ('zendesk', 'security-risk-and-compliance', 'Security, Risk and Compliance', 'https://www.zendesk.com/marketplace/apps/?category=security-risk-and-compliance', 0, NULL),
  ('zendesk', 'surveys-and-reviews', 'Surveys and Reviews', 'https://www.zendesk.com/marketplace/apps/?category=surveys-and-reviews', 0, NULL),
  ('zendesk', 'translations', 'Translations', 'https://www.zendesk.com/marketplace/apps/?category=translations', 0, NULL),
  ('zendesk', 'video', 'Video', 'https://www.zendesk.com/marketplace/apps/?category=video', 0, NULL),
  ('zendesk', 'wem', 'Workforce Engagement Management', 'https://www.zendesk.com/marketplace/apps/?category=wem', 0, NULL),
  ('zendesk', 'workflows', 'Workflows', 'https://www.zendesk.com/marketplace/apps/?category=workflows', 0, NULL)
ON CONFLICT (platform, slug) DO UPDATE SET
  title = EXCLUDED.title,
  url = EXCLUDED.url,
  category_level = EXCLUDED.category_level,
  parent_slug = EXCLUDED.parent_slug;

-- Remove the non-existent 'collaboration' category if it was previously seeded
DELETE FROM categories WHERE platform = 'zendesk' AND slug = 'collaboration';
