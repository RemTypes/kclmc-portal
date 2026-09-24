import { createBrowserClient } from '@supabase/ssr';

const DEFAULT_URL = 'https://bsvnyibipcwrcyzqilge.supabase.co';
const DEFAULT_KEY = 'sb_publishable_IZmrUzhCzPpLG5ZuWVxY_A_QxQJl5Hg';

export function isSupabaseConfigured(): boolean {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_URL ||
    DEFAULT_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    DEFAULT_KEY;
  if (!url || !key) return false;
  if (url.includes('placeholder-project') || url.includes('example.com') || !url.startsWith('https://')) {
    return false;
  }
  return true;
}

export function createClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_URL ||
    DEFAULT_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    DEFAULT_KEY;

  return createBrowserClient(url, key);
}
