import { getD1Database, isD1Available } from './d1';
import { createClient, createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server';
import type {
  Guide,
  KclsuRosterRow,
  MerchOrder,
  Profile,
  ShopItem,
  Trip,
} from '@/types/database';

/**
 * Determines which active database backend is servicing requests.
 */
export async function getDatabaseBackend(): Promise<'d1' | 'supabase' | 'fallback'> {
  if (await isD1Available()) {
    return 'd1';
  }
  if (isSupabaseConfigured()) {
    return 'supabase';
  }
  return 'fallback';
}

/**
 * Fetch a single KCLSU roster member by card number (K-number).
 */
export async function getRosterMember(cardNumber: string): Promise<KclsuRosterRow | null> {
  const cleanCard = cardNumber.trim().toUpperCase();

  // 1. Try Cloudflare D1
  const d1 = await getD1Database();
  if (d1) {
    try {
      const row = await d1
        .prepare('SELECT * FROM kclsu_roster WHERE UPPER(card_number) = ? LIMIT 1')
        .bind(cleanCard)
        .first<KclsuRosterRow>();
      if (row) return row;
    } catch (err) {
      console.warn('D1 getRosterMember error:', err);
    }
  }

  // 2. Try Supabase
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from('kclsu_roster')
        .select('*')
        .eq('card_number', cleanCard)
        .maybeSingle();
      if (data) return data as KclsuRosterRow;
    } catch (err) {
      console.warn('Supabase getRosterMember error:', err);
    }
  }

  return null;
}

/**
 * Fetch all roster records (for admin verification and reconciliation).
 */
export async function getAllRosterMembers(): Promise<KclsuRosterRow[]> {
  const d1 = await getD1Database();
  if (d1) {
    try {
      const result = await d1
        .prepare('SELECT * FROM kclsu_roster ORDER BY full_name ASC')
        .all<KclsuRosterRow>();
      if (result.results && result.results.length > 0) {
        return result.results;
      }
    } catch (err) {
      console.warn('D1 getAllRosterMembers error:', err);
    }
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminClient();
      const { data } = await supabase
        .from('kclsu_roster')
        .select('*')
        .order('full_name', { ascending: true });
      if (data) return data as KclsuRosterRow[];
    } catch (err) {
      console.warn('Supabase getAllRosterMembers error:', err);
    }
  }

  return [];
}

/**
 * Fetch published guides (crags and indoor climbing centres).
 */
export async function getPublishedGuides(): Promise<Guide[]> {
  const d1 = await getD1Database();
  if (d1) {
    try {
      const result = await d1
        .prepare('SELECT * FROM guides WHERE is_published = 1 ORDER BY sort_order ASC')
        .all<any>();
      if (result.results && result.results.length > 0) {
        return result.results.map((r: any) => ({
          ...r,
          is_published: Boolean(r.is_published),
        })) as Guide[];
      }
    } catch (err) {
      console.warn('D1 getPublishedGuides error:', err);
    }
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from('guides')
        .select('*')
        .eq('is_published', true)
        .order('sort_order', { ascending: true });
      if (data) return data as Guide[];
    } catch (err) {
      console.warn('Supabase getPublishedGuides error:', err);
    }
  }

  return [];
}

/**
 * Fetch upcoming trips.
 */
export async function getTrips(): Promise<Trip[]> {
  const d1 = await getD1Database();
  if (d1) {
    try {
      const result = await d1
        .prepare('SELECT * FROM trips WHERE status != "draft" ORDER BY date_start ASC')
        .all<any>();
      if (result.results) {
        return result.results.map((r: any) => ({
          ...r,
          gear_requirements: typeof r.gear_requirements === 'string' ? JSON.parse(r.gear_requirements || '[]') : r.gear_requirements,
        })) as Trip[];
      }
    } catch (err) {
      console.warn('D1 getTrips error:', err);
    }
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from('trips')
        .select('*')
        .neq('status', 'draft')
        .order('date_start', { ascending: true });
      if (data) return data as Trip[];
    } catch (err) {
      console.warn('Supabase getTrips error:', err);
    }
  }

  return [];
}

/**
 * Fetch active shop items.
 */
export async function getShopItems(brand?: 'KCL' | 'LUBE'): Promise<ShopItem[]> {
  const d1 = await getD1Database();
  if (d1) {
    try {
      let query = 'SELECT * FROM shop_items WHERE is_active = 1';
      const params: any[] = [];
      if (brand) {
        query += ' AND brand = ?';
        params.push(brand);
      }
      query += ' ORDER BY created_at DESC';

      const result = await d1.prepare(query).bind(...params).all<any>();
      if (result.results) {
        return result.results.map((r: any) => ({
          ...r,
          is_active: Boolean(r.is_active),
        })) as ShopItem[];
      }
    } catch (err) {
      console.warn('D1 getShopItems error:', err);
    }
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      let query = supabase.from('shop_items').select('*').eq('is_active', true);
      if (brand) {
        query = query.eq('brand', brand);
      }
      const { data } = await query.order('created_at', { ascending: false });
      if (data) return data as ShopItem[];
    } catch (err) {
      console.warn('Supabase getShopItems error:', err);
    }
  }

  return [];
}

/**
 * Fetch member profile by ID.
 */
export async function getProfileById(userId: string): Promise<Profile | null> {
  const d1 = await getD1Database();
  if (d1) {
    try {
      const row = await d1
        .prepare('SELECT * FROM profiles WHERE id = ? LIMIT 1')
        .bind(userId)
        .first<Profile>();
      if (row) return row;
    } catch (err) {
      console.warn('D1 getProfileById error:', err);
    }
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (data) return data as Profile;
    } catch (err) {
      console.warn('Supabase getProfileById error:', err);
    }
  }

  return null;
}
