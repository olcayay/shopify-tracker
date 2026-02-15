CREATE TYPE "public"."scrape_run_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."scraper_type" AS ENUM('category', 'app_details', 'keyword_search', 'reviews');--> statement-breakpoint
CREATE TABLE "app_category_rankings" (
	"id" serial PRIMARY KEY NOT NULL,
	"app_slug" varchar(255) NOT NULL,
	"category_slug" varchar(255) NOT NULL,
	"scrape_run_id" uuid NOT NULL,
	"scraped_at" timestamp DEFAULT now() NOT NULL,
	"position" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"app_slug" varchar(255) NOT NULL,
	"scrape_run_id" uuid NOT NULL,
	"scraped_at" timestamp DEFAULT now() NOT NULL,
	"title" varchar(500) DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"pricing" varchar(500) DEFAULT '' NOT NULL,
	"average_rating" numeric(3, 2),
	"rating_count" integer,
	"developer" jsonb,
	"demo_store_url" varchar(500),
	"languages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"works_with" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pricing_tiers" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apps" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(255) NOT NULL,
	"name" varchar(500) NOT NULL,
	"is_tracked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "apps_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(255) NOT NULL,
	"title" varchar(500) NOT NULL,
	"url" varchar(500) NOT NULL,
	"parent_slug" varchar(255),
	"category_level" smallint NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"is_tracked" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "category_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_slug" varchar(255) NOT NULL,
	"scrape_run_id" uuid NOT NULL,
	"scraped_at" timestamp DEFAULT now() NOT NULL,
	"data_source_url" varchar(500) NOT NULL,
	"app_count" integer,
	"first_page_metrics" jsonb,
	"first_page_apps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"breadcrumb" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_keyword_rankings" (
	"id" serial PRIMARY KEY NOT NULL,
	"app_slug" varchar(255) NOT NULL,
	"keyword_id" integer NOT NULL,
	"scrape_run_id" uuid NOT NULL,
	"scraped_at" timestamp DEFAULT now() NOT NULL,
	"position" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "keyword_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"keyword_id" integer NOT NULL,
	"scrape_run_id" uuid NOT NULL,
	"scraped_at" timestamp DEFAULT now() NOT NULL,
	"total_results" integer,
	"results" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracked_keywords" (
	"id" serial PRIMARY KEY NOT NULL,
	"keyword" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tracked_keywords_keyword_unique" UNIQUE("keyword")
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"app_slug" varchar(255) NOT NULL,
	"review_date" date NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"reviewer_name" varchar(500) NOT NULL,
	"reviewer_country" varchar(255),
	"duration_using_app" varchar(255),
	"rating" smallint NOT NULL,
	"developer_reply_date" date,
	"developer_reply_text" text,
	"first_seen_run_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scrape_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scraper_type" "scraper_type" NOT NULL,
	"status" "scrape_run_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"metadata" jsonb,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "app_category_rankings" ADD CONSTRAINT "app_category_rankings_app_slug_apps_slug_fk" FOREIGN KEY ("app_slug") REFERENCES "public"."apps"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_category_rankings" ADD CONSTRAINT "app_category_rankings_scrape_run_id_scrape_runs_id_fk" FOREIGN KEY ("scrape_run_id") REFERENCES "public"."scrape_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_snapshots" ADD CONSTRAINT "app_snapshots_app_slug_apps_slug_fk" FOREIGN KEY ("app_slug") REFERENCES "public"."apps"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_snapshots" ADD CONSTRAINT "app_snapshots_scrape_run_id_scrape_runs_id_fk" FOREIGN KEY ("scrape_run_id") REFERENCES "public"."scrape_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_snapshots" ADD CONSTRAINT "category_snapshots_category_slug_categories_slug_fk" FOREIGN KEY ("category_slug") REFERENCES "public"."categories"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_snapshots" ADD CONSTRAINT "category_snapshots_scrape_run_id_scrape_runs_id_fk" FOREIGN KEY ("scrape_run_id") REFERENCES "public"."scrape_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_keyword_rankings" ADD CONSTRAINT "app_keyword_rankings_app_slug_apps_slug_fk" FOREIGN KEY ("app_slug") REFERENCES "public"."apps"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_keyword_rankings" ADD CONSTRAINT "app_keyword_rankings_keyword_id_tracked_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."tracked_keywords"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_keyword_rankings" ADD CONSTRAINT "app_keyword_rankings_scrape_run_id_scrape_runs_id_fk" FOREIGN KEY ("scrape_run_id") REFERENCES "public"."scrape_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keyword_snapshots" ADD CONSTRAINT "keyword_snapshots_keyword_id_tracked_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."tracked_keywords"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keyword_snapshots" ADD CONSTRAINT "keyword_snapshots_scrape_run_id_scrape_runs_id_fk" FOREIGN KEY ("scrape_run_id") REFERENCES "public"."scrape_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_app_slug_apps_slug_fk" FOREIGN KEY ("app_slug") REFERENCES "public"."apps"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_first_seen_run_id_scrape_runs_id_fk" FOREIGN KEY ("first_seen_run_id") REFERENCES "public"."scrape_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_app_cat_rank" ON "app_category_rankings" USING btree ("app_slug","category_slug","scraped_at");--> statement-breakpoint
CREATE INDEX "idx_app_snapshots_slug_date" ON "app_snapshots" USING btree ("app_slug","scraped_at");--> statement-breakpoint
CREATE INDEX "idx_category_snapshots_slug_date" ON "category_snapshots" USING btree ("category_slug","scraped_at");--> statement-breakpoint
CREATE INDEX "idx_app_kw_rank" ON "app_keyword_rankings" USING btree ("app_slug","keyword_id","scraped_at");--> statement-breakpoint
CREATE INDEX "idx_keyword_snapshots_kw_date" ON "keyword_snapshots" USING btree ("keyword_id","scraped_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_reviews_dedup" ON "reviews" USING btree ("app_slug","reviewer_name","review_date","rating");