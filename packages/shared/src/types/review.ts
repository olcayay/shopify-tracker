/** A single review scraped from an app's review page */
export interface Review {
  review_date: string;
  content: string;
  reviewer_name: string;
  reviewer_country: string;
  duration_using_app: string;
  rating: number;
  developer_reply_date: string | null;
  developer_reply_text: string | null;
}

/** Parsed data from a single reviews page */
export interface ReviewPageData {
  reviews: Review[];
  has_next_page: boolean;
  current_page: number;
}
