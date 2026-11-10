import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseKclsuCsv,
  parseCsvRows,
  getHigherTier,
  KclsuMemberRecord,
} from '@/lib/roster';
import { D1RosterAdapter } from '@/lib/roster/d1-adapter';
import { D1Database, D1PreparedStatement } from '@/lib/db/d1';

/**
 * High-fidelity in-memory Mock D1 Database for Reconciliation and Survivor Rule testing.
 */
class TestD1Database implements D1Database {
  public tables: {
    kclsu_roster: any[];
    profiles: any[];
    users: any[];
  } = {
    kclsu_roster: [],
    profiles: [],
    users: [],
  };

  public batchCallCount = 0;
  public batchChunkSizes: number[] = [];

  prepare(query: string): D1PreparedStatement {
    return new TestD1PreparedStatement(query, this);
  }

  async batch<T = unknown>(
    statements: D1PreparedStatement[]
  ): Promise<Array<{ results?: T[]; success: boolean; meta?: any }>> {
    this.batchCallCount++;
    this.batchChunkSizes.push(statements.length);
    const results: any[] = [];
    for (const stmt of statements) {
      results.push(await stmt.run());
    }
    return results;
  }

  async exec(query: string): Promise<{ count: number; duration: number }> {
    return { count: 0, duration: 1 };
  }
}

class TestD1PreparedStatement implements D1PreparedStatement {
  private boundValues: any[] = [];

  constructor(private query: string, private db: TestD1Database) {}

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

    // SELECT * FROM kclsu_roster (pre-fetch)
    if (q === 'SELECT * FROM kclsu_roster') {
      return { results: [...this.db.tables.kclsu_roster] as any, success: true };
    }

    // SELECT * FROM kclsu_roster WHERE UPPER(card_number) = ?
    if (q.includes('FROM kclsu_roster WHERE UPPER(card_number) = ?')) {
      const card = String(this.boundValues[0]).toUpperCase();
      const match = this.db.tables.kclsu_roster.find(
        r => String(r.card_number).toUpperCase() === card
      );
      return { results: match ? [match as any] : [], success: true };
    }

    // verifyPublicPass query
    if (
      q.includes(
        'WHERE UPPER(card_number) = ? OR UPPER(transaction_id) = ? OR user_id = ?'
      )
    ) {
      const [c1, c2, uid] = this.boundValues;
      const match = this.db.tables.kclsu_roster.find(
        r =>
          String(r.card_number).toUpperCase() === c1 ||
          String(r.transaction_id).toUpperCase() === c2 ||
          r.user_id === uid
      );
      return { results: match ? [match as any] : [], success: true };
    }

    return { results: [], success: true };
  }

  async run(): Promise<{ success: boolean; meta?: any }> {
    const q = this.query.trim();

    if (q.includes('INSERT INTO kclsu_roster')) {
      const [
        id,
        card_number,
        full_name,
        raw_purchaser,
        tier,
        product_name,
        transaction_id,
        purchase_date,
        is_associate,
        member_email,
        university,
        su_status,
        created_at,
        updated_at,
      ] = this.boundValues;

      const card = String(card_number).toUpperCase();
      const existingIdx = this.db.tables.kclsu_roster.findIndex(
        r => String(r.card_number).toUpperCase() === card
      );

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
        is_associate: is_associate ?? 0,
        member_email: member_email ?? null,
        university: university ?? null,
        su_status: su_status ?? 'verified',
        created_at: created_at || new Date().toISOString(),
        updated_at: updated_at || new Date().toISOString(),
      };

      if (existingIdx >= 0) {
        this.db.tables.kclsu_roster[existingIdx] = {
          ...this.db.tables.kclsu_roster[existingIdx],
          ...row,
        };
      } else {
        this.db.tables.kclsu_roster.push(row);
      }

      return { success: true };
    }

    if (q.includes('UPDATE kclsu_roster SET full_name = ?')) {
      const [fullName, updatedAt, card] = this.boundValues;
      const match = this.db.tables.kclsu_roster.find(
        r => String(r.card_number).toUpperCase() === String(card).toUpperCase()
      );
      if (match) {
        match.full_name = fullName;
        match.updated_at = updatedAt;
      }
      return { success: true };
    }

    return { success: true };
  }
}

describe('Roster Reconciliation & Survivor Rules Suite (tests/roster_reconcile.test.ts)', () => {
  const SAMPLE_HEADER =
    'product_name,transaction_id,purchaser,type,card_number,dob,email,purchase_date';

  describe('1. CSV Parser Hardening (UTF-8 BOM & Multiline Quoted Cells)', () => {
    it('strips leading UTF-8 BOM (\uFEFF) and successfully parses records', () => {
      const rawWithBom =
        '\uFEFF' +
        SAMPLE_HEADER +
        '\n' +
        '[10002480] Climbing/Mountaineering Recreational Membership,31591709,"COXSEY, Shauna",Member,K25004642,2003-01-01,shauna@kcl.ac.uk,Tue 15 Sep 2026 18:06';

      const records = parseKclsuCsv(rawWithBom);
      expect(records).toHaveLength(1);
      expect(records[0].cardNumber).toBe('K25004642');
      expect(records[0].name).toBe('Shauna Coxsey');
      expect(records[0].tier).toBe('recreational');
      expect(records[0].email).toBe('shauna@kcl.ac.uk');
    });

    it('handles multiline quoted fields with embedded newlines without splitting rows', () => {
      const csvWithMultiline = [
        SAMPLE_HEADER,
        '[10002480] Climbing/Mountaineering Recreational Membership,31591710,"CALDWELL,\nTommy",Member,K26001234,2001-04-10,tommy@kcl.ac.uk,Mon 14 Sep 2026 10:00',
        '[10166870] Climbing/Mountaineering Social Membership,31591711,"HONNOLD, Alex",Member,K26122068,2004-05-12,alex@kcl.ac.uk,Wed 23 Sep 2026 17:55',
      ].join('\n');

      const records = parseKclsuCsv(csvWithMultiline);
      expect(records).toHaveLength(2);

      const tommy = records.find(r => r.cardNumber === 'K26001234');
      expect(tommy).toBeDefined();
      expect(tommy?.name).toBe('Tommy Caldwell');
      expect(tommy?.tier).toBe('recreational');
      expect(tommy?.transactionId).toBe('31591710');

      const alex = records.find(r => r.cardNumber === 'K26122068');
      expect(alex).toBeDefined();
      expect(alex?.name).toBe('Alex Honnold');
      expect(alex?.tier).toBe('social');
    });

    it('handles quoted fields with escaped double quotes ("") and multiline text', () => {
      const csvWithEscapedQuotes = [
        SAMPLE_HEADER,
        '"[10002480] Climbing/Mountaineering\n""Special"" Rec Pass",31591712,"DESTIVELLE, Catherine",Member,K23158797,1999-07-24,catherine@kcl.ac.uk,Thu 17 Sep 2026 12:00',
      ].join('\n');

      const rows = parseCsvRows(csvWithEscapedQuotes);
      expect(rows).toHaveLength(2);
      expect(rows[1][0]).toContain('Special');
      expect(rows[1][0]).toContain('\n');

      const records = parseKclsuCsv(csvWithEscapedQuotes);
      expect(records).toHaveLength(1);
      expect(records[0].cardNumber).toBe('K23158797');
      expect(records[0].name).toBe('Catherine Destivelle');
      expect(records[0].tier).toBe('recreational');
    });

    it('handles CRLF (\\r\\n) carriage returns correctly', () => {
      const crlfCsv =
        SAMPLE_HEADER +
        '\r\n' +
        '[10002480] Climbing/Mountaineering Recreational Membership,31591713,"HILL, Lynn",Member,K26019642,2000-01-01,lynn@kcl.ac.uk,Fri 18 Sep 2026 09:00\r\n';

      const records = parseKclsuCsv(crlfCsv);
      expect(records).toHaveLength(1);
      expect(records[0].cardNumber).toBe('K26019642');
      expect(records[0].name).toBe('Lynn Hill');
    });
  });

  describe('2. Survivor Rule Helper (getHigherTier)', () => {
    it('strictly favors recreational over social', () => {
      expect(getHigherTier('recreational', 'social')).toBe('recreational');
      expect(getHigherTier('social', 'recreational')).toBe('recreational');
      expect(getHigherTier('recreational', 'recreational')).toBe('recreational');
    });

    it('returns social when neither is recreational', () => {
      expect(getHigherTier('social', 'social')).toBe('social');
      expect(getHigherTier(null, 'social')).toBe('social');
      expect(getHigherTier('social', undefined)).toBe('social');
      expect(getHigherTier(null, null)).toBe('social');
    });
  });

  describe('3. D1 Database Batching & Survivor Rules (D1RosterAdapter)', () => {
    let mockDb: TestD1Database;
    let adapter: D1RosterAdapter;

    beforeEach(() => {
      mockDb = new TestD1Database();
      adapter = new D1RosterAdapter(mockDb);
    });

    it('preserves Recreational tier against accidental Social downgrade on sync', async () => {
      // Step 1: Member initially has Recreational tier in D1
      await adapter.upsertRosterRecords([
        {
          cardNumber: 'K24001122',
          name: 'Sarah Climber',
          rawPurchaser: 'CLIMBER, Sarah',
          tier: 'recreational',
          productName: '[10002480] Climbing/Mountaineering Recreational Membership',
          transactionId: 'TX-REC-01',
          purchaseDate: '10 Sep 2026',
          suStatus: 'verified',
        },
      ]);

      const initial = await adapter.findRosterRecord('K24001122');
      expect(initial?.tier).toBe('recreational');

      // Step 2: Sync incoming CSV containing a Social transaction for the same card
      await adapter.upsertRosterRecords([
        {
          cardNumber: 'K24001122',
          name: 'Sarah Climber',
          rawPurchaser: 'CLIMBER, Sarah',
          tier: 'social',
          productName: '[10166870] Climbing/Mountaineering Social Membership',
          transactionId: 'TX-SOC-02',
          purchaseDate: '15 Sep 2026',
          suStatus: 'verified',
        },
      ]);

      // Step 3: Survivor Rule ensures tier remains 'recreational'
      const afterSync = await adapter.findRosterRecord('K24001122');
      expect(afterSync?.tier).toBe('recreational');
      expect(afterSync?.productName).toBe(
        '[10002480] Climbing/Mountaineering Recreational Membership'
      );
    });

    it('upgrades Social member to Recreational when Recreational row arrives', async () => {
      // Step 1: Initial Social membership
      await adapter.upsertRosterRecords([
        {
          cardNumber: 'K24009999',
          name: 'Upgrading Climber',
          rawPurchaser: 'CLIMBER, Upgrading',
          tier: 'social',
          productName: '[10166870] Climbing/Mountaineering Social Membership',
          transactionId: 'TX-SOC-10',
          purchaseDate: '10 Sep 2026',
        },
      ]);

      // Step 2: Soc to Rec Upgrade arrived
      await adapter.upsertRosterRecords([
        {
          cardNumber: 'K24009999',
          name: 'Upgrading Climber',
          rawPurchaser: 'CLIMBER, Upgrading',
          tier: 'recreational',
          productName: '[10188720] Climbing/Mountaineering Soc to Rec Membership Upgrade',
          transactionId: 'TX-UPGRADE-11',
          purchaseDate: '18 Sep 2026',
        },
      ]);

      const updated = await adapter.findRosterRecord('K24009999');
      expect(updated?.tier).toBe('recreational');
      expect(updated?.productName).toBe(
        '[10188720] Climbing/Mountaineering Soc to Rec Membership Upgrade'
      );
    });

    it('preserves complete curated full name when incoming CSV has incomplete or single-word surname', async () => {
      // Step 1: Member has complete name in D1
      await adapter.upsertRosterRecords([
        {
          cardNumber: 'K26001111',
          name: 'Alex Honnold',
          rawPurchaser: 'HONNOLD, Alex',
          tier: 'recreational',
          productName: 'Rec Pass',
          transactionId: 'TX-HONNOLD-1',
          purchaseDate: '10 Sep 2026',
        },
      ]);

      // Step 2: Next CSV sync only contains surname "Honnold" (missing first name)
      await adapter.upsertRosterRecords([
        {
          cardNumber: 'K26001111',
          name: 'Honnold',
          rawPurchaser: 'HONNOLD, -',
          tier: 'recreational',
          productName: 'Rec Pass',
          transactionId: 'TX-HONNOLD-2',
          purchaseDate: '12 Sep 2026',
        },
      ]);

      const preserved = await adapter.findRosterRecord('K26001111');
      expect(preserved?.name).toBe('Alex Honnold');
    });

    it('preserves manually curated name edited in database', async () => {
      // Step 1: Insert record
      await adapter.upsertRosterRecords([
        {
          cardNumber: 'K26002222',
          name: 'John Doe',
          rawPurchaser: 'DOE, John',
          tier: 'social',
          productName: 'Social Pass',
          transactionId: 'TX-DOE-1',
          purchaseDate: '10 Sep 2026',
        },
      ]);

      // Step 2: Admin manually curates name
      await adapter.updateMemberName('K26002222', 'Jonathan Doe-Smith');

      // Step 3: CSV re-sync with raw name
      await adapter.upsertRosterRecords([
        {
          cardNumber: 'K26002222',
          name: 'John Doe',
          rawPurchaser: 'DOE, John',
          tier: 'social',
          productName: 'Social Pass',
          transactionId: 'TX-DOE-2',
          purchaseDate: '15 Sep 2026',
        },
      ]);

      const curated = await adapter.findRosterRecord('K26002222');
      expect(curated?.name).toBe('Jonathan Doe-Smith');
    });

    it('reconciles incoming Associate Member (e.g. non-KCL ID R204008 or ASSOC-SU) against manually issued ASSOC-26XX record by full name', async () => {
      // Step 1: Committee issues official associate pass ASSOC-2601 for "David Lama"
      await adapter.createAssociateRecord({
        cardNumber: 'ASSOC-2601',
        name: 'David Lama',
        rawPurchaser: 'LAMA, David',
        tier: 'recreational',
        productName: 'KCL Mountaineering Associate Recreational Membership 2026/27',
        transactionId: 'MANUAL-ASSOC-01',
        purchaseDate: '01 Sep 2026',
        isAssociate: true,
        suStatus: 'awaiting_su',
      });

      // Step 2: Later, KCLSU shop export includes an associate purchase with external student ID R204008
      const incomingKclsuRow: KclsuMemberRecord = {
        cardNumber: 'R204008',
        name: 'David Lama',
        rawPurchaser: 'LAMA, David',
        tier: 'recreational',
        productName: 'KCL Mountaineering Associate Recreational Membership 2026/27',
        transactionId: 'KCLSU-TX-9876',
        purchaseDate: '10 Sep 2026',
        isAssociate: true,
        suStatus: 'verified',
      };

      await adapter.upsertRosterRecords([incomingKclsuRow]);

      // Step 3: Verified that the record was reconciled to ASSOC-2601 without creating a duplicate R204008 row
      const reconciled = await adapter.findRosterRecord('ASSOC-2601');
      expect(reconciled).toBeDefined();
      expect(reconciled?.name).toBe('David Lama');
      expect(reconciled?.transactionId).toBe('KCLSU-TX-9876');
      expect(reconciled?.suStatus).toBe('verified');

      // Total records in table should remain 1
      expect(mockDb.tables.kclsu_roster).toHaveLength(1);
    });

    it('verifies public pass sets validUntil default to 2027-08-31', async () => {
      await adapter.upsertRosterRecords([
        {
          cardNumber: 'K26003333',
          name: 'Royal Robbins',
          rawPurchaser: 'ROBBINS, Royal',
          tier: 'recreational',
          productName: 'Rec Pass',
          transactionId: 'TX-RR',
          purchaseDate: '20 Sep 2026',
          suStatus: 'verified',
        },
      ]);

      const pass = await adapter.verifyPublicPass('K26003333');
      expect(pass.valid).toBe(true);
      expect(pass.member?.expires).toBe('2027-08-31');
    });

    it('executes bulk records in atomic chunks of 50 via db.batch()', async () => {
      const bulkRecords: KclsuMemberRecord[] = [];
      // Generate 125 records
      for (let i = 1; i <= 125; i++) {
        const idStr = String(i).padStart(5, '0');
        bulkRecords.push({
          cardNumber: `K26${idStr}`,
          name: `Member ${i}`,
          rawPurchaser: `MEMBER, ${i}`,
          tier: i % 2 === 0 ? 'recreational' : 'social',
          productName: i % 2 === 0 ? 'Rec Pass' : 'Social Pass',
          transactionId: `TX-BULK-${i}`,
          purchaseDate: '20 Sep 2026',
        });
      }

      const res = await adapter.upsertRosterRecords(bulkRecords);
      expect(res.count).toBe(125);
      expect(res.error).toBeUndefined();

      // Verify batching occurred in chunks of 50 (50 + 50 + 25 = 3 batch calls)
      expect(mockDb.batchCallCount).toBe(3);
      expect(mockDb.batchChunkSizes).toEqual([50, 50, 25]);

      // All 125 records should exist in the database table
      expect(mockDb.tables.kclsu_roster).toHaveLength(125);
    });
  });
});
