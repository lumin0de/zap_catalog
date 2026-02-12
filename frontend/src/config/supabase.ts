import { createClient } from "@supabase/supabase-js"

// Runtime (Easypanel) ou build-time (Vite)
const supabaseUrl =
  (typeof window !== "undefined" && (window as Window & { __ENV__?: { VITE_SUPABASE_URL?: string } }).__ENV__?.VITE_SUPABASE_URL) ||
  import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey =
  (typeof window !== "undefined" && (window as Window & { __ENV__?: { VITE_SUPABASE_ANON_KEY?: string } }).__ENV__?.VITE_SUPABASE_ANON_KEY) ||
  import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY). Configure them in Easypanel Environment and redeploy.")
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
