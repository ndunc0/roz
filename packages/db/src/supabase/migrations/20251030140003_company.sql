-- Company table: stores basic company information

CREATE TABLE IF NOT EXISTS "public"."company" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "website" "text" NOT NULL,
    "linkedin_url" "text",
    "blog_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."company" OWNER TO "postgres";

-- Primary key
ALTER TABLE ONLY "public"."company"
    ADD CONSTRAINT "company_pkey" PRIMARY KEY ("id");

-- Grants
GRANT ALL ON TABLE "public"."company" TO "anon";
GRANT ALL ON TABLE "public"."company" TO "authenticated";
GRANT ALL ON TABLE "public"."company" TO "service_role";
