import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;

export function getSupabaseUrl(): string | undefined {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  return url && url.trim() ? url.trim() : undefined;
}

export function getSupabaseSecretKey(): string | undefined {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return key && key.trim() ? key.trim() : undefined;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseSecretKey());
}

export function isProductionDeployment(): boolean {
  return Boolean(process.env.VERCEL || process.env.NODE_ENV === 'production');
}

export function getSupabaseAdmin(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = getSupabaseUrl();
  const key = getSupabaseSecretKey();
  if (!url || !key) {
    throw new Error(
      'Supabase server configuration is missing. Set VITE_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SECRET_KEY.'
    );
  }

  cachedClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return cachedClient;
}
