import { describe, it, expect } from 'vitest';
import {
  formatPurchaserName,
  determineMemberTier,
  findMemberByCardNumber,
  parseKclsuCsv,
} from '@/lib/roster';

describe('Roster Core Logic (lib/roster.ts)', () => {
  describe('formatPurchaserName', () => {
    it('formats "LAST, First" into "First Last" with proper casing', () => {
      expect(formatPurchaserName('BALTENSPERGER, David')).toBe('David Baltensperger');
      expect(formatPurchaserName('DOE, John')).toBe('John Doe');
      expect(formatPurchaserName('Rochester-Hines, Olivia')).toBe('Olivia Rochester-hines');
    });

    it('handles titles or complex surnames', () => {
      expect(formatPurchaserName('D/O GULWANT SINGH, Hasvinjit')).toBe('Hasvinjit D/o Gulwant Singh');
    });

    it('returns raw string cleanly when no comma is present', () => {
      expect(formatPurchaserName('Alex Honnold')).toBe('Alex Honnold');
      expect(formatPurchaserName('')).toBe('');
    });

    it('strips surrounding quotes if present', () => {
      expect(formatPurchaserName('"LIPPI, Alexander"')).toBe('Alexander Lippi');
    });
  });

  describe('determineMemberTier', () => {
    it('identifies pure social membership', () => {
      expect(
        determineMemberTier('[10166870] Climbing/Mountaineering Social Membership')
      ).toBe('social');
      expect(determineMemberTier('Social Membership 2026/27')).toBe('social');
    });

    it('identifies standard recreational membership', () => {
      expect(
        determineMemberTier('[10002480] Climbing/Mountaineering Recreational Membership')
      ).toBe('recreational');
      expect(determineMemberTier('Recreational Climbing')).toBe('recreational');
    });

    it('strictly classifies Social-to-Recreational upgrades as recreational', () => {
      expect(
        determineMemberTier('[10188720] Climbing/Mountaineering Soc to Rec Membership Upgrade')
      ).toBe('recreational');
      expect(determineMemberTier('Social to Rec Top-up')).toBe('recreational');
      expect(determineMemberTier('Soc-to-Rec Upgrade')).toBe('recreational');
      expect(determineMemberTier('Social Recreational Upgrade')).toBe('recreational');
    });

    it('defaults unknown strings containing rec to recreational', () => {
      expect(determineMemberTier('Annual Rec Pass')).toBe('recreational');
      expect(determineMemberTier('Unknown Product')).toBe('recreational');
    });
  });

  describe('findMemberByCardNumber', () => {
    it('finds an existing member from the initial roster', () => {
      const member = findMemberByCardNumber('K26122068');
      expect(member).toBeDefined();
      expect(member?.name).toBe('David Baltensperger');
      expect(member?.tier).toBe('social');
    });

    it('is case-insensitive and trims whitespace', () => {
      const member = findMemberByCardNumber('  k26122068  ');
      expect(member).toBeDefined();
      expect(member?.name).toBe('David Baltensperger');
    });

    it('returns undefined for non-existent card number or empty input', () => {
      expect(findMemberByCardNumber('K99999999')).toBeUndefined();
      expect(findMemberByCardNumber('')).toBeUndefined();
    });
  });

  describe('parseKclsuCsv', () => {
    const SAMPLE_HEADER =
      'product_name,transaction_id,purchaser,type,card_number,dob,email,purchase_date';

    it('returns empty array if required header is missing', () => {
      const badCsv = 'col1,col2,col3\nval1,val2,val3';
      expect(parseKclsuCsv(badCsv)).toEqual([]);
    });

    it('correctly parses valid CSV rows into KclsuMemberRecord objects', () => {
      const csv = [
        SAMPLE_HEADER,
        '[10002480] Climbing/Mountaineering Recreational Membership,31591709,"Dean, Arthur",Member,K25004642,2003-01-01,arthur@kcl.ac.uk,Tue 15 Sep 2026 18:06',
        '[10166870] Climbing/Mountaineering Social Membership,31631002,"BALTENSPERGER, David",Member,K26122068,2004-05-12,david@kcl.ac.uk,Wed 23 Sep 2026 17:55',
      ].join('\n');

      const results = parseKclsuCsv(csv);
      expect(results).toHaveLength(2);

      const dean = results.find(r => r.cardNumber === 'K25004642');
      expect(dean).toBeDefined();
      expect(dean?.name).toBe('Arthur Dean');
      expect(dean?.tier).toBe('recreational');
      expect(dean?.transactionId).toBe('31591709');

      const david = results.find(r => r.cardNumber === 'K26122068');
      expect(david).toBeDefined();
      expect(david?.name).toBe('David Baltensperger');
      expect(david?.tier).toBe('social');
    });

    it('ignores rows where card_number does not start with K', () => {
      const csv = [
        SAMPLE_HEADER,
        '[10002480] Climbing/Mountaineering Recreational Membership,1234,"Smith, John",Member,NON_KCL_ID,2000-01-01,john@test.com,2026-09-01',
      ].join('\n');

      const results = parseKclsuCsv(csv);
      expect(results).toHaveLength(0);
    });

    it('handles Soc-to-Rec upgrades: Recreational strictly overrides Social for the same card number', () => {
      const csv = [
        SAMPLE_HEADER,
        // Step 1: Member buys Social membership
        '[10166870] Climbing/Mountaineering Social Membership,31000001,"CLIMBER, Sarah",Member,K24001122,2002-03-10,sarah@kcl.ac.uk,Mon 14 Sep 2026 10:00',
        // Step 2: Member later buys Soc to Rec Upgrade
        '[10188720] Climbing/Mountaineering Soc to Rec Membership Upgrade,31000002,"CLIMBER, Sarah",Member,K24001122,2002-03-10,sarah@kcl.ac.uk,Fri 18 Sep 2026 14:00',
      ].join('\n');

      const results = parseKclsuCsv(csv);
      expect(results).toHaveLength(1);

      const sarah = results[0];
      expect(sarah.cardNumber).toBe('K24001122');
      expect(sarah.tier).toBe('recreational');
      expect(sarah.productName).toBe(
        '[10188720] Climbing/Mountaineering Soc to Rec Membership Upgrade'
      );
      expect(sarah.transactionId).toBe('31000002');
    });

    it('preserves Recreational tier even if Social row appears after Recreational row', () => {
      const csv = [
        SAMPLE_HEADER,
        // Recreational first
        '[10002480] Climbing/Mountaineering Recreational Membership,31000003,"CLIMBER, Sarah",Member,K24001122,2002-03-10,sarah@kcl.ac.uk,Fri 18 Sep 2026 14:00',
        // Social second (e.g. duplicate accidental order or older transaction listed below)
        '[10166870] Climbing/Mountaineering Social Membership,31000001,"CLIMBER, Sarah",Member,K24001122,2002-03-10,sarah@kcl.ac.uk,Mon 14 Sep 2026 10:00',
      ].join('\n');

      const results = parseKclsuCsv(csv);
      expect(results).toHaveLength(1);
      expect(results[0].tier).toBe('recreational');
      expect(results[0].productName).toBe(
        '[10002480] Climbing/Mountaineering Recreational Membership'
      );
    });
  });
});
