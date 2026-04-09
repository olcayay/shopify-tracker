export const NOTIFICATION_CATEGORIES = {
  ranking: "ranking",
  competitor: "competitor",
  review: "review",
  keyword: "keyword",
  featured: "featured",
  system: "system",
  account: "account",
  support: "support",
} as const;

export type NotificationCategory = typeof NOTIFICATION_CATEGORIES[keyof typeof NOTIFICATION_CATEGORIES];

export const NOTIFICATION_TYPES = {
  // Ranking
  ranking_top3_entry: { category: "ranking", label: "Entered Top 3" },
  ranking_top3_exit: { category: "ranking", label: "Left Top 3" },
  ranking_significant_change: { category: "ranking", label: "Significant Ranking Change" },
  ranking_new_entry: { category: "ranking", label: "New Category Entry" },
  ranking_dropped_out: { category: "ranking", label: "Dropped Out of Category" },
  ranking_category_change: { category: "ranking", label: "Category Rank Change" },
  // Competitor
  competitor_overtook: { category: "competitor", label: "Competitor Overtook You" },
  competitor_featured: { category: "competitor", label: "Competitor Got Featured" },
  competitor_review_surge: { category: "competitor", label: "Competitor Review Surge" },
  competitor_pricing_change: { category: "competitor", label: "Competitor Pricing Change" },
  // Review
  review_new_positive: { category: "review", label: "New Positive Review" },
  review_new_negative: { category: "review", label: "New Negative Review" },
  review_velocity_spike: { category: "review", label: "Review Velocity Spike" },
  // Keyword
  keyword_position_gained: { category: "keyword", label: "Keyword Position Gained" },
  keyword_position_lost: { category: "keyword", label: "Keyword Position Lost" },
  keyword_new_ranking: { category: "keyword", label: "New Keyword Ranking" },
  // Featured
  featured_new_placement: { category: "featured", label: "New Featured Placement" },
  featured_removed: { category: "featured", label: "Featured Placement Removed" },
  // System
  system_scrape_complete: { category: "system", label: "Scrape Complete" },
  system_scrape_failed: { category: "system", label: "Scrape Failed" },
  // Account
  account_member_joined: { category: "account", label: "New Team Member" },
  account_limit_warning: { category: "account", label: "Approaching Limit" },
  account_limit_reached: { category: "account", label: "Limit Reached" },
  // Support
  support_ticket_reply: { category: "support", label: "Support Reply" },
  support_ticket_resolved: { category: "support", label: "Ticket Resolved" },
  support_ticket_closed: { category: "support", label: "Ticket Closed" },
} as const;

export type NotificationType = keyof typeof NOTIFICATION_TYPES;

export const NOTIFICATION_TYPE_IDS = Object.keys(NOTIFICATION_TYPES) as NotificationType[];
