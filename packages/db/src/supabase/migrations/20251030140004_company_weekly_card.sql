-- Company weekly card table: stores weekly summary cards for companies

CREATE TABLE IF NOT EXISTS "public"."company_weekly_card" (
    "company_id" "text" NOT NULL,
    "week_id" "text" NOT NULL,
    "card_id" "text" GENERATED ALWAYS AS ((("company_id" || '__'::"text") || "week_id")) STORED NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "headline" "text" NOT NULL,
    "bullets_json" "jsonb" NOT NULL,
    "significance_max" integer NOT NULL,
    "coverage_top" "text" NOT NULL,
    "source_context" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "company_weekly_card_bullets_json_check" CHECK (("jsonb_typeof"("bullets_json") = 'array'::"text")),
    CONSTRAINT "company_weekly_card_bullets_json_check1" CHECK ((("jsonb_array_length"("bullets_json") >= 1) AND ("jsonb_array_length"("bullets_json") <= 5))),
    CONSTRAINT "company_weekly_card_bullets_json_check2" CHECK ("public"."bullet_lengths_valid"("bullets_json")),
    CONSTRAINT "company_weekly_card_coverage_top_check" CHECK (("coverage_top" = ANY (ARRAY['High'::"text", 'Medium'::"text", 'Low'::"text"]))),
    CONSTRAINT "company_weekly_card_headline_check" CHECK (("char_length"("headline") <= 120)),
    CONSTRAINT "company_weekly_card_significance_max_check" CHECK ((("significance_max" >= 1) AND ("significance_max" <= 10))),
    CONSTRAINT "company_weekly_card_version_check" CHECK (("version" >= 1)),
    CONSTRAINT "company_weekly_card_week_id_check" CHECK (("week_id" ~ '^[0-9]{4}-W[0-9]{2}$'::"text"))
);

ALTER TABLE "public"."company_weekly_card" OWNER TO "postgres";

-- Constraints
ALTER TABLE ONLY "public"."company_weekly_card"
    ADD CONSTRAINT "company_weekly_card_company_id_week_id_key" UNIQUE ("company_id", "week_id");

ALTER TABLE ONLY "public"."company_weekly_card"
    ADD CONSTRAINT "company_weekly_card_pkey" PRIMARY KEY ("card_id");

-- Indexes
CREATE INDEX "company_weekly_card_company_idx" ON "public"."company_weekly_card" USING "btree" ("company_id");
CREATE INDEX "company_weekly_card_sig_idx" ON "public"."company_weekly_card" USING "btree" ("significance_max" DESC);
CREATE INDEX "company_weekly_card_week_idx" ON "public"."company_weekly_card" USING "btree" ("week_id");

-- Trigger for updated_at
CREATE OR REPLACE TRIGGER "trg_cwc_set_updated_at"
    BEFORE UPDATE ON "public"."company_weekly_card"
    FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

-- Foreign keys
ALTER TABLE ONLY "public"."company_weekly_card"
    ADD CONSTRAINT "company_weekly_card_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE CASCADE;

-- Grants
GRANT ALL ON TABLE "public"."company_weekly_card" TO "anon";
GRANT ALL ON TABLE "public"."company_weekly_card" TO "authenticated";
GRANT ALL ON TABLE "public"."company_weekly_card" TO "service_role";
