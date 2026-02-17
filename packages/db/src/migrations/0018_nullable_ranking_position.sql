-- Allow NULL position in app_keyword_rankings to record when an app drops from results
ALTER TABLE "app_keyword_rankings" ALTER COLUMN "position" DROP NOT NULL;
