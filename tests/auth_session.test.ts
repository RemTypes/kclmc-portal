import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authSession, AuthOutcome } from '@/lib/auth/session';
import { clearRateLimitStores } from '@/lib/security/rate-limiter';
import {
  clear2FAStores,
  create2FAEnrollmentChallenge,
  calculateTOTP,
  generateBackupCodes,
  setUserHashedBackupCodes,
} from '@/lib/security/two-factor';

describe('AuthSession Deep Module', () => {
  beforeEach(() => {
    clearRateLimitStores();
    clear2FAStores();
    vi.clearAllMocks();
  });

  describe('authenticateCredentials', () => {
    it('rejects missing email or password with error status 400', async () => {
      const outcome = await authSession.authenticateCredentials({
        email: '',
        password: '',
        ip: '127.0.0.1',
      });

      expect(outcome.status).toBe('error');
      if (outcome.status === 'error') {
        expect(outcome.statusCode).toBe(400);
        expect(outcome.error).toContain('Email and password are required');
      }
    });

    it('returns invalid_credentials on incorrect password', async () => {
      const outcome = await authSession.authenticateCredentials({
        email: 'climber@kcl.ac.uk',
        password: 'wrong-password',
        ip: '10.0.0.1',
      });

      expect(outcome.status).toBe('invalid_credentials');
      if (outcome.status === 'invalid_credentials') {
        expect(outcome.remainingAttempts).toBe(4);
        expect(outcome.isLocked).toBe(false);
      }
    });

    it('locks account after 5 consecutive failed login attempts', async () => {
      const ip = '10.0.0.2';
      const email = 'lockout.target@kcl.ac.uk';

      const captchaToken = 'bypass_test_token';
      for (let i = 0; i < 4; i++) {
        await authSession.authenticateCredentials({ email, password: 'bad', ip, captchaToken });
      }

      const finalOutcome = await authSession.authenticateCredentials({ email, password: 'bad', ip, captchaToken });
      expect(finalOutcome.status).toBe('invalid_credentials');
      if (finalOutcome.status === 'invalid_credentials') {
        expect(finalOutcome.isLocked).toBe(true);
      }

      // Next attempt immediately returns locked status
      const lockedOutcome = await authSession.authenticateCredentials({ email, password: 'bad', ip, captchaToken });
      expect(lockedOutcome.status).toBe('locked');
      if (lockedOutcome.status === 'locked') {
        expect(lockedOutcome.retryAfterSeconds).toBeGreaterThan(0);
      }
    });
  });

  describe('verifyTwoFactor', () => {
    it('rejects missing challenge token or verification code with status 400', async () => {
      const outcome = await authSession.verifyTwoFactor({
        challengeToken: '',
        code: '',
        ip: '10.0.0.3',
      });

      expect(outcome.status).toBe('error');
      if (outcome.status === 'error') {
        expect(outcome.statusCode).toBe(400);
      }
    });

    it('rejects invalid 2FA code with invalid_code status', async () => {
      const setup = create2FAEnrollmentChallenge('user-2fa-fail', 'president@kclmc.org', 1, {
        session: { access_token: 'tok' },
      });

      const outcome = await authSession.verifyTwoFactor({
        challengeToken: setup.challengeToken,
        code: '000000',
        ip: '10.0.0.4',
      });

      expect(outcome.status).toBe('invalid_code');
      if (outcome.status === 'invalid_code') {
        expect(outcome.error).toContain('Invalid');
      }
    });

    it('authenticates successfully with valid TOTP code', async () => {
      const setup = create2FAEnrollmentChallenge('user-2fa-pass', 'president@kclmc.org', 1, {
        session: { access_token: 'valid-tok' },
      });

      const validTotp = calculateTOTP(setup.secret);
      const outcome = await authSession.verifyTwoFactor({
        challengeToken: setup.challengeToken,
        code: validTotp,
        ip: '10.0.0.5',
      });

      expect(outcome.status).toBe('authenticated');
      if (outcome.status === 'authenticated') {
        expect(outcome.user.email).toBe('president@kclmc.org');
        expect(outcome.user.role).toBe(1);
        expect(outcome.destination).toBe('/admin');
      }
    });
  });

  describe('toApiResponse', () => {
    it('transforms authenticated outcome to 200 JSON with active session cookie', () => {
      const outcome: AuthOutcome = {
        status: 'authenticated',
        user: { id: 'u1', email: 'test@kcl.ac.uk', role: 0 },
        destination: '/membership',
        sessionData: { session: { access_token: 'acc', refresh_token: 'ref' } },
      };

      const res = authSession.toApiResponse(outcome);
      expect(res.status).toBe(200);

      const cookieHeader = res.headers.get('set-cookie') || '';
      expect(cookieHeader).toContain('kclmc_session=active');
    });

    it('transforms requires_2fa_verify outcome to 200 JSON with pending challenge cookie', () => {
      const outcome: AuthOutcome = {
        status: 'requires_2fa_verify',
        challengeToken: 'enc-tok-123',
        expiresAt: Date.now() + 300000,
        destination: '/admin',
        message: 'Enter code',
      };

      const res = authSession.toApiResponse(outcome);
      expect(res.status).toBe(200);

      const cookieHeader = res.headers.get('set-cookie') || '';
      expect(cookieHeader).toContain('kclmc_2fa_pending=enc-tok-123');
    });

    it('transforms locked outcome to 429 JSON with Retry-After header', () => {
      const outcome: AuthOutcome = {
        status: 'locked',
        error: 'Locked for 15 minutes',
        retryAfterSeconds: 900,
        requiresCaptcha: true,
      };

      const res = authSession.toApiResponse(outcome);
      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('900');
    });
  });
});
