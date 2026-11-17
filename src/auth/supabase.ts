import { createClient } from '@supabase/supabase-js';

export const demoMode = import.meta.env.VITE_DEMO_MODE === '1';
const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const supabaseConfigured = Boolean(url && key);
export const supabase = !demoMode && url && key
  ? createClient(url, key, {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export const RETURN_TO_KEY = 'louvre.returnTo';

export function callbackUrl(): string {
  return `${window.location.origin}/auth/callback`;
}
