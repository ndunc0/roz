-- Increase bullet character limit from 160 to 165 to account for character counting variations between LLMs
-- The card writer will still be instructed to aim for 160, but this gives a 5-character buffer

CREATE OR REPLACE FUNCTION "public"."bullet_lengths_valid"("bullets" "jsonb") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select coalesce(bool_and(char_length(elem) <= 165), true)
  from jsonb_array_elements_text(bullets) as t(elem);
$$;
