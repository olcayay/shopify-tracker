-- Seed: WordPress Plugin Directory tag categories + browse sections
-- Tags come from hot_tags API; browse sections are curated lists.
-- All flat (no hierarchy), category_level = 0, is_tracked = true.

INSERT INTO categories (platform, slug, title, url, parent_slug, category_level, is_tracked, is_listing_page) VALUES
  -- Original 12 popular tags
  ('wordpress', 'contact-form', 'Contact Form', 'https://wordpress.org/plugins/tags/contact-form/', NULL, 0, true, true),
  ('wordpress', 'woocommerce', 'WooCommerce', 'https://wordpress.org/plugins/tags/woocommerce/', NULL, 0, true, true),
  ('wordpress', 'seo', 'SEO', 'https://wordpress.org/plugins/tags/seo/', NULL, 0, true, true),
  ('wordpress', 'ecommerce', 'eCommerce', 'https://wordpress.org/plugins/tags/ecommerce/', NULL, 0, true, true),
  ('wordpress', 'social', 'Social', 'https://wordpress.org/plugins/tags/social/', NULL, 0, true, true),
  ('wordpress', 'security', 'Security', 'https://wordpress.org/plugins/tags/security/', NULL, 0, true, true),
  ('wordpress', 'email', 'Email', 'https://wordpress.org/plugins/tags/email/', NULL, 0, true, true),
  ('wordpress', 'gallery', 'Gallery', 'https://wordpress.org/plugins/tags/gallery/', NULL, 0, true, true),
  ('wordpress', 'analytics', 'Analytics', 'https://wordpress.org/plugins/tags/analytics/', NULL, 0, true, true),
  ('wordpress', 'admin', 'Admin', 'https://wordpress.org/plugins/tags/admin/', NULL, 0, true, true),
  ('wordpress', 'widget', 'Widget', 'https://wordpress.org/plugins/tags/widget/', NULL, 0, true, true),
  ('wordpress', 'page-builder', 'Page Builder', 'https://wordpress.org/plugins/tags/page-builder/', NULL, 0, true, true),
  -- Additional tags from hot_tags API
  ('wordpress', 'post', 'Post', 'https://wordpress.org/plugins/tags/post/', NULL, 0, true, true),
  ('wordpress', 'gutenberg', 'Gutenberg', 'https://wordpress.org/plugins/tags/gutenberg/', NULL, 0, true, true),
  ('wordpress', 'block', 'Block', 'https://wordpress.org/plugins/tags/block/', NULL, 0, true, true),
  ('wordpress', 'payment', 'Payment', 'https://wordpress.org/plugins/tags/payment/', NULL, 0, true, true),
  ('wordpress', 'elementor', 'Elementor', 'https://wordpress.org/plugins/tags/elementor/', NULL, 0, true, true),
  ('wordpress', 'ai', 'AI', 'https://wordpress.org/plugins/tags/ai/', NULL, 0, true, true),
  ('wordpress', 'payment-gateway', 'Payment Gateway', 'https://wordpress.org/plugins/tags/payment-gateway/', NULL, 0, true, true),
  ('wordpress', 'slider', 'Slider', 'https://wordpress.org/plugins/tags/slider/', NULL, 0, true, true),
  ('wordpress', 'spam', 'Spam', 'https://wordpress.org/plugins/tags/spam/', NULL, 0, true, true),
  ('wordpress', 'form', 'Form', 'https://wordpress.org/plugins/tags/form/', NULL, 0, true, true),
  ('wordpress', 'search', 'Search', 'https://wordpress.org/plugins/tags/search/', NULL, 0, true, true),
  ('wordpress', 'editor', 'Editor', 'https://wordpress.org/plugins/tags/editor/', NULL, 0, true, true),
  ('wordpress', 'performance', 'Performance', 'https://wordpress.org/plugins/tags/performance/', NULL, 0, true, true),
  ('wordpress', 'menu', 'Menu', 'https://wordpress.org/plugins/tags/menu/', NULL, 0, true, true),
  ('wordpress', 'embed', 'Embed', 'https://wordpress.org/plugins/tags/embed/', NULL, 0, true, true),
  ('wordpress', 'chat', 'Chat', 'https://wordpress.org/plugins/tags/chat/', NULL, 0, true, true),
  ('wordpress', 'shipping', 'Shipping', 'https://wordpress.org/plugins/tags/shipping/', NULL, 0, true, true),
  ('wordpress', 'marketing', 'Marketing', 'https://wordpress.org/plugins/tags/marketing/', NULL, 0, true, true),
  ('wordpress', 'popup', 'Popup', 'https://wordpress.org/plugins/tags/popup/', NULL, 0, true, true),
  ('wordpress', 'events', 'Events', 'https://wordpress.org/plugins/tags/events/', NULL, 0, true, true),
  ('wordpress', 'calendar', 'Calendar', 'https://wordpress.org/plugins/tags/calendar/', NULL, 0, true, true),
  ('wordpress', 'newsletter', 'Newsletter', 'https://wordpress.org/plugins/tags/newsletter/', NULL, 0, true, true),
  ('wordpress', 'redirect', 'Redirect', 'https://wordpress.org/plugins/tags/redirect/', NULL, 0, true, true),
  ('wordpress', 'cache', 'Cache', 'https://wordpress.org/plugins/tags/cache/', NULL, 0, true, true),
  ('wordpress', 'products', 'Products', 'https://wordpress.org/plugins/tags/products/', NULL, 0, true, true),
  ('wordpress', 'automation', 'Automation', 'https://wordpress.org/plugins/tags/automation/', NULL, 0, true, true),
  ('wordpress', 'login', 'Login', 'https://wordpress.org/plugins/tags/login/', NULL, 0, true, true),
  ('wordpress', 'video', 'Video', 'https://wordpress.org/plugins/tags/video/', NULL, 0, true, true),
  -- Browse sections (curated lists)
  ('wordpress', '_browse_popular', 'Popular', 'https://wordpress.org/plugins/browse/popular/', NULL, 0, true, true),
  ('wordpress', '_browse_featured', 'Featured', 'https://wordpress.org/plugins/browse/featured/', NULL, 0, true, true),
  ('wordpress', '_browse_blocks', 'Block Plugins', 'https://wordpress.org/plugins/browse/blocks/', NULL, 0, true, true)
ON CONFLICT (platform, slug) DO UPDATE SET title = EXCLUDED.title, url = EXCLUDED.url, parent_slug = EXCLUDED.parent_slug, category_level = EXCLUDED.category_level;
