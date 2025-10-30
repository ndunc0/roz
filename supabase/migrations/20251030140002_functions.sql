-- Shared utility functions

-- Function to validate bullet point lengths (max 160 characters each)
CREATE OR REPLACE FUNCTION "public"."bullet_lengths_valid"("bullets" "jsonb") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select coalesce(bool_and(char_length(elem) <= 160), true)
  from jsonb_array_elements_text(bullets) as t(elem);
$$;

ALTER FUNCTION "public"."bullet_lengths_valid"("bullets" "jsonb") OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."bullet_lengths_valid"("bullets" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."bullet_lengths_valid"("bullets" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bullet_lengths_valid"("bullets" "jsonb") TO "service_role";


-- Trigger function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";
