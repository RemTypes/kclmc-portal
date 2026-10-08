import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as forgotPasswordHandler } from '../app/api/auth/forgot-password/route';
import { POST as resetPasswordHandler } from '../app/api/auth/reset-password/route';

describe('Password Reset Lifecycle Tests (Checklist Item 10)', () => {
  describe('POST /api/auth/forgot-password', () => {
    it('rejects invalid or missing email format', async () => {
      const badReq = new Request('http://localhost:3000/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email' }),
      });

      const res = await forgotPasswordHandler(badReq);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('valid email');
    });

    it('returns consistent user-enumeration-safe success response for valid emails', async () => {
      const validReq = new Request('http://localhost:3000/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '192.168.10.1',
        },
        body: JSON.stringify({ email: 'climber.recovery@kcl.ac.uk' }),
      });

      const res = await forgotPasswordHandler(validReq);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('password reset link has been dispatched');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('rejects passwords that fail the 12+ char complex policy', async () => {
      const weakReq = new Request('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '192.168.10.2',
        },
        body: JSON.stringify({ password: 'short' }),
      });

      const res = await resetPasswordHandler(weakReq);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it('rejects top common passwords like Password123!', async () => {
      const commonReq = new Request('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '192.168.10.3',
        },
        body: JSON.stringify({ password: 'Password12345!' }),
      });

      const res = await resetPasswordHandler(commonReq);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/password/i);
    });
  });
});
