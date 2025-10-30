-- User digest tables: stores weekly digests for users and their associated cards

-- Main user digest table
CREATE TABLE IF NOT EXISTS "public"."user_digest" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "week_id" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "preheader" "text",
    "summary_paragraph" "text",
    "html" "text",
    "text_fallback" "text",
    "top_highlights_json" "jsonb",
    "company_order" "text"[],
    "template_version" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sent_at" timestamp with time zone,
    CONSTRAINT "user_digest_week_id_check" CHECK (("week_id" ~ '^[0-9]{4}-W[0-9]{2}$'::"text"))
);

ALTER TABLE "public"."user_digest" OWNER TO "postgres";

-- ID sequence
ALTER TABLE "public"."user_digest" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."user_digest_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

-- Junction table for digest cards
CREATE TABLE IF NOT EXISTS "public"."user_digest_card" (
    "digest_id" bigint NOT NULL,
    "card_id" "text" NOT NULL,
    "position" integer NOT NULL,
    CONSTRAINT "user_digest_card_position_check" CHECK (("position" >= 1))
);

ALTER TABLE "public"."user_digest_card" OWNER TO "postgres";

-- Constraints for user_digest
ALTER TABLE ONLY "public"."user_digest"
    ADD CONSTRAINT "user_digest_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."user_digest"
    ADD CONSTRAINT "user_digest_user_id_week_id_key" UNIQUE ("user_id", "week_id");

-- Constraints for user_digest_card
ALTER TABLE ONLY "public"."user_digest_card"
    ADD CONSTRAINT "user_digest_card_digest_id_position_key" UNIQUE ("digest_id", "position");

ALTER TABLE ONLY "public"."user_digest_card"
    ADD CONSTRAINT "user_digest_card_pkey" PRIMARY KEY ("digest_id", "card_id");

-- Indexes
CREATE INDEX "user_digest_user_week_idx" ON "public"."user_digest" USING "btree" ("user_id", "week_id");
CREATE INDEX "user_digest_card_card_idx" ON "public"."user_digest_card" USING "btree" ("card_id");

-- Foreign keys
ALTER TABLE ONLY "public"."user_digest"
    ADD CONSTRAINT "user_digest_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."user_digest_card"
    ADD CONSTRAINT "user_digest_card_card_id_fkey"
    FOREIGN KEY ("card_id") REFERENCES "public"."company_weekly_card"("card_id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."user_digest_card"
    ADD CONSTRAINT "user_digest_card_digest_id_fkey"
    FOREIGN KEY ("digest_id") REFERENCES "public"."user_digest"("id") ON DELETE CASCADE;

-- Row Level Security policies for user_digest
ALTER TABLE "public"."user_digest" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ud_select_own" ON "public"."user_digest"
    FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "ud_modify_own" ON "public"."user_digest"
    USING (("auth"."uid"() = "user_id"))
    WITH CHECK (("auth"."uid"() = "user_id"));

-- Row Level Security policies for user_digest_card
ALTER TABLE "public"."user_digest_card" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "udc_select_own" ON "public"."user_digest_card"
    FOR SELECT USING ((EXISTS (
        SELECT 1
        FROM "public"."user_digest" "d"
        WHERE (("d"."id" = "user_digest_card"."digest_id") AND ("d"."user_id" = "auth"."uid"()))
    )));

CREATE POLICY "udc_modify_own" ON "public"."user_digest_card"
    USING ((EXISTS (
        SELECT 1
        FROM "public"."user_digest" "d"
        WHERE (("d"."id" = "user_digest_card"."digest_id") AND ("d"."user_id" = "auth"."uid"()))
    )))
    WITH CHECK ((EXISTS (
        SELECT 1
        FROM "public"."user_digest" "d"
        WHERE (("d"."id" = "user_digest_card"."digest_id") AND ("d"."user_id" = "auth"."uid"()))
    )));

-- Grants
GRANT ALL ON TABLE "public"."user_digest" TO "anon";
GRANT ALL ON TABLE "public"."user_digest" TO "authenticated";
GRANT ALL ON TABLE "public"."user_digest" TO "service_role";

GRANT ALL ON TABLE "public"."user_digest_card" TO "anon";
GRANT ALL ON TABLE "public"."user_digest_card" TO "authenticated";
GRANT ALL ON TABLE "public"."user_digest_card" TO "service_role";

GRANT ALL ON SEQUENCE "public"."user_digest_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_digest_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_digest_id_seq" TO "service_role";
