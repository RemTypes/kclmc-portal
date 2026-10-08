import { describe, it, expect, beforeEach } from 'vitest';
import { MemberRosterService, InMemoryRosterAdapter } from '@/lib/roster/service';

describe('MemberRoster Deep Module', () => {
  let rosterService: MemberRosterService;
  let inMemoryAdapter: InMemoryRosterAdapter;

  beforeEach(() => {
    inMemoryAdapter = new InMemoryRosterAdapter();
    rosterService = new MemberRosterService(inMemoryAdapter);
  });

  describe('resolveMemberPass & Safety Gate', () => {
    it('returns unauthenticated result when user is null', async () => {
      const result = await rosterService.resolveMemberPass(null);
      expect(result.authenticated).toBe(false);
      expect(result.membership).toBeNull();
    });

    it('resolves valid climbing pass for seeded member (K26122068)', async () => {
      const user = {
        id: 'user-david-1',
        email: 'david@kcl.ac.uk',
        user_metadata: { student_id: 'K26122068', full_name: 'David Baltensperger' },
      };

      const result = await rosterService.resolveMemberPass(user);
      expect(result.authenticated).toBe(true);
      expect(result.boundStudentId).toBe('K26122068');
      expect(result.suRecord?.name).toBe('David Baltensperger');
      expect(result.suRecord?.tier).toBe('social');
      expect(result.membership).toBeDefined();
      expect(result.membership?.is_active).toBe(true);
      expect(result.membership?.tier).toBe('social');

      // Safety check initially incomplete because phone & emergency contact are not set
      expect(result.safetyCheck.isComplete).toBe(false);
      expect(result.safetyCheck.missingFields).toContain('Phone Number');
    });

    it('passes safety gate once phone and emergency contacts are provided', async () => {
      const userId = 'user-david-2';
      await rosterService.resolveMemberPass({
        id: userId,
        email: 'david@kcl.ac.uk',
        user_metadata: { student_id: 'K26122068' },
      });

      const updateResult = await rosterService.updateSafetyNotes(userId, {
        phone: '07123456789',
        emergencyName: 'Jane Baltensperger',
        emergencyPhone: '07987654321',
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.safetyCheck.isComplete).toBe(true);
      expect(updateResult.safetyCheck.missingFields).toHaveLength(0);
    });
  });

  describe('linkStudentId', () => {
    it('rejects malformed student ID with 400', async () => {
      const outcome = await rosterService.linkStudentId('user-1', 'INVALID<SCRIPT>');
      expect(outcome.success).toBe(false);
      expect(outcome.statusCode).toBe(400);
      expect(outcome.error).toContain('Please provide a valid KCL Student ID');
    });

    it('rejects unknown student ID not in purchase list with 404', async () => {
      const outcome = await rosterService.linkStudentId('user-1', 'K99999999');
      expect(outcome.success).toBe(false);
      expect(outcome.statusCode).toBe(404);
      expect(outcome.error).toContain('was not found in the official KCLSU purchase list');
    });

    it('successfully links valid member (Alice Richardson K23158797)', async () => {
      const outcome = await rosterService.linkStudentId('user-alice', 'K23158797');
      expect(outcome.success).toBe(true);
      expect(outcome.statusCode).toBe(200);
      expect(outcome.member?.name).toBe('Alice Richardson');
      expect(outcome.member?.tier).toBe('recreational');
    });

    it('rejects linking when student ID is already linked to another account with 409', async () => {
      await rosterService.linkStudentId('user-first', 'K23158797');
      const conflictOutcome = await rosterService.linkStudentId('user-attacker', 'K23158797');

      expect(conflictOutcome.success).toBe(false);
      expect(conflictOutcome.statusCode).toBe(409);
      expect(conflictOutcome.error).toContain('already linked to another KCLMC account');
    });
  });

  describe('verifyPublicPass', () => {
    it('verifies valid pass for scanner', async () => {
      const result = await rosterService.verifyPass('K26122068');
      expect(result.valid).toBe(true);
      expect(result.member?.name).toBe('David Baltensperger');
      expect(result.member?.tier).toBe('social');
    });

    it('returns 404 for unknown ID', async () => {
      const result = await rosterService.verifyPass('K99999999');
      expect(result.valid).toBe(false);
      expect(result.statusCode).toBe(404);
    });

    it('rejects malicious characters with 400', async () => {
      const result = await rosterService.verifyPass("K12345678'; DROP TABLE;");
      expect(result.valid).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.error).toContain('Invalid membership ID characters');
    });
  });

  describe('syncRoster', () => {
    it('synchronizes CSV and applies Soc-to-Rec upgrades', async () => {
      const csv = [
        'product_name,transaction_id,purchaser,type,card_number,dob,email,purchase_date',
        '[10166870] Climbing/Mountaineering Social Membership,101,"DOE, Jane",Member,K24005555,2003-01-01,jane@kcl.ac.uk,2026-09-01',
        '[10188720] Climbing/Mountaineering Soc to Rec Membership Upgrade,102,"DOE, Jane",Member,K24005555,2003-01-01,jane@kcl.ac.uk,2026-09-05',
      ].join('\n');

      const outcome = await rosterService.syncRoster(csv);
      expect(outcome.success).toBe(true);
      expect(outcome.totalSynced).toBe(1);

      const pass = await rosterService.verifyPass('K24005555');
      expect(pass.valid).toBe(true);
      expect(pass.member?.tier).toBe('recreational');
    });
  });
});
