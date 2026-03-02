CREATE TABLE IF NOT EXISTS "impersonation_audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "admin_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "target_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "action" varchar(20) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_impersonation_audit_admin" ON "impersonation_audit_logs" ("admin_user_id");
CREATE INDEX IF NOT EXISTS "idx_impersonation_audit_target" ON "impersonation_audit_logs" ("target_user_id");
