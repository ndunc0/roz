-- Change coverage_top constraint to accept lowercase values

-- Drop the existing constraint
ALTER TABLE "public"."company_weekly_card"
    DROP CONSTRAINT "company_weekly_card_coverage_top_check";

-- Add new constraint with lowercase values
ALTER TABLE "public"."company_weekly_card"
    ADD CONSTRAINT "company_weekly_card_coverage_top_check"
    CHECK (("coverage_top" = ANY (ARRAY['high'::"text", 'medium'::"text", 'low'::"text"])));
