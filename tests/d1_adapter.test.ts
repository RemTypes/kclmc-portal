import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { D1RosterAdapter } from '@/lib/roster/d1-adapter';
import { D1Database, D1PreparedStatement, setD1DatabaseOverride } from '@/lib/db/d1';
import { MemberRosterService } from '@/lib/roster/service';
import { KclsuMemberRecord } from '@/lib/roster';

/**
 * Lightweight in-memory D1 test mock implementation
 */
class MockD1Database implements D1Database {
  public tables: Record<string, any[]> = {
    profiles: [],
    kclsu_roster: [],
  };

  prepare(query: string): D1PreparedStatement {
    return new MockD1PreparedStatement(query, this);
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<Array<{ results?: T[]; success: boolean; meta?: any }>> {
    const results: any[] = [];
    for (const stmt of statements) {
      results.push(await stmt.all());
    }
    return results;
  }

  async exec(query: string): Promise<{ count: number; duration: number }> {
    return { count: 0, duration: 1 };
  }
}

class MockD1PreparedStatement implements D1PreparedStatement {
  private boundValues: any[] = [];

  constructor(private query: string, private db: MockD1Database) {}

  bind(...values: any[]): D1PreparedStatement {
    this.boundValues = values;
    return this;
  }

  async first<T = unknown>(colName?: string): Promise<T | null> {
    const { results } = await this.all<T>();
    return results.length > 0 ? results[0] : null;
  }

  async all<T = unknown>(): Promise<{ results: T[]; success: boolean; meta?: any }> {
    const q = this.query.trim();

    // SELECT * FROM profiles WHERE id = ?
    if (q.includes('FROM profiles WHERE id = ?')) {
      const id = this.boundValues[0];
      const match = this.db.tables.profiles.find(p => p.id === id);
      return { results: match ? [match as any] : [], success: true };
    }

    // SELECT * FROM profiles WHERE UPPER(student_id) = ?
    if (q.includes('FROM profiles WHERE UPPER(student_id) = ?')) {
      const studentId = String(this.boundValues[0]).toUpperCase();
      const match = this.db.tables.profiles.find(p => p.student_id && String(p.student_id).toUpperCase() === studentId);
      return { results: match ? [match as any] : [], success: true };
    }

    // SELECT * FROM kclsu_roster WHERE UPPER(card_number) = ?
    if (q.includes('FROM kclsu_roster WHERE UPPER(card_number) = ?')) {
      const card = String(this.boundValues[0]).toUpperCase();
      const match = this.db.tables.kclsu_roster.find(r => String(r.card_number).toUpperCase() === card);
      return { results: match ? [match as any] : [], success: true };
    }

    // SELECT * FROM kclsu_roster WHERE user_id = ?
    if (q.includes('FROM kclsu_roster WHERE user_id = ?')) {
      const uid = this.boundValues[0];
      const match = this.db.tables.kclsu_roster.find(r => r.user_id === uid);
      return { results: match ? [match as any] : [], success: true };
    }

    // verifyPublicPass query
    if (q.includes('WHERE UPPER(card_number) = ? OR UPPER(transaction_id) = ? OR user_id = ?')) {
      const [c1, c2, uid] = this.boundValues;
      const match = this.db.tables.kclsu_roster.find(
        r => String(r.card_number).toUpperCase() === c1 ||
             String(r.transaction_id).toUpperCase() === c2 ||
             r.user_id === uid
      );
      return { results: match ? [match as any] : [], success: true };
    }

    // listRosterWithProfiles join query
    if (q.includes('FROM kclsu_roster r') && q.includes('LEFT JOIN profiles p')) {
      const joined = this.db.tables.kclsu_roster.map(r => {
        const prof = this.db.tables.profiles.find(p => (r.user_id && p.id === r.user_id) || (!r.user_id && p.student_id === r.card_number)) || {};
        return {
          ...r,
          profile_full_name: prof.full_name || null,
          phone: prof.phone || null,
          emergency_contact_name: prof.emergency_contact_name || null,
          emergency_contact_phone: prof.emergency_contact_phone || null,
        };
      });
      return { results: joined as any, success: true };
    }

    return { results: [], success: true };
  }

  async run(): Promise<{ success: boolean; meta?: any }> {
    const q = this.query.trim();

    // INSERT INTO profiles
    if (q.includes('INSERT INTO profiles')) {
      const [
        id, full_name, student_id, university, phone,
        emergency_contact_name, emergency_contact_phone,
        dietary_requirements, medical_notes, role, avatar_url,
        created_at, updated_at
      ] = this.boundValues;

      const idx = this.db.tables.profiles.findIndex(p => p.id === id);
      const row = {
        id, full_name, student_id, university, phone,
        emergency_contact_name, emergency_contact_phone,
        dietary_requirements, medical_notes, role, avatar_url,
        created_at, updated_at
      };

      if (idx >= 0) {
        this.db.tables.profiles[idx] = { ...this.db.tables.profiles[idx], ...row };
      } else {
        this.db.tables.profiles.push(row);
      }
      return { success: true };
    }

    // INSERT INTO kclsu_roster
    if (q.includes('INSERT INTO kclsu_roster')) {
      const [
        id, card_number, full_name, raw_purchaser, tier,
        product_name, transaction_id, purchase_date, academic_year_or_uid,
        user_id_or_assoc, is_associate, member_email, university, su_status,
        created_at, updated_at
      ] = this.boundValues;

      const card = String(card_number).toUpperCase();
      const existingIdx = this.db.tables.kclsu_roster.findIndex(r => String(r.card_number).toUpperCase() === card);

      const row = {
        id,
        card_number: card,
        full_name,
        raw_purchaser,
        tier,
        product_name,
        transaction_id,
        purchase_date,
        academic_year: '2026/27',
        user_id: user_id_or_assoc && typeof user_id_or_assoc === 'string' ? user_id_or_assoc : null,
        is_associate: is_associate ?? 0,
        member_email: member_email ?? null,
        university: university ?? null,
        su_status: su_status ?? 'verified',
        created_at: created_at || new Date().toISOString(),
        updated_at: updated_at || new Date().toISOString(),
      };

      if (existingIdx >= 0) {
        this.db.tables.kclsu_roster[existingIdx] = { ...this.db.tables.kclsu_roster[existingIdx], ...row };
      } else {
        this.db.tables.kclsu_roster.push(row);
      }
      return { success: true };
    }

    // UPDATE kclsu_roster SET user_id = ?
    if (q.includes('UPDATE kclsu_roster SET user_id = ?')) {
      const [userId, updatedAt, card] = this.boundValues;
      const match = this.db.tables.kclsu_roster.find(r => String(r.card_number).toUpperCase() === String(card).toUpperCase());
      if (match) {
        match.user_id = userId;
        match.updated_at = updatedAt;
      }
      return { success: true };
    }

    // UPDATE kclsu_roster SET full_name = ?
    if (q.includes('UPDATE kclsu_roster SET full_name = ?')) {
      const [fullName, updatedAt, card] = this.boundValues;
      const match = this.db.tables.kclsu_roster.find(r => String(r.card_number).toUpperCase() === String(card).toUpperCase());
      if (match) {
        match.full_name = fullName;
        match.updated_at = updatedAt;
      }
      return { success: true };
    }

    // Dynamic UPDATE kclsu_roster
    if (q.includes('UPDATE kclsu_roster SET') && !q.includes('user_id = ?') && !q.includes('full_name = ?')) {
      const card = this.boundValues[this.boundValues.length - 1];
      const match = this.db.tables.kclsu_roster.find(r => String(r.card_number).toUpperCase() === String(card).toUpperCase());
      if (match) {
        if (q.includes('tier = ?')) {
          const tierIdx = this.boundValues.findIndex(v => v === 'recreational' || v === 'social');
          if (tierIdx >= 0) match.tier = this.boundValues[tierIdx];
        }
        if (q.includes('su_status = ?')) {
          const statusVal = this.boundValues.find(v => ['verified', 'awaiting_su', 'revoked'].includes(v));
          if (statusVal) match.su_status = statusVal;
        }
      }
      return { success: true };
    }

    // DELETE FROM kclsu_roster
    if (q.includes('DELETE FROM kclsu_roster WHERE UPPER(card_number) = ?')) {
      const card = String(this.boundValues[0]).toUpperCase();
      this.db.tables.kclsu_roster = this.db.tables.kclsu_roster.filter(r => String(r.card_number).toUpperCase() !== card);
      return { success: true };
    }

    return { success: true };
  }
}

describe('Cloudflare D1 Roster Storage Adapter (D1RosterAdapter)', () => {
  let mockDb: MockD1Database;
  let adapter: D1RosterAdapter;

  beforeEach(() => {
    mockDb = new MockD1Database();
    adapter = new D1RosterAdapter(mockDb);
  });

  it('isConfigured returns true', () => {
    expect(adapter.isConfigured()).toBe(true);
  });

  it('upserts and retrieves profile by userId and studentId', async () => {
    const profile = await adapter.upsertProfile('user-1', {
      full_name: 'Alex Honnold',
      student_id: 'K26122068',
      phone: '+447911123456',
      role: 0,
    });

    expect(profile).toBeDefined();
    expect(profile?.full_name).toBe('Alex Honnold');
    expect(profile?.student_id).toBe('K26122068');

    const byId = await adapter.findProfile('user-1');
    expect(byId?.full_name).toBe('Alex Honnold');

    const byStudent = await adapter.findProfileByStudentId('k26122068');
    expect(byStudent?.id).toBe('user-1');
  });

  it('creates an associate member record and prevents duplicates', async () => {
    const assocRecord: KclsuMemberRecord = {
      cardNumber: 'ASSOC-2601',
      name: 'Lynn Hill',
      rawPurchaser: 'Lynn Hill',
      tier: 'recreational',
      productName: 'KCL Mountaineering Associate Recreational Membership 2026/27',
      transactionId: 'TX-ASSOC-1',
      purchaseDate: '23/10/2026',
      isAssociate: true,
      email: 'lynn@alumni.kcl.ac.uk',
      university: 'KCL Alumni',
      suStatus: 'awaiting_su',
    };

    const result = await adapter.createAssociateRecord(assocRecord);
    expect(result.success).toBe(true);
    expect(result.member?.cardNumber).toBe('ASSOC-2601');

    const duplicate = await adapter.createAssociateRecord(assocRecord);
    expect(duplicate.success).toBe(false);
    expect(duplicate.error).toContain('already exists');
  });

  it('binds roster record to userId', async () => {
    const record: KclsuMemberRecord = {
      cardNumber: 'K26001234',
      name: 'Tommy Caldwell',
      rawPurchaser: 'CALDWELL, Tommy',
      tier: 'social',
      productName: 'Climbing Social',
      transactionId: '31600001',
      purchaseDate: '20 Sep 2026',
    };

    await adapter.upsertRosterRecords([record]);
    await adapter.bindRosterRecord('K26001234', 'user-tommy');

    const bound = await adapter.findRosterRecordByUserId('user-tommy');
    expect(bound).toBeDefined();
    expect(bound?.name).toBe('Tommy Caldwell');
    expect((bound as any)?.user_id).toBe('user-tommy');
  });

  it('verifies public membership pass and respects revoked status', async () => {
    const record: KclsuMemberRecord = {
      cardNumber: 'K26009999',
      name: 'Jimmy Chin',
      rawPurchaser: 'CHIN, Jimmy',
      tier: 'recreational',
      productName: 'Climbing Rec',
      transactionId: 'TX-CHIN',
      purchaseDate: '21 Sep 2026',
      suStatus: 'verified',
    };

    await adapter.upsertRosterRecords([record]);

    const validResult = await adapter.verifyPublicPass('K26009999');
    expect(validResult.valid).toBe(true);
    expect(validResult.member?.name).toBe('Jimmy Chin');
    expect(validResult.member?.source).toBe('cloudflare_d1');

    // Revoke
    await adapter.updateRosterMember('K26009999', { suStatus: 'revoked' });
    const revokedResult = await adapter.verifyPublicPass('K26009999');
    expect(revokedResult.valid).toBe(false);
    expect(revokedResult.statusCode).toBe(403);
  });

  it('lists roster with profiles and counts tiers accurately', async () => {
    await adapter.upsertRosterRecords([
      {
        cardNumber: 'K26000001',
        name: 'Member One',
        rawPurchaser: 'ONE, Member',
        tier: 'social',
        productName: 'Social',
        transactionId: '1',
        purchaseDate: '20 Sep 2026',
      },
      {
        cardNumber: 'K26000002',
        name: 'Member Two',
        rawPurchaser: 'TWO, Member',
        tier: 'recreational',
        productName: 'Rec',
        transactionId: '2',
        purchaseDate: '20 Sep 2026',
      },
    ]);

    const list = await adapter.listRosterWithProfiles();
    expect(list.source).toBe('cloudflare_d1');
    expect(list.members.length).toBe(2);
    expect(list.socialCount).toBe(1);
    expect(list.recreationalCount).toBe(1);
  });

  it('updates member name and deletes member record', async () => {
    await adapter.upsertRosterRecords([
      {
        cardNumber: 'K26000003',
        name: 'Old Name',
        rawPurchaser: 'OLD, Name',
        tier: 'social',
        productName: 'Social',
        transactionId: '3',
        purchaseDate: '20 Sep 2026',
      },
    ]);

    await adapter.updateMemberName('K26000003', 'Curated New Name');
    const updated = await adapter.findRosterRecord('K26000003');
    expect(updated?.name).toBe('Curated New Name');

    const deleteRes = await adapter.deleteRosterMember('K26000003');
    expect(deleteRes.success).toBe(true);
    const deleted = await adapter.findRosterRecord('K26000003');
    expect(deleted).toBeNull();
  });
});

describe('MemberRosterService dynamic D1 resolution', () => {
  let mockDb: MockD1Database;

  beforeEach(() => {
    mockDb = new MockD1Database();
  });

  afterEach(() => {
    setD1DatabaseOverride(null);
  });

  it('dynamically uses D1RosterAdapter when D1 database is available', async () => {
    setD1DatabaseOverride(mockDb);
    const service = new MemberRosterService();

    const storage = await service.getStorage();
    expect(storage).toBeInstanceOf(D1RosterAdapter);

    await service.syncRoster([
      {
        cardNumber: 'K26001234',
        name: 'Alex Honnold',
        rawPurchaser: 'HONNOLD, Alex',
        tier: 'recreational',
        productName: 'Rec',
        transactionId: 'TX-D1-1',
        purchaseDate: '20 Sep 2026',
      },
    ]);

    const roster = await service.listRoster();
    expect(roster.source).toBe('cloudflare_d1');
    expect(roster.total).toBe(1);
    expect(roster.members[0].name).toBe('Alex Honnold');
  });

  it('preserves explicitly injected storage adapter even if D1 is bound', async () => {
    setD1DatabaseOverride(mockDb);
    const customMockAdapter = {
      isConfigured: () => true,
      listRosterWithProfiles: async () => ({
        source: 'custom_mock',
        members: [],
        socialCount: 0,
        recreationalCount: 0,
      }),
    } as any;

    const service = new MemberRosterService(customMockAdapter);
    const storage = await service.getStorage();
    expect(storage).toBe(customMockAdapter);

    const roster = await service.listRoster();
    expect(roster.source).toBe('custom_mock');
  });
});
