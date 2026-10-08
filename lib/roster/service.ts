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
} from '@/lib/roster';
import { checkSafetyProfileCompleteness, SafetyCompletenessResult } from '@/lib/safety';
import { sanitizeUniversity } from '@/lib/auth';
import type { Profile, Membership } from '@/types/database';
import { createClient, createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { trackServerEvent } from '@/lib/telemetry-server';

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
  university?: string;
  safetyComplete: boolean;
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
          return {
            cardNumber: rowFromUser.card_number,
            name: rowFromUser.full_name,
            rawPurchaser: rowFromUser.raw_purchaser || '',
            tier: rowFromUser.tier,
            productName: rowFromUser.product_name,
            transactionId: rowFromUser.transaction_id,
            purchaseDate: rowFromUser.purchase_date || '',
          };
        }

        const admin = createAdminClient();
        const { data: rowFromAdmin } = await admin
          .from('kclsu_roster')
          .select('*')
          .eq('card_number', cleanId)
          .maybeSingle();

        if (rowFromAdmin) {
          return {
            cardNumber: rowFromAdmin.card_number,
            name: rowFromAdmin.full_name,
            rawPurchaser: rowFromAdmin.raw_purchaser || '',
            tier: rowFromAdmin.tier,
            productName: rowFromAdmin.product_name,
            transactionId: rowFromAdmin.transaction_id,
            purchaseDate: rowFromAdmin.purchase_date || '',
          };
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
        return {
          cardNumber: rowFromUser.card_number,
          name: rowFromUser.full_name,
          rawPurchaser: rowFromUser.raw_purchaser || '',
          tier: rowFromUser.tier,
          productName: rowFromUser.product_name,
          transactionId: rowFromUser.transaction_id,
          purchaseDate: rowFromUser.purchase_date || '',
        };
      }

      const admin = createAdminClient();
      const { data: rowFromAdmin } = await admin
        .from('kclsu_roster')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (rowFromAdmin) {
        return {
          cardNumber: rowFromAdmin.card_number,
          name: rowFromAdmin.full_name,
          rawPurchaser: rowFromAdmin.raw_purchaser || '',
          tier: rowFromAdmin.tier,
          productName: rowFromAdmin.product_name,
          transactionId: rowFromAdmin.transaction_id,
          purchaseDate: rowFromAdmin.purchase_date || '',
        };
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
      .select('id, student_id, phone, emergency_contact_name, emergency_contact_phone, university');

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

      return {
        cardNumber: row.card_number,
        name: row.full_name,
        rawPurchaser: row.raw_purchaser,
        tier: row.tier,
        productName: row.product_name,
        transactionId: row.transaction_id,
        purchaseDate: row.purchase_date || '',
        userId: row.user_id,
        phone: prof?.phone || null,
        emergencyContactName: prof?.emergency_contact_name || null,
        emergencyContactPhone: prof?.emergency_contact_phone || null,
        university: prof?.university || "King's College London",
        safetyComplete,
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

      return {
        ...r,
        phone: matchedProf?.phone || null,
        emergencyContactName: matchedProf?.emergency_contact_name || null,
        emergencyContactPhone: matchedProf?.emergency_contact_phone || null,
        university: matchedProf?.university || "King's College London",
        safetyComplete: hasPhone && hasEmergency,
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
    records.forEach(r => this.rosterMap.set(r.cardNumber.toUpperCase(), r));
    return { count: records.length };
  }
}

/**
 * Deep MemberRosterService
 */
export class MemberRosterService {
  constructor(private storage: RosterStorageAdapter = new PostgresRosterAdapter()) {}

  /**
   * Sets the active storage adapter (useful for testing or swapping to in-memory mode)
   */
  setStorageAdapter(adapter: RosterStorageAdapter): void {
    this.storage = adapter;
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

    let profile = await this.storage.findProfile(user.id);

    // Auto-heal profile or create initial row if missing
    if (profile) {
      const metaStudentId = user.user_metadata?.student_id;
      const metaUni = user.user_metadata?.university;
      if ((!profile.student_id && metaStudentId) || (!profile.university && metaUni)) {
        const updates: Partial<Profile> = {};
        if (!profile.student_id && metaStudentId) updates.student_id = metaStudentId;
        if (!profile.university && metaUni) updates.university = metaUni;
        const healed = await this.storage.upsertProfile(user.id, updates);
        if (healed) profile = healed;
      }
    } else {
      profile = await this.storage.upsertProfile(user.id, {
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Climber',
        student_id: user.user_metadata?.student_id || null,
        university: user.user_metadata?.university || "King's College London",
        role: 0,
      });
    }

    // Determine active student ID
    let activeStudentId = profile?.student_id || user.user_metadata?.student_id || null;
    if (!activeStudentId) {
      const linkedRecord = await this.storage.findRosterRecordByUserId(user.id);
      if (linkedRecord?.cardNumber) {
        activeStudentId = linkedRecord.cardNumber;
      }
    }

    let boundStudentId: string | null = null;
    let suRecord: KclsuMemberRecord | null = null;
    let membership: Membership | null = null;

    if (activeStudentId) {
      const cleanId = activeStudentId.trim().toUpperCase();
      boundStudentId = cleanId;
      suRecord = await this.storage.findRosterRecord(cleanId);

      if (suRecord) {
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

    const safetyCheck = checkSafetyProfileCompleteness(profile);

    return {
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        role: profile?.role ?? 0,
        fullName: profile?.full_name || user.user_metadata?.full_name,
      },
      profile,
      boundStudentId,
      suRecord,
      membership,
      safetyCheck,
    };
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

    const updated = await this.storage.upsertProfile(userId, updatePayload);
    const safetyCheck = checkSafetyProfileCompleteness(updated);

    return {
      success: true,
      profile: updated,
      safetyCheck,
    };
  }

  /**
   * Links a KCL student ID to an authenticated Climber account.
   */
  async linkStudentId(userId: string, rawStudentId: string): Promise<LinkMemberResult> {
    const cleanId = (rawStudentId || '').trim().toUpperCase();

    if (!cleanId || cleanId.length > 32 || !/^[A-Z0-9_-]{3,32}$/.test(cleanId)) {
      return {
        success: false,
        statusCode: 400,
        error: 'Please provide a valid KCL Student ID (e.g. K25008223).',
      };
    }

    const safeDisplayId = cleanId.replace(/[^A-Z0-9_-]/g, '').slice(0, 32);

    // 1. Conflict check: already bound in profiles table?
    const existingProfile = await this.storage.findProfileByStudentId(cleanId);
    if (existingProfile && existingProfile.id !== userId) {
      return {
        success: false,
        statusCode: 409,
        error: `Student ID "${safeDisplayId}" is already linked to another KCLMC account. If this is your student ID, please contact kclmc.committee@gmail.com.`,
      };
    }

    // 2. Conflict check: already bound in kclsu_roster table?
    const existingRoster = await this.storage.findRosterRecord(cleanId);
    if ((existingRoster as any)?.user_id && (existingRoster as any).user_id !== userId) {
      return {
        success: false,
        statusCode: 409,
        error: `Student ID "${safeDisplayId}" is already linked to another KCLMC account. If this is your student ID, please contact kclmc.committee@gmail.com.`,
      };
    }

    // 3. Verify membership exists in official KCLSU records
    let memberRecord = existingRoster;
    if (!memberRecord) {
      memberRecord = findMemberByCardNumber(cleanId) || null;
    }

    if (!memberRecord) {
      return {
        success: false,
        statusCode: 404,
        error: `Student ID "${cleanId}" was not found in the official KCLSU purchase list. Please ensure you have purchased a 2026/27 membership on the KCLSU shop.`,
      };
    }

    // 4. Bind roster record and update profile
    await this.storage.bindRosterRecord(cleanId, userId, memberRecord);
    await this.storage.upsertProfile(userId, {
      student_id: cleanId,
      full_name: memberRecord.name,
    });

    // 5. Emit activation telemetry
    trackServerEvent('membership_activated', {
      userId,
      cardNumber: cleanId,
      tier: memberRecord.tier,
      academicYear: '2026/27',
    }).catch(() => {});

    return {
      success: true,
      statusCode: 200,
      member: memberRecord,
      message: `Successfully linked KCL Student ID ${cleanId} to your account.`,
    };
  }

  /**
   * Lists the full roster directory joined with safety contacts (Committee access).
   */
  async listRoster(): Promise<{
    source: string;
    total: number;
    socialCount: number;
    recreationalCount: number;
    members: RosterMemberDirectoryItem[];
  }> {
    const result = await this.storage.listRosterWithProfiles();
    return {
      source: result.source,
      total: result.members.length,
      socialCount: result.socialCount,
      recreationalCount: result.recreationalCount,
      members: result.members,
    };
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

    return this.storage.verifyPublicPass(clean);
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

    const { count, error } = await this.storage.upsertRosterRecords(records);
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
      source: this.storage.isConfigured() ? 'supabase' : 'local_preview',
      totalSynced: count,
      records,
    };
  }
}

export const memberRoster = new MemberRosterService();
