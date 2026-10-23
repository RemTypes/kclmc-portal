/**
 * KCLMC Platform - Cloudflare D1 Roster Storage Adapter
 * 
 * Implements RosterStorageAdapter for Cloudflare D1 (SQLite at the edge).
 * Provides fast, sub-millisecond edge queries with zero connection pool limits.
 */

import {
  RosterStorageAdapter,
  RosterMemberDirectoryItem,
  CreateAssociateMemberInput,
  UpdateRosterMemberInput,
  PublicPassVerificationResult,
} from './service';
import { KclsuMemberRecord, isCompleteFullName } from '@/lib/roster';
import type { Profile, SuProcessingStatus } from '@/types/database';
import { D1Database, getD1Database } from '@/lib/db/d1';
import { isAssociateId } from '@/lib/auth';

export class D1RosterAdapter implements RosterStorageAdapter {
  private db: D1Database | null;

  constructor(customDb?: D1Database | null) {
    this.db = customDb ?? null;
  }

  private async getDb(): Promise<D1Database> {
    if (this.db) return this.db;
    const resolved = await getD1Database();
    if (!resolved) {
      throw new Error('Cloudflare D1 database is not bound or available in this runtime');
    }
    return resolved;
  }

  isConfigured(): boolean {
    return true;
  }

  async findProfile(userId: string): Promise<Profile | null> {
    const db = await this.getDb();
    const row = await db
      .prepare('SELECT * FROM profiles WHERE id = ?')
      .bind(userId)
      .first<any>();

    if (!row) return null;
    return this.mapProfile(row);
  }

  async findProfileByStudentId(studentId: string): Promise<Profile | null> {
    const db = await this.getDb();
    const cleanId = studentId.trim().toUpperCase();
    const row = await db
      .prepare('SELECT * FROM profiles WHERE UPPER(student_id) = ?')
      .bind(cleanId)
      .first<any>();

    if (!row) return null;
    return this.mapProfile(row);
  }

  async upsertProfile(userId: string, data: Partial<Profile>): Promise<Profile | null> {
    const db = await this.getDb();
    const existing = await this.findProfile(userId);

    const full_name = data.full_name ?? existing?.full_name ?? '';
    const student_id = data.student_id ?? existing?.student_id ?? null;
    const university = data.university ?? existing?.university ?? "King's College London";
    const phone = data.phone ?? existing?.phone ?? null;
    const emergency_contact_name = data.emergency_contact_name ?? existing?.emergency_contact_name ?? null;
    const emergency_contact_phone = data.emergency_contact_phone ?? existing?.emergency_contact_phone ?? null;
    const dietary_requirements = data.dietary_requirements ?? existing?.dietary_requirements ?? null;
    const medical_notes = data.medical_notes ?? existing?.medical_notes ?? null;
    const role = data.role ?? existing?.role ?? 0;
    const avatar_url = data.avatar_url ?? existing?.avatar_url ?? null;
    const now = new Date().toISOString();

    await db
      .prepare(`
        INSERT INTO profiles (
          id, full_name, student_id, university, phone,
          emergency_contact_name, emergency_contact_phone,
          dietary_requirements, medical_notes, role, avatar_url,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          full_name = excluded.full_name,
          student_id = excluded.student_id,
          university = excluded.university,
          phone = excluded.phone,
          emergency_contact_name = excluded.emergency_contact_name,
          emergency_contact_phone = excluded.emergency_contact_phone,
          dietary_requirements = excluded.dietary_requirements,
          medical_notes = excluded.medical_notes,
          role = excluded.role,
          avatar_url = excluded.avatar_url,
          updated_at = excluded.updated_at
      `)
      .bind(
        userId, full_name, student_id, university, phone,
        emergency_contact_name, emergency_contact_phone,
        dietary_requirements, medical_notes, role, avatar_url,
        now, now
      )
      .run();

    return this.findProfile(userId);
  }

  async findRosterRecord(cardNumber: string): Promise<KclsuMemberRecord | null> {
    const db = await this.getDb();
    const cleanId = cardNumber.trim().toUpperCase();
    const row = await db
      .prepare('SELECT * FROM kclsu_roster WHERE UPPER(card_number) = ?')
      .bind(cleanId)
      .first<any>();

    if (!row) return null;
    return this.mapRosterRecord(row);
  }

  async findRosterRecordByUserId(userId: string): Promise<KclsuMemberRecord | null> {
    const db = await this.getDb();
    const row = await db
      .prepare('SELECT * FROM kclsu_roster WHERE user_id = ?')
      .bind(userId)
      .first<any>();

    if (!row) return null;
    return this.mapRosterRecord(row);
  }

  async bindRosterRecord(cardNumber: string, userId: string, memberData?: KclsuMemberRecord): Promise<void> {
    const db = await this.getDb();
    const cleanId = cardNumber.trim().toUpperCase();
    const now = new Date().toISOString();

    if (memberData) {
      await db
        .prepare(`
          INSERT INTO kclsu_roster (
            id, card_number, full_name, raw_purchaser, tier,
            product_name, transaction_id, purchase_date, academic_year,
            user_id, is_associate, member_email, university, su_status,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '2026/27', ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(card_number) DO UPDATE SET
            user_id = excluded.user_id,
            updated_at = excluded.updated_at
        `)
        .bind(
          crypto.randomUUID(), cleanId, memberData.name, memberData.rawPurchaser,
          memberData.tier, memberData.productName, memberData.transactionId,
          memberData.purchaseDate, userId,
          memberData.isAssociate ? 1 : 0,
          memberData.email ?? null,
          memberData.university ?? null,
          memberData.suStatus ?? 'verified',
          now, now
        )
        .run();
    } else {
      await db
        .prepare('UPDATE kclsu_roster SET user_id = ?, updated_at = ? WHERE UPPER(card_number) = ?')
        .bind(userId, now, cleanId)
        .run();
    }
  }

  async listRosterWithProfiles(): Promise<{
    source: string;
    members: RosterMemberDirectoryItem[];
    socialCount: number;
    recreationalCount: number;
  }> {
    const db = await this.getDb();
    const query = `
      SELECT 
        r.card_number,
        r.full_name,
        r.raw_purchaser,
        r.tier,
        r.product_name,
        r.transaction_id,
        r.purchase_date,
        r.user_id,
        r.is_associate,
        r.member_email,
        r.university,
        r.su_status,
        p.full_name AS profile_full_name,
        p.phone,
        p.emergency_contact_name,
        p.emergency_contact_phone
      FROM kclsu_roster r
      LEFT JOIN profiles p ON (r.user_id = p.id) OR (r.user_id IS NULL AND p.student_id = r.card_number)
      ORDER BY r.purchase_date DESC
    `;

    const { results } = await db.prepare(query).all<any>();
    const members: RosterMemberDirectoryItem[] = (results || []).map(row => {
      const card = String(row.card_number || '').trim().toUpperCase();
      const hasPhone = Boolean(row.phone && row.phone.trim().length >= 8);
      const hasEmergency = Boolean(
        row.emergency_contact_name &&
        row.emergency_contact_name.trim().length >= 2 &&
        row.emergency_contact_phone &&
        row.emergency_contact_phone.trim().length >= 8
      );
      const isAssoc = Boolean(row.is_associate || isAssociateId(card));
      const rosterNameHasFull = isCompleteFullName(row.full_name);
      const profileNameHasFull = isCompleteFullName(row.profile_full_name);
      const resolvedName = rosterNameHasFull ? row.full_name : (profileNameHasFull ? row.profile_full_name : row.full_name);

      return {
        cardNumber: card,
        name: resolvedName,
        rawPurchaser: row.raw_purchaser || '',
        tier: row.tier as 'social' | 'recreational',
        productName: row.product_name,
        transactionId: row.transaction_id,
        purchaseDate: row.purchase_date || '',
        userId: row.user_id || null,
        phone: row.phone || null,
        emergencyContactName: row.emergency_contact_name || null,
        emergencyContactPhone: row.emergency_contact_phone || null,
        university: row.university || (isAssoc ? 'Associate Member' : "King's College London"),
        safetyComplete: hasPhone && hasEmergency,
        isAssociate: isAssoc,
        email: row.member_email || null,
        suStatus: (row.su_status as SuProcessingStatus) || 'verified',
      };
    });

    const socialCount = members.filter(m => m.tier === 'social').length;
    const recreationalCount = members.filter(m => m.tier === 'recreational').length;

    return {
      source: 'cloudflare_d1',
      members,
      socialCount,
      recreationalCount,
    };
  }

  async verifyPublicPass(identifier: string): Promise<PublicPassVerificationResult> {
    const db = await this.getDb();
    const cleanId = identifier.trim().toUpperCase();

    const row = await db
      .prepare(`
        SELECT * FROM kclsu_roster
        WHERE UPPER(card_number) = ? OR UPPER(transaction_id) = ? OR user_id = ?
        LIMIT 1
      `)
      .bind(cleanId, cleanId, identifier)
      .first<any>();

    if (!row) {
      return { valid: false, error: 'Member not found on official KCLSU roster', statusCode: 404 };
    }

    if (row.su_status === 'revoked') {
      return { valid: false, error: 'Membership revoked by committee or Students Union', statusCode: 403 };
    }

    const isAssoc = Boolean(row.is_associate || isAssociateId(row.card_number));

    return {
      valid: true,
      statusCode: 200,
      member: {
        name: row.full_name,
        tier: row.tier,
        membership_number: row.card_number,
        student_id: row.card_number,
        expires: '2027-07-31',
        transaction_id: row.transaction_id,
        product_name: row.product_name,
        source: 'cloudflare_d1',
        userId: row.user_id,
        isAssociate: isAssoc,
        suStatus: (row.su_status as SuProcessingStatus) || 'verified',
      },
    };
  }

  async upsertRosterRecords(records: KclsuMemberRecord[]): Promise<{ count: number; error?: any }> {
    const db = await this.getDb();
    let count = 0;
    const now = new Date().toISOString();

    for (const record of records) {
      const cleanId = record.cardNumber.trim().toUpperCase();
      const isAssoc = record.isAssociate || isAssociateId(cleanId);

      await db
        .prepare(`
          INSERT INTO kclsu_roster (
            id, card_number, full_name, raw_purchaser, tier,
            product_name, transaction_id, purchase_date, academic_year,
            is_associate, member_email, university, su_status,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '2026/27', ?, ?, ?, ?, ?, ?)
          ON CONFLICT(card_number) DO UPDATE SET
            full_name = excluded.full_name,
            raw_purchaser = excluded.raw_purchaser,
            tier = excluded.tier,
            product_name = excluded.product_name,
            transaction_id = excluded.transaction_id,
            purchase_date = excluded.purchase_date,
            updated_at = excluded.updated_at
        `)
        .bind(
          crypto.randomUUID(), cleanId, record.name, record.rawPurchaser,
          record.tier, record.productName, record.transactionId,
          record.purchaseDate, isAssoc ? 1 : 0,
          record.email ?? null, record.university ?? null,
          record.suStatus ?? 'verified', now, now
        )
        .run();
      count++;
    }

    return { count };
  }

  async updateMemberName(cardNumber: string, fullName: string): Promise<{ success: boolean; error?: string }> {
    const db = await this.getDb();
    const cleanId = cardNumber.trim().toUpperCase();
    const cleanName = fullName.trim();
    if (!cleanName) return { success: false, error: 'Full name cannot be blank' };

    const res = await db
      .prepare('UPDATE kclsu_roster SET full_name = ?, updated_at = ? WHERE UPPER(card_number) = ?')
      .bind(cleanName, new Date().toISOString(), cleanId)
      .run();

    return { success: res.success };
  }

  async createAssociateRecord(record: KclsuMemberRecord): Promise<{ success: boolean; member?: KclsuMemberRecord; error?: string }> {
    const db = await this.getDb();
    const cleanId = record.cardNumber.trim().toUpperCase();
    const now = new Date().toISOString();

    const existing = await this.findRosterRecord(cleanId);
    if (existing) {
      return { success: false, error: `Member with ID ${cleanId} already exists` };
    }

    await db
      .prepare(`
        INSERT INTO kclsu_roster (
          id, card_number, full_name, raw_purchaser, tier,
          product_name, transaction_id, purchase_date, academic_year,
          is_associate, member_email, university, su_status,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '2026/27', 1, ?, ?, ?, ?, ?)
      `)
      .bind(
        crypto.randomUUID(), cleanId, record.name, record.rawPurchaser,
        record.tier, record.productName, record.transactionId,
        record.purchaseDate, record.email ?? null, record.university ?? null,
        record.suStatus ?? 'verified', now, now
      )
      .run();

    const created = await this.findRosterRecord(cleanId);
    return { success: true, member: created ?? record };
  }

  async updateRosterMember(cardNumber: string, updates: UpdateRosterMemberInput): Promise<{ success: boolean; member?: KclsuMemberRecord; error?: string }> {
    const db = await this.getDb();
    const cleanId = cardNumber.trim().toUpperCase();
    const setClauses: string[] = ['updated_at = ?'];
    const values: any[] = [new Date().toISOString()];

    if (updates.fullName !== undefined) {
      setClauses.push('full_name = ?');
      values.push(updates.fullName.trim());
    }
    if (updates.tier !== undefined) {
      setClauses.push('tier = ?');
      values.push(updates.tier);
    }
    if (updates.email !== undefined) {
      setClauses.push('member_email = ?');
      values.push(updates.email?.trim() || null);
    }
    if (updates.university !== undefined) {
      setClauses.push('university = ?');
      values.push(updates.university?.trim() || null);
    }
    if (updates.suStatus !== undefined) {
      setClauses.push('su_status = ?');
      values.push(updates.suStatus);
    }

    values.push(cleanId);

    const query = `UPDATE kclsu_roster SET ${setClauses.join(', ')} WHERE UPPER(card_number) = ?`;
    const res = await db.prepare(query).bind(...values).run();

    if (!res.success) {
      return { success: false, error: 'Failed to update roster member in D1' };
    }

    const updated = await this.findRosterRecord(cleanId);
    return { success: true, member: updated ?? undefined };
  }

  async deleteRosterMember(cardNumber: string): Promise<{ success: boolean; error?: string }> {
    const db = await this.getDb();
    const cleanId = cardNumber.trim().toUpperCase();
    const res = await db
      .prepare('DELETE FROM kclsu_roster WHERE UPPER(card_number) = ?')
      .bind(cleanId)
      .run();

    return { success: res.success };
  }

  private mapProfile(row: any): Profile {
    return {
      id: row.id,
      full_name: row.full_name || '',
      student_id: row.student_id || null,
      university: row.university || "King's College London",
      phone: row.phone || null,
      emergency_contact_name: row.emergency_contact_name || null,
      emergency_contact_phone: row.emergency_contact_phone || null,
      dietary_requirements: row.dietary_requirements || null,
      medical_notes: row.medical_notes || null,
      role: (row.role ?? 0) as any,
      avatar_url: row.avatar_url || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private mapRosterRecord(row: any): KclsuMemberRecord & { user_id?: string | null } {
    const card = String(row.card_number || '').trim().toUpperCase();
    const isAssoc = Boolean(row.is_associate || isAssociateId(card));
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
}
