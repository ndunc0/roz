-- User follow company table: tracks which companies users are following

CREATE TABLE IF NOT EXISTS "public"."user_follow_company" (
    "user_id" "uuid" NOT NULL,
    "company_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."user_follow_company" OWNER TO "postgres";

-- Constraints
ALTER TABLE ONLY "public"."user_follow_company"
    ADD CONSTRAINT "user_follow_company_pkey" PRIMARY KEY ("user_id", "company_id");

-- Indexes
CREATE INDEX "user_follow_company_company_idx" ON "public"."user_follow_company" USING "btree" ("company_id");

-- Foreign keys
ALTER TABLE ONLY "public"."user_follow_company"
    ADD CONSTRAINT "user_follow_company_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."user_follow_company"
    ADD CONSTRAINT "user_follow_company_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

-- Row Level Security
ALTER TABLE "public"."user_follow_company" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ufc_select_own" ON "public"."user_follow_company"
    FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "ufc_modify_own" ON "public"."user_follow_company"
    USING (("auth"."uid"() = "user_id"))
    WITH CHECK (("auth"."uid"() = "user_id"));

-- Grants
GRANT ALL ON TABLE "public"."user_follow_company" TO "anon";
GRANT ALL ON TABLE "public"."user_follow_company" TO "authenticated";
GRANT ALL ON TABLE "public"."user_follow_company" TO "service_role";
