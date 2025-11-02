import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types/database.types.js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing required environment variables: SUPABASE_URL and SUPABASE_ANON_KEY must be set"
  );
}

/**
 * Supabase client for database operations
 * Configured with environment variables:
 * - SUPABASE_URL: Supabase project URL (e.g., http://localhost:54321 for local dev)
 * - SUPABASE_ANON_KEY: Supabase anonymous key
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
