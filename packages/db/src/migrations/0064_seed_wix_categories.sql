-- Seed: Wix App Market full category tree (6 L1 + 56 L2 = 62 categories)
-- Extracted from https://www.wix.com/app-market/ sidebar navigation

-- L1: Marketing (9 subcategories)
INSERT INTO categories (platform, slug, title, url, parent_slug, category_level, is_tracked, is_listing_page)
VALUES ('wix', 'marketing', 'Marketing', 'https://www.wix.com/app-market/category/marketing', NULL, 0, true, true)
ON CONFLICT (platform, slug) DO UPDATE SET title = EXCLUDED.title, url = EXCLUDED.url, parent_slug = EXCLUDED.parent_slug, category_level = EXCLUDED.category_level;

INSERT INTO categories (platform, slug, title, url, parent_slug, category_level, is_tracked, is_listing_page) VALUES
  ('wix', 'marketing--ads', 'Ads', 'https://www.wix.com/app-market/category/marketing/ads', 'marketing', 1, true, true),
  ('wix', 'marketing--mobile', 'Mobile', 'https://www.wix.com/app-market/category/marketing/mobile', 'marketing', 1, true, true),
  ('wix', 'marketing--analytics', 'Analytics', 'https://www.wix.com/app-market/category/marketing/analytics', 'marketing', 1, true, true),
  ('wix', 'marketing--social', 'Social', 'https://www.wix.com/app-market/category/marketing/social', 'marketing', 1, true, true),
  ('wix', 'marketing--seo', 'SEO', 'https://www.wix.com/app-market/category/marketing/seo', 'marketing', 1, true, true),
  ('wix', 'marketing--engagement', 'Engagement', 'https://www.wix.com/app-market/category/marketing/engagement', 'marketing', 1, true, true),
  ('wix', 'marketing--site-listings', 'Site Listings', 'https://www.wix.com/app-market/category/marketing/site-listings', 'marketing', 1, true, true),
  ('wix', 'marketing--email', 'Email', 'https://www.wix.com/app-market/category/marketing/email', 'marketing', 1, true, true),
  ('wix', 'marketing--conversion', 'Conversion', 'https://www.wix.com/app-market/category/marketing/conversion', 'marketing', 1, true, true)
ON CONFLICT (platform, slug) DO UPDATE SET title = EXCLUDED.title, url = EXCLUDED.url, parent_slug = EXCLUDED.parent_slug, category_level = EXCLUDED.category_level;

-- L1: Sell Online (12 subcategories)
INSERT INTO categories (platform, slug, title, url, parent_slug, category_level, is_tracked, is_listing_page)
VALUES ('wix', 'ecommerce', 'Sell Online', 'https://www.wix.com/app-market/category/ecommerce', NULL, 0, true, true)
ON CONFLICT (platform, slug) DO UPDATE SET title = EXCLUDED.title, url = EXCLUDED.url, parent_slug = EXCLUDED.parent_slug, category_level = EXCLUDED.category_level;

INSERT INTO categories (platform, slug, title, url, parent_slug, category_level, is_tracked, is_listing_page) VALUES
  ('wix', 'ecommerce--stores', 'Apps for Stores', 'https://www.wix.com/app-market/category/ecommerce/stores', 'ecommerce', 1, true, true),
  ('wix', 'ecommerce--shipping--delivery', 'Shipping & Delivery', 'https://www.wix.com/app-market/category/ecommerce/shipping--delivery', 'ecommerce', 1, true, true),
  ('wix', 'ecommerce--sell-buttons', 'Sell Buttons', 'https://www.wix.com/app-market/category/ecommerce/sell-buttons', 'ecommerce', 1, true, true),
  ('wix', 'ecommerce--online-courses', 'Online Courses', 'https://www.wix.com/app-market/category/ecommerce/online-courses', 'ecommerce', 1, true, true),
  ('wix', 'ecommerce--print-on-demand', 'Print on Demand', 'https://www.wix.com/app-market/category/ecommerce/print-on-demand', 'ecommerce', 1, true, true),
  ('wix', 'ecommerce--accounting', 'Accounting', 'https://www.wix.com/app-market/category/ecommerce/accounting', 'ecommerce', 1, true, true),
  ('wix', 'ecommerce--coupons--loyalty', 'Coupons & Loyalty', 'https://www.wix.com/app-market/category/ecommerce/coupons--loyalty', 'ecommerce', 1, true, true),
  ('wix', 'ecommerce--warehousing-solutions', 'Warehousing Solutions', 'https://www.wix.com/app-market/category/ecommerce/warehousing-solutions', 'ecommerce', 1, true, true),
  ('wix', 'ecommerce--dropship', 'Dropshipping', 'https://www.wix.com/app-market/category/ecommerce/dropship', 'ecommerce', 1, true, true),
  ('wix', 'ecommerce--pricing--subscription', 'Pricing & Subscription', 'https://www.wix.com/app-market/category/ecommerce/pricing--subscription', 'ecommerce', 1, true, true),
  ('wix', 'ecommerce--crowdfunding', 'Crowdfunding', 'https://www.wix.com/app-market/category/ecommerce/crowdfunding', 'ecommerce', 1, true, true),
  ('wix', 'ecommerce--food-beverage', 'Food & Beverage', 'https://www.wix.com/app-market/category/ecommerce/food-beverage', 'ecommerce', 1, true, true)
ON CONFLICT (platform, slug) DO UPDATE SET title = EXCLUDED.title, url = EXCLUDED.url, parent_slug = EXCLUDED.parent_slug, category_level = EXCLUDED.category_level;

-- L1: Services & Events (5 subcategories)
INSERT INTO categories (platform, slug, title, url, parent_slug, category_level, is_tracked, is_listing_page)
VALUES ('wix', 'booking--events', 'Services & Events', 'https://www.wix.com/app-market/category/booking/events', NULL, 0, true, true)
ON CONFLICT (platform, slug) DO UPDATE SET title = EXCLUDED.title, url = EXCLUDED.url, parent_slug = EXCLUDED.parent_slug, category_level = EXCLUDED.category_level;

INSERT INTO categories (platform, slug, title, url, parent_slug, category_level, is_tracked, is_listing_page) VALUES
  ('wix', 'booking--events--hotels', 'Hotels', 'https://www.wix.com/app-market/category/booking/hotels', 'booking--events', 1, true, true),
  ('wix', 'booking--events--events', 'Events', 'https://www.wix.com/app-market/category/booking/events', 'booking--events', 1, true, true),
  ('wix', 'booking--events--restaurants', 'Restaurants', 'https://www.wix.com/app-market/category/booking/restaurants', 'booking--events', 1, true, true),
  ('wix', 'booking--events--real-estate', 'Real Estate', 'https://www.wix.com/app-market/category/booking/real-estate', 'booking--events', 1, true, true),
  ('wix', 'booking--events--bookings', 'Bookings', 'https://www.wix.com/app-market/category/booking/bookings', 'booking--events', 1, true, true)
ON CONFLICT (platform, slug) DO UPDATE SET title = EXCLUDED.title, url = EXCLUDED.url, parent_slug = EXCLUDED.parent_slug, category_level = EXCLUDED.category_level;

-- L1: Media & Content (10 subcategories)
INSERT INTO categories (platform, slug, title, url, parent_slug, category_level, is_tracked, is_listing_page)
VALUES ('wix', 'media--content', 'Media & Content', 'https://www.wix.com/app-market/category/media/content', NULL, 0, true, false)
ON CONFLICT (platform, slug) DO UPDATE SET title = EXCLUDED.title, url = EXCLUDED.url, parent_slug = EXCLUDED.parent_slug, category_level = EXCLUDED.category_level, is_listing_page = EXCLUDED.is_listing_page;

INSERT INTO categories (platform, slug, title, url, parent_slug, category_level, is_tracked, is_listing_page) VALUES
  ('wix', 'media--content--gallery', 'Gallery', 'https://www.wix.com/app-market/category/media/gallery', 'media--content', 1, true, true),
  ('wix', 'media--content--music', 'Music', 'https://www.wix.com/app-market/category/media/music', 'media--content', 1, true, true),
  ('wix', 'media--content--podcasts', 'Podcasts', 'https://www.wix.com/app-market/category/media/podcasts', 'media--content', 1, true, true),
  ('wix', 'media--content--photography', 'Photography', 'https://www.wix.com/app-market/category/media/photography', 'media--content', 1, true, true),
  ('wix', 'media--content--video', 'Video', 'https://www.wix.com/app-market/category/media/video', 'media--content', 1, true, true),
  ('wix', 'media--content--pdf', 'PDF', 'https://www.wix.com/app-market/category/media/pdf', 'media--content', 1, true, true),
  ('wix', 'media--content--file-sharing', 'File Sharing', 'https://www.wix.com/app-market/category/media/file-sharing', 'media--content', 1, true, true),
  ('wix', 'media--content--news', 'News', 'https://www.wix.com/app-market/category/media/news', 'media--content', 1, true, true),
  ('wix', 'media--content--content-services', 'Content Services', 'https://www.wix.com/app-market/category/media/content-services', 'media--content', 1, true, true),
  ('wix', 'media--content--text-effects', 'Text Effects', 'https://www.wix.com/app-market/category/media/text-effects', 'media--content', 1, true, true)
ON CONFLICT (platform, slug) DO UPDATE SET title = EXCLUDED.title, url = EXCLUDED.url, parent_slug = EXCLUDED.parent_slug, category_level = EXCLUDED.category_level;

-- L1: Design Elements (11 subcategories)
INSERT INTO categories (platform, slug, title, url, parent_slug, category_level, is_tracked, is_listing_page)
VALUES ('wix', 'design-elements', 'Design Elements', 'https://www.wix.com/app-market/category/design-elements', NULL, 0, true, true)
ON CONFLICT (platform, slug) DO UPDATE SET title = EXCLUDED.title, url = EXCLUDED.url, parent_slug = EXCLUDED.parent_slug, category_level = EXCLUDED.category_level;

INSERT INTO categories (platform, slug, title, url, parent_slug, category_level, is_tracked, is_listing_page) VALUES
  ('wix', 'design-elements--maps--navigation', 'Maps & Navigation', 'https://www.wix.com/app-market/category/design-elements/maps--navigation', 'design-elements', 1, true, true),
  ('wix', 'design-elements--privacy--security', 'Privacy & Security', 'https://www.wix.com/app-market/category/design-elements/privacy--security', 'design-elements', 1, true, true),
  ('wix', 'design-elements--clock', 'Clock', 'https://www.wix.com/app-market/category/design-elements/clock', 'design-elements', 1, true, true),
  ('wix', 'design-elements--page-templates', 'Page Templates', 'https://www.wix.com/app-market/category/design-elements/page-templates', 'design-elements', 1, true, true),
  ('wix', 'design-elements--image-effects', 'Image Effects', 'https://www.wix.com/app-market/category/design-elements/image-effects', 'design-elements', 1, true, true),
  ('wix', 'design-elements--buttons--menus', 'Buttons & Menus', 'https://www.wix.com/app-market/category/design-elements/buttons--menus', 'design-elements', 1, true, true),
  ('wix', 'design-elements--banners--badges', 'Banners & Badges', 'https://www.wix.com/app-market/category/design-elements/banners--badges', 'design-elements', 1, true, true),
  ('wix', 'design-elements--calculators', 'Calculators', 'https://www.wix.com/app-market/category/design-elements/calculators', 'design-elements', 1, true, true),
  ('wix', 'design-elements--search', 'Search', 'https://www.wix.com/app-market/category/design-elements/search', 'design-elements', 1, true, true),
  ('wix', 'design-elements--weather', 'Weather', 'https://www.wix.com/app-market/category/design-elements/weather', 'design-elements', 1, true, true),
  ('wix', 'design-elements--charts--tables', 'Charts & Tables', 'https://www.wix.com/app-market/category/design-elements/charts--tables', 'design-elements', 1, true, true)
ON CONFLICT (platform, slug) DO UPDATE SET title = EXCLUDED.title, url = EXCLUDED.url, parent_slug = EXCLUDED.parent_slug, category_level = EXCLUDED.category_level;

-- L1: Communication (9 subcategories)
INSERT INTO categories (platform, slug, title, url, parent_slug, category_level, is_tracked, is_listing_page)
VALUES ('wix', 'communication', 'Communication', 'https://www.wix.com/app-market/category/communication', NULL, 0, true, true)
ON CONFLICT (platform, slug) DO UPDATE SET title = EXCLUDED.title, url = EXCLUDED.url, parent_slug = EXCLUDED.parent_slug, category_level = EXCLUDED.category_level;

INSERT INTO categories (platform, slug, title, url, parent_slug, category_level, is_tracked, is_listing_page) VALUES
  ('wix', 'communication--forms', 'Forms', 'https://www.wix.com/app-market/category/communication/forms', 'communication', 1, true, true),
  ('wix', 'communication--blogs', 'Blog', 'https://www.wix.com/app-market/category/communication/blogs', 'communication', 1, true, true),
  ('wix', 'communication--polls', 'Polls', 'https://www.wix.com/app-market/category/communication/polls', 'communication', 1, true, true),
  ('wix', 'communication--chat', 'Chat', 'https://www.wix.com/app-market/category/communication/chat', 'communication', 1, true, true),
  ('wix', 'communication--comments', 'Comments', 'https://www.wix.com/app-market/category/communication/comments', 'communication', 1, true, true),
  ('wix', 'communication--phone', 'Phone', 'https://www.wix.com/app-market/category/communication/phone', 'communication', 1, true, true),
  ('wix', 'communication--community', 'Community', 'https://www.wix.com/app-market/category/communication/community', 'communication', 1, true, true),
  ('wix', 'communication--reviews--testimonials', 'Reviews & Testimonials', 'https://www.wix.com/app-market/category/communication/reviews--testimonials', 'communication', 1, true, true),
  ('wix', 'communication--crm', 'CRM', 'https://www.wix.com/app-market/category/communication/crm', 'communication', 1, true, true)
ON CONFLICT (platform, slug) DO UPDATE SET title = EXCLUDED.title, url = EXCLUDED.url, parent_slug = EXCLUDED.parent_slug, category_level = EXCLUDED.category_level;
