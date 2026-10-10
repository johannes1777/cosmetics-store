import { createClient } from "@supabase/supabase-js";

// These two values are PUBLIC by design (they are in the browser for every visitor).
// The database rules in supabase/002_security.sql are what keep private data private.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && key);

// null when the two variables are missing, so the site can show a clear message
// instead of crashing.
export const supabase = isSupabaseConfigured ? createClient(url as string, key as string) : null;
