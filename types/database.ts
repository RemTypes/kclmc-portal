export type Role = 0 | 1 | 2; // 0: Public, 1: Committee, 2: SuperAdmin

export interface Profile {
  id: string;
  full_name: string;
  student_id: string | null;
  university: string;
  phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  dietary_requirements: string | null;
  medical_notes: string | null;
  role: Role;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Membership {
  id: string;
  user_id: string;
  membership_number: string;
  tier: 'recreational' | 'social' | 'active' | 'committee' | 'alumni' | 'honorary';
  valid_from: string;
  valid_until: string;
  payment_reference: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Trip {
  id: string;
  title: string;
  description: string;
  trip_type: 'trad' | 'sport' | 'bouldering' | 'winter' | 'social' | 'expedition';
  location: string;
  date_start: string;
  date_end: string | null;
  difficulty_grade: string | null;
  trip_leader_id: string | null;
  max_capacity: number | null;
  gear_requirements: string[] | null;
  status: 'draft' | 'open' | 'waitlist' | 'full' | 'completed' | 'cancelled';
  price_pence: number;
  created_at: string;
  updated_at: string;
}

export interface TripRegistration {
  id: string;
  trip_id: string;
  user_id: string;
  status: 'confirmed' | 'waitlist' | 'cancelled';
  gear_notes: string | null;
  dietary_notes: string | null;
  emergency_contact_override: string | null;
  registered_at: string;
}

export interface Guide {
  id: string;
  title: string;
  description: string;
  category: 'indoor' | 'crag';
  location: string | null;
  grade_range: string | null;
  discount_info: string | null;
  website_url: string | null;
  image_url: string | null;
  sort_order: number;
  is_published: boolean;
  created_at: string;
}

export interface ShopItem {
  id: string;
  name: string;
  brand: 'KCL' | 'LUBE';
  price_pence: number;
  garment_types: string;
  current_moq: number;
  target_moq: number;
  is_active: boolean;
  created_at: string;
}

export interface MerchOrder {
  id: string;
  user_id: string | null;
  order_code: string;
  customer_name: string;
  customer_email: string;
  items: any[];
  total_pence: number;
  brand: 'KCL' | 'LUBE';
  status: 'pending' | 'paid' | 'collected' | 'refunded';
  created_at: string;
  updated_at: string;
}

export interface TelemetryEvent {
  id: string;
  event_type: string;
  payload: any;
  session_id: string | null;
  user_id: string | null;
  created_at: string;
}

export interface KclsuRosterRow {
  id: string;
  card_number: string;
  full_name: string;
  raw_purchaser: string;
  tier: 'social' | 'recreational';
  product_name: string;
  transaction_id: string;
  purchase_date: string | null;
  academic_year: string;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface KclsuRosterInsert {
  card_number: string;
  full_name: string;
  raw_purchaser: string;
  tier: 'social' | 'recreational';
  product_name: string;
  transaction_id: string;
  purchase_date?: string | null;
  academic_year?: string;
  user_id?: string | null;
}

export interface KclsuRosterUpdate {
  full_name?: string;
  raw_purchaser?: string;
  tier?: 'social' | 'recreational';
  product_name?: string;
  transaction_id?: string;
  purchase_date?: string | null;
  academic_year?: string;
  user_id?: string | null;
  updated_at?: string;
}

