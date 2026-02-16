CREATE TABLE "account_tracked_features" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"feature_handle" varchar(255) NOT NULL,
	"feature_title" varchar(500) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "max_tracked_features" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "account_tracked_features" ADD CONSTRAINT "account_tracked_features_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_account_tracked_features_unique" ON "account_tracked_features" USING btree ("account_id","feature_handle");