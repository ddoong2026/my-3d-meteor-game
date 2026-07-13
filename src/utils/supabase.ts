import { createClient } from '@supabase/supabase-js'

// TODO: Replace with real Supabase project URL and ANON KEY
// You can get these from your Supabase dashboard: Settings > API
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder_anon_key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
