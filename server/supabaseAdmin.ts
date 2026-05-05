// Supabase admin client (service role key, server-only)
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from '@supabase/supabase-js';
const url = process.env.SUPABASE_URL ?? '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
export const admin = url && key ? createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false }
}) : null;
export const isAdminConfigured = Boolean(url && key);
