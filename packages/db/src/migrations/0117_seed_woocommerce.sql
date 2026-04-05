-- Seed: all existing accounts get WooCommerce Marketplace access
INSERT INTO account_platforms (account_id, platform)
SELECT id, 'woocommerce' FROM accounts
ON CONFLICT (account_id, platform) DO NOTHING;

-- Seed platform_visibility for WooCommerce (hidden by default until tested)
INSERT INTO platform_visibility (platform, is_visible)
VALUES ('woocommerce', false)
ON CONFLICT (platform) DO UPDATE SET is_visible = false;

-- Seed WooCommerce Marketplace categories (flat: 8 real categories)
INSERT INTO categories (platform, slug, title, url, category_level, parent_slug)
VALUES
  ('woocommerce', 'payment-gateways', 'Payment Gateways', 'https://woocommerce.com/product-category/woocommerce-extensions/?category=payment-gateways', 0, NULL),
  ('woocommerce', 'shipping-delivery-and-fulfillment', 'Shipping, Delivery, and Fulfillment', 'https://woocommerce.com/product-category/woocommerce-extensions/?category=shipping-delivery-and-fulfillment', 0, NULL),
  ('woocommerce', 'conversion', 'Conversion', 'https://woocommerce.com/product-category/woocommerce-extensions/?category=conversion', 0, NULL),
  ('woocommerce', 'merchandising', 'Merchandising', 'https://woocommerce.com/product-category/woocommerce-extensions/?category=merchandising', 0, NULL),
  ('woocommerce', 'store-content-and-customizations', 'Store Content and Customizations', 'https://woocommerce.com/product-category/woocommerce-extensions/?category=store-content-and-customizations', 0, NULL),
  ('woocommerce', 'operations', 'Store Management', 'https://woocommerce.com/product-category/woocommerce-extensions/?category=operations', 0, NULL),
  ('woocommerce', 'marketing-extensions', 'Marketing', 'https://woocommerce.com/product-category/woocommerce-extensions/?category=marketing-extensions', 0, NULL),
  ('woocommerce', 'free-extensions', 'Free Extensions', 'https://woocommerce.com/product-category/woocommerce-extensions/?category=free-extensions', 0, NULL)
ON CONFLICT (platform, slug) DO UPDATE SET
  title = EXCLUDED.title,
  url = EXCLUDED.url,
  category_level = EXCLUDED.category_level,
  parent_slug = EXCLUDED.parent_slug;
