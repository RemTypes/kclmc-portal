/**
 * MemberRoster Module
 * 
 * Deep module encapsulating Climber roster verification, student ID linking,
 * pass resolution, safety gate status, and wall scanner pass verification.
 * 
 * Seam:
 * - RosterStorageAdapter: interface satisfied by PostgresRosterAdapter (Supabase)
 *   and InMemoryRosterAdapter (seeded array & in-memory map).
 */

import {
  KclsuMemberRecord,
  INITIAL_KCLSU_ROSTER,
  findMemberByCardNumber,
  parseKclsuCsv,
  upsertRosterToSupabase,
  isCompleteFullName,
  formatPurchaserName,
  generateNextAssociateId,
} from '@/lib/roster';
import { checkSafetyProfileCompleteness, SafetyCompletenessResult } from '@/lib/safety';
import { sanitizeUniversity, isAssociateId, sanitizeEmail, getUserRole } from '@/lib/auth';
import type { Profile, Membership, SuProcessingStatus } from '@/types/database';
import { createClient, createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { trackServerEvent } from '@/lib/telemetry-server';
import { D1RosterAdapter } from './d1-adapter';
import { D1Database, getD1Database } from '@/lib/db/d1';

export interface RosterMemberDirectoryItem {
  cardNumber: string;
  name: string;
  rawPurchaser: string;
  tier: 'social' | 'recreational';
  productName: string;
  transactionId: string;
  purchaseDate: string;
  userId?: string | null;
  phone?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  university?: string | null;
  safetyComplete: boolean;
  isAssociate?: boolean;
  email?: string | null;
  suStatus?: SuProcessingStatus;
}

export interface CreateAssociateMemberInput {
  fullName: string;
  tier: 'social' | 'recreational';
  cardNumber?: string | null;
  customCardNumber?: string | null;
  email?: string | null;
  university?: string | null;
  suStatus?: SuProcessingStatus;
  transactionId?: string | null;
}

export interface UpdateRosterMemberInput {
  fullName?: string;
  tier?: 'social' | 'recreational';
  email?: string | null;
  university?: string | null;
  suStatus?: SuProcessingStatus;
}

export interface PassResolutionResult {
  authenticated: boolean;
  user: {
    id: string;
    email?: string | null;
    fullName?: string;
    role: number;
  } | null;
  profile: Profile | null;
  boundStudentId: string | null;
  suRecord: KclsuMemberRecord | null;
  membership: Membership | null;
  safetyCheck: SafetyCompletenessResult;
  error?: string;
}

export interface LinkMemberResult {
  success: boolean;
  member?: KclsuMemberRecord;
  message?: string;
  error?: string;
  statusCode: number;
}

export interface PublicPassVerificationResult {
  valid: boolean;
  member?: {
    name: string;
    tier: string;
    membership_number: string;
    student_id?: string | null;
    expires: string;
    transaction_id?: string | null;
    product_name?: string;
    source: string;
    userId?: string | null;
    isAssociate?: boolean;
    suStatus?: SuProcessingStatus;
  };
  error?: string;
  statusCode: number;
}

/**
 * Storage Seam Interface
 */
export interface RosterStorageAdapter {
  isConfigured(): boolean;
  findProfile(userId: string): Promise<Profile | null>;
  findProfileByStudentId(studentId: string): Promise<Profile | null>;
  upsertProfile(userId: string, data: Partial<Profile>): Promise<Profile | null>;
  findRosterRecord(cardNumber: string): Promise<KclsuMemberRecord | null>;
  findRosterRecordByUserId(userId: string): Promise<KclsuMemberRecord | null>;
  bindRosterRecord(cardNumber: string, userId: string, memberData?: KclsuMemberRecord): Promise<void>;
  listRosterWithProfiles(): Promise<{
    source: string;
    members: RosterMemberDirectoryItem[];
    socialCount: number;
    recreationalCount: number;
  }>;
  verifyPublicPass(identifier: string): Promise<PublicPassVerificationResult>;
  upsertRosterRecords(records: KclsuMemberRecord[]): Promise<{ count: number; error?: any }>;
  updateMemberName(cardNumber: string, fullName: string): Promise<{ success: boolean; error?: string }>;
  createAssociateRecord(record: KclsuMemberRecord): Promise<{ success: boolean; member?: KclsuMemberRecord; error?: string }>;
  updateRosterMember(cardNumber: string, updates: UpdateRosterMemberInput): Promise<{ success: boolean; member?: KclsuMemberRecord; error?: string }>;
  deleteRosterMember(cardNumber: string): Promise<{ success: boolean; error?: string }>;
}

function mapDbRowToRecord(row: any): KclsuMemberRecord & { user_id?: string | null } {
  const card = String(row.card_number || '').trim().toUpperCase();
  const isAssoc = Boolean(row.is_associate ?? isAssociateId(card));
  return {
    cardNumber: card,
    name: row.full_name,
    rawPurchaser: row.raw_purchaser || '',
    tier: row.tier,
    productName: row.product_name,
    transactionId: row.transaction_id,
    purchaseDate: row.purchase_date || '',
    isAssociate: isAssoc,
    email: row.member_email || null,
    university: row.university || null,
    suStatus: (row.su_status as SuProcessingStatus) || 'verified',
    user_id: row.user_id || null,
  };
}

/**
 * Concrete Adapter 1: PostgresRosterAdapter (Supabase PostgreSQL with RLS Resilience)
 */
export class PostgresRosterAdapter implements RosterStorageAdapter {
  isConfigured(): boolean {
    return isSupabaseConfigured();
  }

  async findProfile(userId: string): Promise<Profile | null> {
    if (!this.isConfigured() || !userId) return null;
    try {
      const supabase = await createClient();
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (data) return data as Profile;

      const admin = createAdminClient();
      const { data: adminData } = await admin.from('profiles').select('*').eq('id', userId).maybeSingle();
      return (adminData as Profile) || null;
    } catch {
      return null;
    }
  }

  async findProfileByStudentId(studentId: string): Promise<Profile | null> {
    if (!this.isConfigured() || !studentId) return null;
    const cleanId = studentId.trim().toUpperCase();
    try {
      const supabase = await createClient();
      const { data } = await supabase.from('profiles').select('*').eq('student_id', cleanId).maybeSingle();
      if (data) return data as Profile;

      const admin = createAdminClient();
      const { data: adminData } = await admin.from('profiles').select('*').eq('student_id', cleanId).maybeSingle();
      return (adminData as Profile) || null;
    } catch {
      return null;
    }
  }

  async upsertProfile(userId: string, data: Partial<Profile>): Promise<Profile | null> {
    if (!this.isConfigured() || !userId) return null;
    const updatePayload = {
      ...data,
      updated_at: new Date().toISOString(),
    };

    try {
      const supabase = await createClient();
      const { data: updated, error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', userId)
        .select()
        .maybeSingle();

      if (!error && updated) return updated as Profile;

      const admin = createAdminClient();
      const { data: adminUpdated } = await admin
        .from('profiles')
        .update(updatePayload)
        .eq('id', userId)
        .select()
        .maybeSingle();

      return (adminUpdated as Profile) || null;
    } catch {
      return null;
    }
  }

  async findRosterRecord(cardNumber: string): Promise<KclsuMemberRecord | null> {
    if (!cardNumber) return null;
    const cleanId = cardNumber.trim().toUpperCase();

    if (this.isConfigured()) {
      try {
        const supabase = await createClient();
        const { data: rowFromUser } = await supabase
          .from('kclsu_roster')
          .select('*')
          .eq('card_number', cleanId)
          .maybeSingle();

        if (rowFromUser) {
          return mapDbRowToRecord(rowFromUser);
        }

        const admin = createAdminClient();
        const { data: rowFromAdmin } = await admin
          .from('kclsu_roster')
          .select('*')
          .eq('card_number', cleanId)
          .maybeSingle();

        if (rowFromAdmin) {
          return mapDbRowToRecord(rowFromAdmin);
        }
      } catch (err) {
        console.warn('[PostgresRosterAdapter] findRosterRecord query error:', err);
      }
    }

    // Fallback to seeded initial roster
    const seeded = findMemberByCardNumber(cleanId);
    return seeded || null;
  }

  async findRosterRecordByUserId(userId: string): Promise<KclsuMemberRecord | null> {
    if (!this.isConfigured() || !userId) return null;
    try {
      const supabase = await createClient();
      const { data: rowFromUser } = await supabase
        .from('kclsu_roster')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (rowFromUser) {
        return mapDbRowToRecord(rowFromUser);
      }

      const admin = createAdminClient();
      const { data: rowFromAdmin } = await admin
        .from('kclsu_roster')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (rowFromAdmin) {
        return mapDbRowToRecord(rowFromAdmin);
      }
      return null;
    } catch {
      return null;
    }
  }

  async bindRosterRecord(cardNumber: string, userId: string, memberData?: KclsuMemberRecord): Promise<void> {
    if (!this.isConfigured()) return;
    const cleanId = cardNumber.trim().toUpperCase();
    const supabase = await createClient();
    const admin = createAdminClient();

    // If record did not exist in DB yet (was found in seeded array), insert it
    if (memberData) {
      const insertPayload = {
        card_number: cleanId,
        full_name: memberData.name,
        raw_purchaser: memberData.rawPurchaser,
        tier: memberData.tier,
        product_name: memberData.productName,
        transaction_id: memberData.transactionId,
        purchase_date: memberData.purchaseDate,
        academic_year: '2026/27',
        user_id: userId,
      };

      const { error: insErr } = await supabase.from('kclsu_roster').insert(insertPayload);
      if (insErr) {
        await admin.from('kclsu_roster').insert(insertPayload);
      }
    }

    const { error: updateErr } = await supabase
      .from('kclsu_roster')
      .update({ user_id: userId, updated_at: new Date().toISOString() })
      .eq('card_number', cleanId);

    if (updateErr) {
      await admin
        .from('kclsu_roster')
        .update({ user_id: userId, updated_at: new Date().toISOString() })
        .eq('card_number', cleanId);
    }
  }

  async listRosterWithProfiles(): Promise<{
    source: string;
    members: RosterMemberDirectoryItem[];
    socialCount: number;
    recreationalCount: number;
  }> {
    if (!this.isConfigured()) {
      const socialCount = INITIAL_KCLSU_ROSTER.filter(m => m.tier === 'social').length;
      const recCount = INITIAL_KCLSU_ROSTER.filter(m => m.tier === 'recreational').length;
      return {
        source: 'local_fallback',
        members: INITIAL_KCLSU_ROSTER.map(r => ({
          ...r,
          university: r.university || "King's College London",
          isAssociate: Boolean(r.isAssociate ?? isAssociateId(r.cardNumber)),
          suStatus: r.suStatus || 'verified',
          safetyComplete: false,
        })),
        socialCount,
        recreationalCount: recCount,
      };
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('kclsu_roster')
      .select('*')
      .order('purchase_date', { ascending: false });

    if (error || !data) {
      throw new Error(error?.message || 'Failed to list roster');
    }

    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, full_name, student_id, phone, emergency_contact_name, emergency_contact_phone, university');

    const profileByUserId = new Map<string, any>();
    const profileByStudentId = new Map<string, any>();
    (profilesData || []).forEach((p: any) => {
      if (p.id) profileByUserId.set(p.id, p);
      if (p.student_id) profileByStudentId.set(p.student_id.toUpperCase(), p);
    });

    const members: RosterMemberDirectoryItem[] = data.map((row: any) => {
      const prof = (row.user_id ? profileByUserId.get(row.user_id) : null) || 
                   (row.card_number ? profileByStudentId.get(row.card_number.toUpperCase()) : null);

      const hasPhone = Boolean(prof?.phone && prof.phone.trim().length >= 8);
      const hasEmergency = Boolean(prof?.emergency_contact_phone && prof.emergency_contact_phone.trim().length >= 8);
      const safetyComplete = hasPhone && hasEmergency;

      // Layer 3: Linked Profile Authority
      // If roster name only has surname or placeholder, but user's linked profile has complete full name, use profile name
      const rosterNameHasFull = isCompleteFullName(row.full_name);
      const profileNameHasFull = isCompleteFullName(prof?.full_name);
      const resolvedName = rosterNameHasFull ? row.full_name : (profileNameHasFull ? prof.full_name : row.full_name);
      const isAssoc = Boolean(row.is_associate ?? isAssociateId(row.card_number));

      return {
        cardNumber: row.card_number,
        name: resolvedName,
        rawPurchaser: row.raw_purchaser,
        tier: row.tier,
        productName: row.product_name,
        transactionId: row.transaction_id,
        purchaseDate: row.purchase_date || '',
        userId: row.user_id,
        phone: prof?.phone || null,
        emergencyContactName: prof?.emergency_contact_name || null,
        emergencyContactPhone: prof?.emergency_contact_phone || null,
        university: prof?.university || row.university || (isAssoc ? 'Alumni / Associate / Guest' : "King's College London"),
        safetyComplete,
        isAssociate: isAssoc,
        email: row.member_email || null,
        suStatus: (row.su_status as SuProcessingStatus) || 'verified',
      };
    });

    const socialCount = members.filter(m => m.tier === 'social').length;
    const recreationalCount = members.filter(m => m.tier === 'recreational').length;

    return {
      source: 'supabase',
      members,
      socialCount,
      recreationalCount,
    };
  }

  async verifyPublicPass(identifier: string): Promise<PublicPassVerificationResult> {
    const cleanId = identifier.trim().toUpperCase();

    if (this.isConfigured()) {
      try {
        const supabase = await createClient();

        // 1. Check official kclsu_roster
        const { data: rosterData } = await supabase
          .from('kclsu_roster')
          .select('*')
          .eq('card_number', cleanId)
          .maybeSingle();

        if (rosterData) {
          if (rosterData.su_status === 'revoked') {
            return {
              valid: false,
              statusCode: 403,
              error: `Membership pass ${cleanId} has been revoked or deactivated.`,
            };
          }
          const isAssoc = Boolean(rosterData.is_associate ?? isAssociateId(rosterData.card_number));
          return {
            valid: true,
            statusCode: 200,
            member: {
              name: rosterData.full_name,
              tier: rosterData.tier,
              membership_number: rosterData.card_number,
              student_id: rosterData.card_number,
              expires: '2027-08-31',
              transaction_id: rosterData.transaction_id,
              product_name: rosterData.product_name,
              source: 'Supabase KCLSU Database',
              userId: rosterData.user_id,
              isAssociate: isAssoc,
              suStatus: rosterData.su_status || 'verified',
            },
          };
        }

        // 2. Check memberships table
        let query = supabase.from('memberships').select(`
          id, membership_number, tier, valid_from, valid_until, is_active, payment_reference,
          profiles ( full_name, student_id )
        `);

        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);
        query = isUuid ? query.eq('id', cleanId) : query.eq('membership_number', cleanId);

        const { data: memberData } = await query.maybeSingle();
        if (memberData) {
          const profileData = Array.isArray(memberData.profiles) ? memberData.profiles[0] : memberData.profiles;
          return {
            valid: Boolean(memberData.is_active),
            statusCode: 200,
            member: {
              name: profileData?.full_name || 'KCL Climber',
              tier: memberData.tier,
              membership_number: memberData.membership_number,
              expires: memberData.valid_until,
              student_id: profileData?.student_id || null,
              transaction_id: memberData.payment_reference || null,
              source: 'Database',
            },
          };
        }
      } catch (e) {
        console.warn('[PostgresRosterAdapter] verifyPublicPass error:', e);
      }
    }

    // 3. Fallback to initial roster
    const fallback = findMemberByCardNumber(cleanId);
    if (fallback) {
      return {
        valid: true,
        statusCode: 200,
        member: {
          name: fallback.name,
          tier: fallback.tier,
          membership_number: fallback.cardNumber,
          student_id: fallback.cardNumber,
          expires: '2027-08-31',
          transaction_id: fallback.transactionId,
          product_name: fallback.productName,
          source: 'KCLSU Official Roster (Local)',
        },
      };
    }

    const safeDisplayId = cleanId.replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
    return {
      valid: false,
      statusCode: 404,
      error: `No official KCLMC membership found for ID ${safeDisplayId}`,
    };
  }

  async upsertRosterRecords(records: KclsuMemberRecord[]): Promise<{ count: number; error?: any }> {
    if (!this.isConfigured()) {
      return { count: records.length };
    }
    const admin = createAdminClient();
    return upsertRosterToSupabase(records, admin);
  }

  async updateMemberName(cardNumber: string, fullName: string): Promise<{ success: boolean; error?: string }> {
    const cleanCard = cardNumber.trim().toUpperCase();
    const cleanName = fullName.trim();
    if (!cleanCard || !cleanName) {
      return { success: false, error: 'Student ID and full name are required' };
    }

    if (this.isConfigured()) {
      try {
        const admin = createAdminClient();
        const { error } = await admin
          .from('kclsu_roster')
          .update({
            full_name: cleanName,
            updated_at: new Date().toISOString(),
          })
          .eq('card_number', cleanCard);

        if (error) {
          return { success: false, error: error.message };
        }
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    return { success: true };
  }

  async createAssociateRecord(record: KclsuMemberRecord): Promise<{ success: boolean; member?: KclsuMemberRecord; error?: string }> {
    if (!this.isConfigured()) {
      return { success: true, member: record };
    }

    try {
      const admin = createAdminClient();
      const fullPayload: Record<string, any> = {
        card_number: record.cardNumber,
        full_name: record.name,
        raw_purchaser: record.rawPurchaser,
        tier: record.tier,
        product_name: record.productName,
        transaction_id: record.transactionId,
        purchase_date: record.purchaseDate,
        academic_year: '2026/27',
        is_associate: true,
        member_email: record.email || null,
        university: record.university || 'Alumni / Associate / Guest',
        su_status: record.suStatus || 'awaiting_su',
        updated_at: new Date().toISOString(),
      };

      let { data, error } = await admin
        .from('kclsu_roster')
        .insert(fullPayload)
        .select()
        .maybeSingle();

      // Fallback if migration 009 columns have not been applied yet
      if (error && (String(error.message || '').includes('column') || String(error.code || '') === '42703')) {
        const { is_associate, member_email, university, su_status, ...legacyPayload } = fullPayload;
        const retry = await admin
          .from('kclsu_roster')
          .insert(legacyPayload)
          .select()
          .maybeSingle();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        member: data ? mapDbRowToRecord(data) : record,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async updateRosterMember(cardNumber: string, updates: UpdateRosterMemberInput): Promise<{ success: boolean; member?: KclsuMemberRecord; error?: string }> {
    const cleanCard = cardNumber.trim().toUpperCase();
    if (!this.isConfigured()) {
      return { success: true };
    }

    try {
      const admin = createAdminClient();
      const updatePayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.fullName !== undefined) updatePayload.full_name = updates.fullName.trim();
      if (updates.tier !== undefined) updatePayload.tier = updates.tier;
      if (updates.email !== undefined) updatePayload.member_email = updates.email ? sanitizeEmail(updates.email) : null;
      if (updates.university !== undefined) updatePayload.university = updates.university ? sanitizeUniversity(updates.university) : null;
      if (updates.suStatus !== undefined) updatePayload.su_status = updates.suStatus;

      let { data, error } = await admin
        .from('kclsu_roster')
        .update(updatePayload)
        .eq('card_number', cleanCard)
        .select()
        .maybeSingle();

      if (error && (String(error.message || '').includes('column') || String(error.code || '') === '42703')) {
        const { member_email, university, su_status, ...legacyPayload } = updatePayload;
        const retry = await admin
          .from('kclsu_roster')
          .update(legacyPayload)
          .eq('card_number', cleanCard)
          .select()
          .maybeSingle();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        member: data ? mapDbRowToRecord(data) : undefined,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async deleteRosterMember(cardNumber: string): Promise<{ success: boolean; error?: string }> {
    const cleanCard = cardNumber.trim().toUpperCase();
    if (!this.isConfigured()) {
      return { success: true };
    }

    try {
      const admin = createAdminClient();
      // Clear student_id on any bound profile first
      await admin
        .from('profiles')
        .update({ student_id: null, updated_at: new Date().toISOString() })
        .eq('student_id', cleanCard);

      const { error } = await admin
        .from('kclsu_roster')
        .delete()
        .eq('card_number', cleanCard);

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

/**
 * Concrete Adapter 2: InMemoryRosterAdapter (Offline, Test-Isolated, Zero-DB)
 */
export class InMemoryRosterAdapter implements RosterStorageAdapter {
  private rosterMap = new Map<string, KclsuMemberRecord>();
  private profileMap = new Map<string, Profile>();
  private userToCardMap = new Map<string, string>();

  constructor() {
    INITIAL_KCLSU_ROSTER.forEach(m => {
      this.rosterMap.set(m.cardNumber.toUpperCase(), { ...m });
    });
  }

  isConfigured(): boolean {
    return true;
  }

  async findProfile(userId: string): Promise<Profile | null> {
    return this.profileMap.get(userId) || null;
  }

  async findProfileByStudentId(studentId: string): Promise<Profile | null> {
    const clean = studentId.trim().toUpperCase();
    for (const p of this.profileMap.values()) {
      if (p.student_id?.toUpperCase() === clean) return p;
    }
    return null;
  }

  async upsertProfile(userId: string, data: Partial<Profile>): Promise<Profile | null> {
    const existing = this.profileMap.get(userId) || ({ id: userId } as Profile);
    const updated = { ...existing, ...data, updated_at: new Date().toISOString() } as Profile;
    this.profileMap.set(userId, updated);
    return updated;
  }

  async findRosterRecord(cardNumber: string): Promise<KclsuMemberRecord | null> {
    return this.rosterMap.get(cardNumber.trim().toUpperCase()) || null;
  }

  async findRosterRecordByUserId(userId: string): Promise<KclsuMemberRecord | null> {
    const card = this.userToCardMap.get(userId);
    if (!card) return null;
    return this.findRosterRecord(card);
  }

  async bindRosterRecord(cardNumber: string, userId: string, memberData?: KclsuMemberRecord): Promise<void> {
    const clean = cardNumber.trim().toUpperCase();
    if (memberData && !this.rosterMap.has(clean)) {
      this.rosterMap.set(clean, memberData);
    }
    this.userToCardMap.set(userId, clean);
  }

  async listRosterWithProfiles(): Promise<{
    source: string;
    members: RosterMemberDirectoryItem[];
    socialCount: number;
    recreationalCount: number;
  }> {
    const records = Array.from(this.rosterMap.values());
    const members: RosterMemberDirectoryItem[] = records.map(r => {
      let matchedProf: Profile | undefined;
      for (const p of this.profileMap.values()) {
        if (p.student_id?.toUpperCase() === r.cardNumber.toUpperCase()) {
          matchedProf = p;
          break;
        }
      }

      const hasPhone = Boolean(matchedProf?.phone && matchedProf.phone.trim().length >= 8);
      const hasEmergency = Boolean(matchedProf?.emergency_contact_phone && matchedProf.emergency_contact_phone.trim().length >= 8);

      // Layer 3: Linked Profile Authority
      const rosterNameHasFull = isCompleteFullName(r.name);
      const profileNameHasFull = isCompleteFullName(matchedProf?.full_name);
      const resolvedName = rosterNameHasFull ? r.name : (profileNameHasFull ? matchedProf!.full_name : r.name);

      return {
        ...r,
        name: resolvedName,
        phone: matchedProf?.phone || null,
        emergencyContactName: matchedProf?.emergency_contact_name || null,
        emergencyContactPhone: matchedProf?.emergency_contact_phone || null,
        university: matchedProf?.university || r.university || (r.isAssociate ? 'Associate / Guest' : "King's College London"),
        safetyComplete: hasPhone && hasEmergency,
        isAssociate: Boolean(r.isAssociate),
        email: r.email || null,
        suStatus: r.suStatus || 'verified',
      };
    });

    return {
      source: 'in_memory',
      members,
      socialCount: members.filter(m => m.tier === 'social').length,
      recreationalCount: members.filter(m => m.tier === 'recreational').length,
    };
  }

  async verifyPublicPass(identifier: string): Promise<PublicPassVerificationResult> {
    const clean = identifier.trim().toUpperCase();
    const record = this.rosterMap.get(clean);
    if (record) {
      if (record.suStatus === 'revoked') {
        return {
          valid: false,
          statusCode: 403,
          error: `Membership for ID ${clean} has been revoked`,
        };
      }
      return {
        valid: true,
        statusCode: 200,
        member: {
          name: record.name,
          tier: record.tier,
          membership_number: record.cardNumber,
          student_id: record.cardNumber,
          expires: '2027-08-31',
          transaction_id: record.transactionId,
          product_name: record.productName,
          source: 'In-Memory Test Adapter',
        },
      };
    }
    return {
      valid: false,
      statusCode: 404,
      error: `No official KCLMC membership found for ID ${clean}`,
    };
  }

  async upsertRosterRecords(records: KclsuMemberRecord[]): Promise<{ count: number }> {
    const normalizeName = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
    records.forEach(r => {
      let cleanCard = r.cardNumber.toUpperCase();

      // Reconcile pending associate records by full name if incoming is an associate row with a generated ID
      if (r.isAssociate) {
        const incomingNorm = normalizeName(r.name);
        for (const [existingCard, existingRec] of this.rosterMap.entries()) {
          if (existingRec.isAssociate && normalizeName(existingRec.name) === incomingNorm) {
            cleanCard = existingCard;
            break;
          }
        }
      }

      const existing = this.rosterMap.get(cleanCard);
      let resolvedName = r.name;
      if (existing && existing.name) {
        const existingHasFull = isCompleteFullName(existing.name);
        const incomingIsSingleOrMissing = !isCompleteFullName(r.name);
        const wasManuallyEdited = existing.name !== formatPurchaserName(existing.rawPurchaser);
        if ((existingHasFull && incomingIsSingleOrMissing) || wasManuallyEdited) {
          resolvedName = existing.name;
        }
      }
      this.rosterMap.set(cleanCard, {
        ...r,
        cardNumber: cleanCard,
        name: resolvedName,
        isAssociate: r.isAssociate ?? existing?.isAssociate ?? false,
        email: r.email || existing?.email || null,
        university: r.university || existing?.university || null,
        suStatus: r.suStatus || 'verified',
      });
    });
    return { count: records.length };
  }

  async updateMemberName(cardNumber: string, fullName: string): Promise<{ success: boolean; error?: string }> {
    const cleanCard = cardNumber.trim().toUpperCase();
    const cleanName = fullName.trim();
    const existing = this.rosterMap.get(cleanCard);
    if (!existing) {
      return { success: false, error: `Member ${cleanCard} not found in roster` };
    }
    this.rosterMap.set(cleanCard, { ...existing, name: cleanName });
    return { success: true };
  }

  async createAssociateRecord(record: KclsuMemberRecord): Promise<{
    success: boolean;
    member?: KclsuMemberRecord;
    error?: string;
  }> {
    const cardNumber = record.cardNumber.trim().toUpperCase();
    if (this.rosterMap.has(cardNumber)) {
      return { success: false, error: `ID ${cardNumber} already exists in the roster` };
    }
    this.rosterMap.set(cardNumber, { ...record, cardNumber });
    return { success: true, member: { ...record, cardNumber } };
  }

  async updateRosterMember(cardNumber: string, updates: UpdateRosterMemberInput): Promise<{
    success: boolean;
    member?: KclsuMemberRecord;
    error?: string;
  }> {
    const cleanCard = cardNumber.trim().toUpperCase();
    const existing = this.rosterMap.get(cleanCard);
    if (!existing) {
      return { success: false, error: `Member ${cleanCard} not found in roster` };
    }

    const updated: KclsuMemberRecord = { ...existing };
    if (updates.fullName !== undefined) updated.name = updates.fullName.trim();
    if (updates.tier !== undefined) {
      updated.tier = updates.tier;
      updated.productName = updated.isAssociate
        ? (updates.tier === 'recreational'
            ? 'KCL Mountaineering Associate Recreational Membership 2026/27'
            : 'KCL Mountaineering Associate Social Membership 2026/27')
        : (updates.tier === 'recreational'
            ? 'KCL Mountaineering Club Recreational Membership 2026/27'
            : 'KCL Mountaineering Club Social Membership 2026/27');
    }
    if (updates.email !== undefined) updated.email = updates.email?.trim() || null;
    if (updates.university !== undefined) updated.university = updates.university?.trim() || null;
    if (updates.suStatus !== undefined) updated.suStatus = updates.suStatus;

    this.rosterMap.set(cleanCard, updated);
    return { success: true, member: updated };
  }

  async deleteRosterMember(cardNumber: string): Promise<{ success: boolean; error?: string }> {
    const cleanCard = cardNumber.trim().toUpperCase();
    if (!this.rosterMap.has(cleanCard)) {
      return { success: false, error: `Member ${cleanCard} not found in roster` };
    }
    this.rosterMap.delete(cleanCard);
    return { success: true };
  }
}

/**
 * Deep MemberRosterService
 */
export class MemberRosterService {
  private explicitAdapter = false;
  private cachedD1Adapter: D1RosterAdapter | null = null;
  private cachedD1Db: D1Database | null = null;

  constructor(private storage: RosterStorageAdapter = new PostgresRosterAdapter()) {
    if (arguments.length > 0 && storage !== undefined) {
      this.explicitAdapter = true;
    }
  }

  /**
   * Sets the active storage adapter (useful for testing or swapping to in-memory mode)
   */
  setStorageAdapter(adapter: RosterStorageAdapter): void {
    this.storage = adapter;
    this.explicitAdapter = true;
  }

  /**
   * Dynamically resolves the active storage adapter.
   * If an adapter was explicitly injected (e.g. in test suites), it is returned.
   * Otherwise, if Cloudflare D1 is available (Edge worker isolate with env.DB), D1RosterAdapter is used.
   * Defaults to PostgresRosterAdapter (Supabase) if D1 is not bound.
   *
   * Failsafe Tier 1: Instant Environment Kill-Switch (ROSTER_STORAGE_ENGINE)
   * If ROSTER_STORAGE_ENGINE is set to 'supabase' or 'postgres', bypasses D1 and uses Supabase.
   */
  async getStorage(): Promise<RosterStorageAdapter> {
    if (this.explicitAdapter) {
      return this.storage;
    }

    // Failsafe Tier 1: Instant Environment Kill-Switch
    let engine = process.env.ROSTER_STORAGE_ENGINE;
    if (!engine) {
      try {
        const { getCloudflareContext } = await import('@opennextjs/cloudflare');
        const ctx = await getCloudflareContext();
        engine = (ctx as any)?.env?.ROSTER_STORAGE_ENGINE;
      } catch {}
    }

    if (engine && (engine.toLowerCase() === 'supabase' || engine.toLowerCase() === 'postgres')) {
      return this.storage;
    }

    try {
      const d1 = await getD1Database();
      if (d1) {
        if (!this.cachedD1Adapter || this.cachedD1Db !== d1) {
          this.cachedD1Db = d1;
          this.cachedD1Adapter = new D1RosterAdapter(d1);
        }
        return this.cachedD1Adapter;
      }
    } catch (e) {
      console.warn('[MemberRosterService] Failed to resolve D1 database, falling back to default storage:', e);
    }

    return this.storage;
  }

  /**
   * Failsafe Tier 3: Circuit Breaker
   * Executes an operation against the primary resolved storage (e.g. D1).
   * If D1 throws an unhandled edge exception or lock error, catches it,
   * logs structured monitoring telemetry, and seamlessly falls back to PostgresRosterAdapter (Supabase).
   */
  private async executeWithCircuitBreaker<T>(
    operationName: string,
    action: (storage: RosterStorageAdapter) => Promise<T>
  ): Promise<T> {
    const primaryStorage = await this.getStorage();
    try {
      return await action(primaryStorage);
    } catch (primaryError: any) {
      if (primaryStorage instanceof D1RosterAdapter && this.storage && this.storage !== primaryStorage) {
        console.warn(
          `[CircuitBreaker] Primary D1 operation "${operationName}" failed. Seamlessly failing over to Supabase:`,
          primaryError?.message || primaryError
        );
        try {
          return await action(this.storage);
        } catch (fallbackError: any) {
          console.error(
            `[CircuitBreaker] Secondary Supabase fallback for "${operationName}" also failed:`,
            fallbackError?.message || fallbackError
          );
          throw primaryError;
        }
      }
      throw primaryError;
    }
  }

  /**
   * Resolves the Climber's membership pass, safety gate compliance, and verified SU record.
   */
  async resolveMemberPass(user: { id: string; email?: string | null; user_metadata?: any } | null): Promise<PassResolutionResult> {
    if (!user) {
      return {
        authenticated: false,
        user: null,
        profile: null,
        boundStudentId: null,
        suRecord: null,
        membership: null,
        safetyCheck: checkSafetyProfileCompleteness(null),
      };
    }

    return this.executeWithCircuitBreaker('resolveMemberPass', async (storage) => {
      let profile = await storage.findProfile(user.id);

      // Auto-heal profile or create initial row if missing
      const metaStudentId = user.user_metadata?.student_id;
      const existingOwner = metaStudentId ? await storage.findProfileByStudentId(metaStudentId) : null;
      const canClaimMetaId = Boolean(metaStudentId && (!existingOwner || existingOwner.id === user.id));

      if (profile) {
        const metaUni = user.user_metadata?.university;
        if ((!profile.student_id && canClaimMetaId) || (!profile.university && metaUni)) {
          const updates: Partial<Profile> = {};
          if (!profile.student_id && canClaimMetaId) updates.student_id = metaStudentId;
          if (!profile.university && metaUni) updates.university = metaUni;
          const healed = await storage.upsertProfile(user.id, updates);
          if (healed) profile = healed;
        }
      } else {
        profile = await storage.upsertProfile(user.id, {
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Climber',
          student_id: canClaimMetaId ? metaStudentId : null,
          university: user.user_metadata?.university || "King's College London",
          role: 0,
        });
      }

      // Determine active student ID
      let activeStudentId = profile?.student_id || null;
      if (!activeStudentId) {
        const linkedRecord = await storage.findRosterRecordByUserId(user.id);
        if (linkedRecord?.cardNumber) {
          activeStudentId = linkedRecord.cardNumber;
        }
      }

      let boundStudentId: string | null = null;
      let suRecord: KclsuMemberRecord | null = null;
      let membership: Membership | null = null;

      const safetyCheck = checkSafetyProfileCompleteness(profile);

      if (activeStudentId) {
        let cleanId = activeStudentId.trim().toUpperCase();
        if (/^\d{6,9}$/.test(cleanId)) {
          cleanId = `K${cleanId}`;
        }
        boundStudentId = cleanId;
        suRecord = await storage.findRosterRecord(cleanId);

        const recordOwnerId = (suRecord as any)?.user_id;
        if (suRecord && suRecord.suStatus !== 'revoked' && (!recordOwnerId || recordOwnerId === user.id)) {
          storage.bindRosterRecord(cleanId, user.id, suRecord).catch(() => {});
          membership = {
            id: suRecord.cardNumber,
            user_id: user.id,
            membership_number: suRecord.cardNumber,
            tier: suRecord.tier,
            valid_from: '2026-09-01',
            valid_until: '2027-08-31',
            payment_reference: suRecord.transactionId,
            is_active: true,
            created_at: new Date().toISOString(),
          };
        }
      }

      return {
        authenticated: true,
        user: {
          id: user.id,
          email: user.email,
          role: (user as any).role ?? profile?.role ?? getUserRole(user.email),
          fullName: profile?.full_name || user.user_metadata?.full_name,
        },
        profile,
        boundStudentId,
        suRecord,
        membership,
        safetyCheck,
      };
    });
  }

  /**
   * Updates climber safety profile notes (phone, emergency contact).
   */
  async updateSafetyNotes(userId: string, data: {
    university?: string;
    customUniversity?: string;
    phone?: string | null;
    emergencyName?: string | null;
    emergencyPhone?: string | null;
    dietary?: string | null;
  }): Promise<{ success: boolean; profile: Profile | null; safetyCheck: SafetyCompletenessResult }> {
    return this.executeWithCircuitBreaker('updateSafetyNotes', async (storage) => {
      const effectiveUniversity = sanitizeUniversity(
        data.university === 'Other UK Institution' ? data.customUniversity : data.university
      );

      const updatePayload: Partial<Profile> = {
        university: effectiveUniversity,
        phone: typeof data.phone === 'string' ? data.phone.trim().slice(0, 30) : null,
        emergency_contact_name: typeof data.emergencyName === 'string' ? data.emergencyName.trim().slice(0, 100) : null,
        emergency_contact_phone: typeof data.emergencyPhone === 'string' ? data.emergencyPhone.trim().slice(0, 30) : null,
        dietary_requirements: typeof data.dietary === 'string' ? data.dietary.trim().slice(0, 500) : null,
      };

      const updated = await storage.upsertProfile(userId, updatePayload);
      const safetyCheck = checkSafetyProfileCompleteness(updated);

      return {
        success: true,
        profile: updated,
        safetyCheck,
      };
    });
  }

  /**
   * Links a KCL student ID or Committee-issued Associate ID to an authenticated Climber account.
   */
  async linkStudentId(userId: string, rawStudentId: string): Promise<LinkMemberResult> {
    return this.executeWithCircuitBreaker('linkStudentId', async (storage) => {
      let cleanId = (rawStudentId || '').trim().toUpperCase();
      if (/^\d{6,9}$/.test(cleanId)) {
        cleanId = `K${cleanId}`;
      }

      if (!cleanId || cleanId.length > 32 || !/^[A-Z0-9_-]{3,32}$/.test(cleanId)) {
        return {
          success: false,
          statusCode: 400,
          error: 'Please provide a valid KCL Student ID (e.g. K25008223) or Associate ID (e.g. ASSOC-2601).',
        };
      }

      const safeDisplayId = cleanId.replace(/[^A-Z0-9_-]/g, '').slice(0, 32);

      // 1. Conflict check: already bound in profiles table?
      const existingProfile = await storage.findProfileByStudentId(cleanId);
      if (existingProfile && existingProfile.id !== userId) {
        return {
          success: false,
          statusCode: 409,
          error: `Student ID "${safeDisplayId}" is already linked to another KCLMC account. If this is your student ID, please contact kclmc.committee@gmail.com.`,
        };
      }

      // 2. Conflict check: already bound in kclsu_roster table?
      const existingRoster = await storage.findRosterRecord(cleanId);
      if ((existingRoster as any)?.user_id && (existingRoster as any).user_id !== userId) {
        return {
          success: false,
          statusCode: 409,
          error: `Student ID "${safeDisplayId}" is already linked to another KCLMC account. If this is your student ID, please contact kclmc.committee@gmail.com.`,
        };
      }

      // 3. Verify membership exists in official KCLSU / Associate records
      let memberRecord = existingRoster;
      if (!memberRecord) {
        memberRecord = findMemberByCardNumber(cleanId) || null;
      }

      if (!memberRecord) {
        return {
          success: false,
          statusCode: 404,
          error: `Student ID "${cleanId}" was not found in the official KCLSU purchase list. Please ensure you have purchased a 2026/27 membership on the KCLSU shop or received a valid Associate ID from the Committee.`,
        };
      }

      if (memberRecord.suStatus === 'revoked') {
        return {
          success: false,
          statusCode: 403,
          error: `Membership ID "${safeDisplayId}" has been revoked. Please contact kclmc.committee@gmail.com.`,
        };
      }

      // 4. Bind roster record and update profile
      await storage.bindRosterRecord(cleanId, userId, memberRecord);
      const profileUpdates: Partial<Profile> = {
        student_id: cleanId,
        full_name: memberRecord.name,
      };
      if (memberRecord.university) {
        profileUpdates.university = memberRecord.university;
      }
      await storage.upsertProfile(userId, profileUpdates);

      // 5. Emit activation telemetry
      trackServerEvent('membership_activated', {
        userId,
        cardNumber: cleanId,
        tier: memberRecord.tier,
        isAssociate: Boolean(memberRecord.isAssociate),
        academicYear: '2026/27',
      }).catch(() => {});

      return {
        success: true,
        statusCode: 200,
        member: memberRecord,
        message: memberRecord.isAssociate
          ? `Successfully linked Associate Member ID ${cleanId} to your account.`
          : `Successfully linked KCL Student ID ${cleanId} to your account.`,
      };
    });
  }

  /**
   * Lists the full roster directory joined with safety contacts (Committee access).
   */
  async listRoster(): Promise<{
    source: string;
    total: number;
    socialCount: number;
    recreationalCount: number;
    associateCount: number;
    awaitingSuCount: number;
    nextAssociateId: string;
    members: RosterMemberDirectoryItem[];
  }> {
    return this.executeWithCircuitBreaker('listRoster', async (storage) => {
      const result = await storage.listRosterWithProfiles();
      const associateCount = result.members.filter(m => m.isAssociate || !m.cardNumber.toUpperCase().startsWith('K')).length;
      const awaitingSuCount = result.members.filter(m => m.suStatus === 'awaiting_su').length;
      const nextAssociateId = generateNextAssociateId(result.members.map(m => m.cardNumber), '26');
      return {
        source: result.source,
        total: result.members.length,
        socialCount: result.socialCount,
        recreationalCount: result.recreationalCount,
        associateCount,
        awaitingSuCount,
        nextAssociateId,
        members: result.members,
      };
    });
  }

  /**
   * Verifies pass validity for wall scanner check-ins.
   */
  async verifyPass(identifier: string): Promise<PublicPassVerificationResult> {
    const clean = (identifier || '').trim();
    if (!clean) {
      return { valid: false, error: 'Missing membership ID', statusCode: 400 };
    }

    if (clean.length > 64) {
      return { valid: false, error: 'Invalid membership ID length', statusCode: 400 };
    }

    if (/[\0\r\n\t'"`;\\<>]/.test(clean)) {
      return { valid: false, error: 'Invalid membership ID characters', statusCode: 400 };
    }

    return this.executeWithCircuitBreaker('verifyPass', async (storage) => {
      return storage.verifyPublicPass(clean);
    });
  }

  /**
   * Ingests and synchronizes KCLSU roster records into storage.
   */
  async syncRoster(input: string | KclsuMemberRecord[]): Promise<{
    success: boolean;
    source: string;
    totalSynced: number;
    records: KclsuMemberRecord[];
    error?: string;
  }> {
    let records: KclsuMemberRecord[] = [];
    if (typeof input === 'string') {
      records = parseKclsuCsv(input);
    } else if (Array.isArray(input)) {
      records = input;
    }

    if (!records.length) {
      return {
        success: false,
        source: 'empty',
        totalSynced: 0,
        records: [],
        error: 'No valid KCLSU member records found in payload',
      };
    }

    return this.executeWithCircuitBreaker('syncRoster', async (storage) => {
      const { count, error } = await storage.upsertRosterRecords(records);
      if (error) {
        return {
          success: false,
          source: 'error',
          totalSynced: 0,
          records,
          error: typeof error === 'string' ? error : error?.message || 'Roster upsert failed',
        };
      }

      return {
        success: true,
        source: storage instanceof D1RosterAdapter ? 'cloudflare_d1' : (storage.isConfigured() ? 'supabase' : 'local_preview'),
        totalSynced: count,
        records,
      };
    });
  }

  /**
   * Manually edits and locks a member's full name in the roster,
   * shielding it from future CSV reconciliation overwrites.
   */
  async updateMemberName(cardNumber: string, fullName: string): Promise<{ success: boolean; error?: string }> {
    return this.executeWithCircuitBreaker('updateMemberName', async (storage) => {
      return storage.updateMemberName(cardNumber, fullName);
    });
  }

  /**
   * Creates a new Associate Member record (with auto-generated ASSOC-26XX or custom ID).
   */
  async createAssociateMember(input: CreateAssociateMemberInput): Promise<{
    success: boolean;
    member?: KclsuMemberRecord;
    error?: string;
  }> {
    if (!input.fullName || input.fullName.trim().length < 2) {
      return { success: false, error: 'Please provide the associate member\'s full name.' };
    }

    return this.executeWithCircuitBreaker('createAssociateMember', async (storage) => {
      const currentRoster = await storage.listRosterWithProfiles();
      const existingCards = currentRoster.members.map(m => m.cardNumber);
      const requestedId = input.customCardNumber || input.cardNumber;
      const cardNumber = requestedId && requestedId.trim()
        ? requestedId.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32)
        : generateNextAssociateId(existingCards, '26');

      if (!cardNumber || cardNumber.length < 3) {
        return { success: false, error: 'Invalid custom Associate ID format' };
      }

      const existing = await storage.findRosterRecord(cardNumber);
      if (existing) {
        return { success: false, error: `ID ${cardNumber} already exists in the roster` };
      }

      const cleanName = input.fullName.trim();
      const tier: 'social' | 'recreational' = input.tier === 'recreational' ? 'recreational' : 'social';
      const suStatus: SuProcessingStatus = input.suStatus || 'awaiting_su';
      const productName = tier === 'recreational'
        ? 'KCL Mountaineering Associate Recreational Membership 2026/27'
        : 'KCL Mountaineering Associate Social Membership 2026/27';
      const txId = input.transactionId?.trim() || `MANUAL-${cardNumber}`;
      const purchaseDate = new Date().toLocaleDateString('en-GB');

      const record: KclsuMemberRecord = {
        name: cleanName,
        rawPurchaser: cleanName,
        cardNumber,
        productName,
        tier,
        purchaseDate,
        transactionId: txId,
        isAssociate: true,
        email: input.email ? sanitizeEmail(input.email) : null,
        university: input.university ? sanitizeUniversity(input.university) : 'Alumni / Associate / Guest',
        suStatus,
      };

      return storage.createAssociateRecord(record);
    });
  }

  /**
   * Updates an existing roster/associate member (tier upgrade, status, email, university, name).
   */
  async updateRosterMember(cardNumber: string, updates: UpdateRosterMemberInput): Promise<{
    success: boolean;
    member?: KclsuMemberRecord;
    error?: string;
  }> {
    if (!cardNumber || !cardNumber.trim()) {
      return { success: false, error: 'Card number / Member ID is required.' };
    }
    return this.executeWithCircuitBreaker('updateRosterMember', async (storage) => {
      return storage.updateRosterMember(cardNumber, updates);
    });
  }

  /**
   * Deletes a roster/associate member record.
   */
  async deleteRosterMember(cardNumber: string): Promise<{ success: boolean; error?: string }> {
    if (!cardNumber || !cardNumber.trim()) {
      return { success: false, error: 'Card number / Member ID is required.' };
    }
    return this.executeWithCircuitBreaker('deleteRosterMember', async (storage) => {
      return storage.deleteRosterMember(cardNumber);
    });
  }
}

export const memberRoster = new MemberRosterService();

