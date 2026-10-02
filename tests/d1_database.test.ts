import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getD1Database, isD1Available, queryD1, queryOneD1, executeD1, setTestD1Database } from '@/lib/db/d1';
import { getDatabaseBackend, getRosterMember, getPublishedGuides, getShopItems, getTrips } from '@/lib/db/index';

describe('Cloudflare D1 & Unified Database Layer', () => {
  beforeEach(() => {
    setTestD1Database(null);
  });

  describe('Environment Detection & Fallback', () => {
    it('safely handles non-Cloudflare environment without throwing', async () => {
      const db = await getD1Database();
      expect(db).toBeNull();

      const available = await isD1Available();
      expect(available).toBe(false);
    });

    it('identifies database backend when D1 is not available', async () => {
      const backend = await getDatabaseBackend();
      expect(['supabase', 'fallback']).toContain(backend);
    });

    it('throws error when querying D1 directly while unavailable', async () => {
      await expect(queryD1('SELECT 1')).rejects.toThrow('Cloudflare D1 is not available in this environment');
      await expect(queryOneD1('SELECT 1')).rejects.toThrow('Cloudflare D1 is not available in this environment');
      await expect(executeD1('DELETE FROM trips')).rejects.toThrow('Cloudflare D1 is not available in this environment');
    });
  });

  describe('D1 Mock Interaction', () => {
    it('executes queryD1 and queryOneD1 when D1 database is mocked', async () => {
      const mockD1: any = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockResolvedValue({
            results: [{ id: '1', title: 'Mile End' }],
            success: true,
          }),
          first: vi.fn().mockResolvedValue({ id: '1', title: 'Mile End' }),
          run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
        }),
      };

      setTestD1Database(mockD1);

      expect(await isD1Available()).toBe(true);
      expect(await getDatabaseBackend()).toBe('d1');

      const results = await queryD1('SELECT * FROM guides WHERE is_published = ?', [1]);
      expect(results).toEqual([{ id: '1', title: 'Mile End' }]);

      const single = await queryOneD1('SELECT * FROM guides WHERE id = ?', ['1']);
      expect(single).toEqual({ id: '1', title: 'Mile End' });

      const execResult = await executeD1('UPDATE guides SET title = ? WHERE id = ?', ['New Title', '1']);
      expect(execResult.success).toBe(true);

      setTestD1Database(null);
    });

    it('queries roster records through unified getRosterMember', async () => {
      const mockD1: any = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue({
            id: 'd1-uuid-1',
            card_number: 'K1234567',
            full_name: 'Alex Honnold',
            tier: 'recreational',
            transaction_id: 'TXN-999',
            product_name: 'Recreational Membership',
          }),
        }),
      };

      setTestD1Database(mockD1);

      const member = await getRosterMember('k1234567');
      expect(member).not.toBeNull();
      expect(member?.full_name).toBe('Alex Honnold');
      expect(member?.tier).toBe('recreational');

      setTestD1Database(null);
    });
  });
});
