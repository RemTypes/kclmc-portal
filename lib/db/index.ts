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

export const FALLBACK_TRIPS: Trip[] = [
  {
    id: 'trip-weekly-wall',
    title: 'Weekly Social Wall Sessions',
    description: 'Drop-in society sessions at London climbing centres. No advance registration needed — simply present your KCLSU Recreational pass at reception for society discount.',
    trip_type: 'social',
    location: 'VauxWall East (Mondays 16:00-20:00) & The Castle (Wednesdays 15:00-19:00)',
    date_start: '2026-10-05',
    date_end: '2027-06-01',
    difficulty_grade: 'All Grades (V0-V10 / 3-8a)',
    trip_leader_id: null,
    max_capacity: 100,
    gear_requirements: ['Climbing Shoes', 'Chalk Bag', 'Harness (optional for Castle ropes)'],
    itinerary: [
      'Mondays: VauxWall East from 16:00 to 20:00 with post-session pub social',
      'Wednesdays: The Castle Climbing Centre from 15:00 to 19:00 with lead and top-rope pairs'
    ],
    status: 'open',
    price_pence: 0,
    google_form_url: null,
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'trip-harrisons-rocks',
    title: "Harrison's Rocks Day Trip",
    description: 'Southern Sandstone top-roping and bouldering classic. The ideal first outdoor rock trip of the academic year, located just 50 minutes from London Bridge.',
    trip_type: 'trad',
    location: "Harrison's Rocks, Groombridge, Kent",
    date_start: '2026-10-18',
    date_end: '2026-10-18',
    difficulty_grade: 'Mod to E3 (Top-rope only)',
    trip_leader_id: null,
    max_capacity: 24,
    gear_requirements: ['Climbing Helmet (Mandatory)', 'Harness', 'Rock Shoes', 'Carabiner & Belay Device', 'Packed Lunch & Water'],
    itinerary: [
      '08:15: Meet at London Bridge station main concourse',
      '08:45: Train departure to Eridge',
      '10:00: Walk to crag and safety briefing on sandstone ethics (no moving ropes across rock)',
      '10:30-16:30: Rigging top-ropes and climbing classic lines',
      '17:00: De-rig and debrief at The Junction Inn before return train'
    ],
    status: 'open',
    price_pence: 1500,
    google_form_url: 'https://docs.google.com/forms/d/e/1FAIpQLSc_kclmc_harrisons_rocks_sample/viewform',
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'trip-portland-sport',
    title: 'Portland Limestone Sport Weekend',
    description: 'Two days of sunny sea-cliff limestone sport climbing along the Jurassic Coast. Routes from easy beginner friendly F4s to testpiece F7cs, staying in the Portland bunkhouse.',
    trip_type: 'sport',
    location: 'The Cuttings & Blacknor, Isle of Portland, Dorset',
    date_start: '2026-11-07',
    date_end: '2026-11-08',
    difficulty_grade: 'F4 to F7b+',
    trip_leader_id: null,
    max_capacity: 18,
    gear_requirements: ['Climbing Helmet (Mandatory)', 'Harness', 'Rock Shoes', 'Belay Device', 'Sleeping Bag', 'Warm Layers & Waterproofs'],
    itinerary: [
      "Friday 18:30: Coach departure from Guy's Campus",
      'Friday 22:30: Arrive at Portland Bunkhouse & bed down',
      'Saturday 09:00: Full day sport climbing at The Cuttings with tidal and clip-stick safety briefings',
      'Saturday 19:30: Communal club dinner & fish and chips in Castletown',
      'Sunday 09:30: Morning climbing at Blacknor Central / Battleship',
      'Sunday 16:00: Pack up and coach departure back to London'
    ],
    status: 'open',
    price_pence: 5500,
    google_form_url: 'https://docs.google.com/forms/d/e/1FAIpQLSc_kclmc_portland_sport_sample/viewform',
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'trip-peak-district',
    title: 'Peak District Trad & Bouldering Weekend',
    description: 'Classic British gritstone trad climbing and bouldering on the legendary Stanage Edge and Burbage North. Camping or bunkhouse option in Hathersage.',
    trip_type: 'trad',
    location: 'Stanage Edge & Burbage, Hathersage, Derbyshire',
    date_start: '2026-11-28',
    date_end: '2026-11-29',
    difficulty_grade: 'Diff to E2 / Font 3 to 7A',
    trip_leader_id: null,
    max_capacity: 16,
    gear_requirements: ['Climbing Helmet (Mandatory)', 'Harness', 'Rock Shoes', 'Belay Device', 'Warm Down Jacket', 'Headtorch', 'Sleeping Bag & Mat'],
    itinerary: [
      'Friday 17:45: Mini-bus pickup from Strand Campus',
      'Friday 22:00: Arrive at Hathersage Bunkhouse',
      'Saturday 09:00: Trad placement clinic on Stanage Popular End and paired lead/second climbing',
      'Saturday 17:00: Tea & cake at Outside Cafe, Hathersage',
      'Sunday 09:30: Burbage bouldering and highball circuit',
      'Sunday 16:30: Depart for London'
    ],
    status: 'open',
    price_pence: 4800,
    google_form_url: 'https://docs.google.com/forms/d/e/1FAIpQLSc_kclmc_peak_district_sample/viewform',
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'trip-scottish-winter',
    title: 'Scottish Winter Mountaineering Expedition',
    description: 'Iconic winter mountaineering and snow gully ascents in Glencoe and the Ben Nevis range. Crampon, ice axe, and winter navigation workshop included.',
    trip_type: 'winter',
    location: 'Glencoe & Fort William, Scottish Highlands',
    date_start: '2027-01-14',
    date_end: '2027-01-18',
    difficulty_grade: 'Winter Grade I to III',
    trip_leader_id: null,
    max_capacity: 12,
    gear_requirements: ['B2/B3 Mountaineering Boots (Mandatory)', 'C2 Walking/Climbing Crampons', 'Mountaineering Axe', 'Climbing Helmet', 'Winter Goggles & Balaclava', 'Four-season Waterproofs', 'Emergency Bivi Bag & Whistle'],
    itinerary: [
      'Thursday 20:00: Overnight sleeper or road convoy to Fort William',
      'Friday: Winter skills clinic (avalanche awareness, crampon footwork, ice axe arrests)',
      'Saturday: Guided ascent of Glencoe classic ridge/gully (e.g. Zig-Zags or Curved Ridge)',
      'Sunday: Second mountaineering objective on Ben Nevis North Face / Aonach Mor',
      'Monday: Morning debrief and return travel to London'
    ],
    status: 'open',
    price_pence: 14500,
    google_form_url: 'https://docs.google.com/forms/d/e/1FAIpQLSc_kclmc_scottish_winter_sample/viewform',
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
  }
];

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
          itinerary: typeof r.itinerary === 'string' ? JSON.parse(r.itinerary || '[]') : r.itinerary,
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
      if (data && data.length > 0) return data as Trip[];
    } catch (err) {
      console.warn('Supabase getTrips error:', err);
    }
  }

  return FALLBACK_TRIPS;
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
