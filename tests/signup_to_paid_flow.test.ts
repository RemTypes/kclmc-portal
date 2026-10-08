import { describe, it, expect } from 'vitest';
import { POST as signupHandler } from '../app/api/auth/signup/route';
import { GET as verifyPassHandler } from '../app/api/verify/[membershipId]/route';
import { findMemberByCardNumber, parseKclsuCsv } from '../lib/roster';

describe('Signup to Paid Flow Integration (Checklist Item 14)', () => {
  it('validates student registration format and rejects weak credentials', async () => {
    const signupReq = new Request('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'newclimber@kcl.ac.uk',
        password: 'weak',
        fullName: 'New Climber',
        studentId: 'K26122068',
      }),
    });

    const res = await signupHandler(signupReq);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Password');
  });

  it('matches KCL student against official KCLSU paid purchases', () => {
    // K26122068 is David Baltensperger (Social Tier)
    const socialMember = findMemberByCardNumber('K26122068');
    expect(socialMember).toBeDefined();
    expect(socialMember?.name).toBe('David Baltensperger');
    expect(socialMember?.tier).toBe('social');

    // K25008223 is Remy Preston (Recreational Tier)
    const recMember = findMemberByCardNumber('K25008223');
    expect(recMember).toBeDefined();
    expect(recMember?.tier).toBe('recreational');

    // Non-purchased ID returns undefined
    const unpaid = findMemberByCardNumber('K99999999');
    expect(unpaid).toBeUndefined();
  });

  it('verifies digital climbing pass for paid member via wall scanner API', async () => {
    const params = Promise.resolve({ membershipId: 'K26122068' });
    const verifyReq = new Request('http://localhost:3000/api/verify/K26122068');

    const res = await verifyPassHandler(verifyReq, { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.valid).toBe(true);
    expect(data.member.name).toBe('David Baltensperger');
    expect(data.member.tier).toBe('social');
    expect(data.member.expires).toBe('2027-08-31');
  });

  it('rejects digital climbing pass verification for non-members', async () => {
    const params = Promise.resolve({ membershipId: 'K99999999' });
    const verifyReq = new Request('http://localhost:3000/api/verify/K99999999');

    const res = await verifyPassHandler(verifyReq, { params });
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.valid).toBe(false);
  });
});
