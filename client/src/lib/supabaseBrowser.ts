// Supabase browser client
// Env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL ?? '';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
export const supabase = url && key ? createClient(url, key) : null;
export const isSupabaseConfigured = Boolean(url && key);
