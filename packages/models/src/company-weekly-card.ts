import { supabase } from "@roz/supabase";
import type { Tables, TablesInsert } from "@roz/supabase/types";

/**
 * Company weekly card model type (database row)
 */
export type CompanyWeeklyCard = Tables<"company_weekly_card">;

/**
 * Company weekly card insert type
 *
 * NOTE: Excludes `card_id` because it's a GENERATED ALWAYS column in the database.
 * The database automatically generates card_id as: company_id || '__' || week_id
 */
export type CompanyWeeklyCardInsert = Omit<
  TablesInsert<"company_weekly_card">,
  "card_id"
>;

/**
 * Create a new company weekly card
 */
export async function createCompanyWeeklyCard(card: CompanyWeeklyCardInsert) {
  const { data, error } = await supabase
    .from("company_weekly_card")
    .insert(card)
    .select()
    .single();

  if (error) throw error;
  return data;
}
