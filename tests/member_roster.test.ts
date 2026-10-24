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
        id: 'user-alex-1',
        email: 'alex@kcl.ac.uk',
        user_metadata: { student_id: 'K26122068', full_name: 'Alex Honnold' },
      };

      const result = await rosterService.resolveMemberPass(user);
      expect(result.authenticated).toBe(true);
      expect(result.boundStudentId).toBe('K26122068');
      expect(result.suRecord?.name).toBe('Alex Honnold');
      expect(result.suRecord?.tier).toBe('social');
      expect(result.membership).toBeDefined();
      expect(result.membership?.is_active).toBe(false);
      expect(result.membership?.tier).toBe('social');

      // Safety check initially incomplete because phone & emergency contact are not set
      expect(result.safetyCheck.isComplete).toBe(false);
      expect(result.safetyCheck.missingFields).toContain('Phone Number');
    });

    it('passes safety gate once phone and emergency contacts are provided', async () => {
      const userId = 'user-alex-2';
      const initial = await rosterService.resolveMemberPass({
        id: userId,
        email: 'alex@kcl.ac.uk',
        user_metadata: { student_id: 'K26122068' },
      });
      expect(initial.membership?.is_active).toBe(false);

      const updateResult = await rosterService.updateSafetyNotes(userId, {
        phone: '07123456789',
        emergencyName: 'Stanni Honnold',
        emergencyPhone: '07987654321',
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.safetyCheck.isComplete).toBe(true);
      expect(updateResult.safetyCheck.missingFields).toHaveLength(0);

      const activePass = await rosterService.resolveMemberPass({
        id: userId,
        email: 'alex@kcl.ac.uk',
        user_metadata: { student_id: 'K26122068' },
      });
      expect(activePass.membership?.is_active).toBe(true);
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

    it('successfully links valid member (Catherine Destivelle K23158797)', async () => {
      const outcome = await rosterService.linkStudentId('user-catherine', 'K23158797');
      expect(outcome.success).toBe(true);
      expect(outcome.statusCode).toBe(200);
      expect(outcome.member?.name).toBe('Catherine Destivelle');
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
      expect(result.member?.name).toBe('Alex Honnold');
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

  describe('Associate Member Lifecycle (Issue ID, Link, Upgrade, Revoke, Reconcile)', () => {
    it('creates an Associate Member with auto-generated ASSOC-2601 ID and links it to an account', async () => {
      const created = await rosterService.createAssociateMember({
        fullName: 'Tommy Caldwell',
        tier: 'social',
        email: 'tommy@dawnwall.com',
        university: 'Alumni / Associate / Guest',
        suStatus: 'awaiting_su',
      });

      expect(created.success).toBe(true);
      expect(created.member?.cardNumber).toBe('ASSOC-2601');
      expect(created.member?.isAssociate).toBe(true);
      expect(created.member?.suStatus).toBe('awaiting_su');

      // Link ASSOC-2601 to a new climber account
      const linked = await rosterService.linkStudentId('user-tommy-1', 'ASSOC-2601');
      expect(linked.success).toBe(true);
      expect(linked.member?.name).toBe('Tommy Caldwell');
      expect(linked.message).toContain('Associate Member ID ASSOC-2601');

      // Upgrade Social -> Recreational
      const upgraded = await rosterService.updateRosterMember('ASSOC-2601', {
        tier: 'recreational',
        suStatus: 'verified',
      });
      expect(upgraded.success).toBe(true);
      expect(upgraded.member?.tier).toBe('recreational');
      expect(upgraded.member?.suStatus).toBe('verified');

      // Verify wall scanner pass
      const pass = await rosterService.verifyPass('ASSOC-2601');
      expect(pass.valid).toBe(true);
      expect(pass.member?.tier).toBe('recreational');
    });

    it('blocks linking and scanner verification when Associate ID is revoked', async () => {
      await rosterService.createAssociateMember({
        fullName: 'Revoked Climber',
        tier: 'recreational',
        customCardNumber: 'ASSOC-2699',
        suStatus: 'revoked',
      });

      const linkAttempt = await rosterService.linkStudentId('user-revoked', 'ASSOC-2699');
      expect(linkAttempt.success).toBe(false);
      expect(linkAttempt.statusCode).toBe(403);

      const scanAttempt = await rosterService.verifyPass('ASSOC-2699');
      expect(scanAttempt.valid).toBe(false);
      expect(scanAttempt.statusCode).toBe(403);
    });

    it('reconciles incoming KCLSU CSV associate row against existing manual ASSOC-26XX record by name', async () => {
      await rosterService.createAssociateMember({
        fullName: 'Lynn Hill',
        tier: 'social',
        customCardNumber: 'ASSOC-2610',
        suStatus: 'awaiting_su',
      });

      const incomingCsv = [
        'product_name,transaction_id,purchaser,type,card_number,dob,email,purchase_date',
        '[10002480] Climbing/Mountaineering Associate Recreational Membership,31999999,"HILL, Lynn",Associate,,1995-01-01,lynn@nose.com,Fri 25 Sep 2026 15:00',
      ].join('\n');

      const syncRes = await rosterService.syncRoster(incomingCsv);
      expect(syncRes.success).toBe(true);

      // Should have updated ASSOC-2610 in place rather than stranding ASSOC-2610
      const updated = await inMemoryAdapter.findRosterRecord('ASSOC-2610');
      expect(updated).toBeDefined();
      expect(updated?.tier).toBe('recreational');
      expect(updated?.transactionId).toBe('31999999');
      expect(updated?.suStatus).toBe('verified');
    });
  });
});

