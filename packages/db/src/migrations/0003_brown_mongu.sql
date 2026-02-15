ALTER TABLE "tracked_keywords" ADD COLUMN "slug" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "tracked_keywords" ADD CONSTRAINT "tracked_keywords_slug_unique" UNIQUE("slug");