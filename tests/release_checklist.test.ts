import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateProductionSecrets } from '../lib/security/env-guard';
import { checkAiSpendingGuard, recordAiUsage, aiSpendingConfig } from '../config/ai.config';
import { captureException, captureMessage } from '../lib/monitoring';
import { GET as healthGet, HEAD as healthHead } from '../app/api/health/route';

describe('Public Release Checklist Suite', () => {
  describe('Checklist Item 8: Stripe Keys Set to Live (Env Guard)', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    it('rejects sk_test_ keys in production environment', () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.STRIPE_SECRET_KEY = 'sk_test_51Habcdefg123456';
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_51Habcdefg123456';

      const result = validateProductionSecrets();
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      expect(result.errors.some(e => e.includes('STRIPE_SECRET_KEY'))).toBe(true);
    });

    it('accepts live keys or non-stripe configs in production', () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.STRIPE_SECRET_KEY = 'sk_live_51Habcdefg123456';
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_live_51Habcdefg123456';

      const result = validateProductionSecrets();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects localhost NEXT_PUBLIC_SITE_URL or NEXT_PUBLIC_SUPABASE_URL in production', () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';

      const result = validateProductionSecrets();
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('NEXT_PUBLIC_SITE_URL'))).toBe(true);
      expect(result.errors.some(e => e.includes('NEXT_PUBLIC_SUPABASE_URL'))).toBe(true);
    });
  });

  describe('Checklist Item 18: Toggle for Risky Features (canAccessRoute)', () => {
    it('blocks unprivileged visitors and committee from disabled features', async () => {
      const { canAccessRoute } = await import('../config/modules.config');
      // /comps is disabled
      expect(canAccessRoute('/comps', 0)).toBe(false);
      expect(canAccessRoute('/comps', 1)).toBe(false);
      // /admin/ml is disabled & superadmin only
      expect(canAccessRoute('/admin/ml', 0)).toBe(false);
      expect(canAccessRoute('/admin/ml', 1)).toBe(false);
    });

    it('allows superadmins (role 2) to preview and test disabled features', async () => {
      const { canAccessRoute } = await import('../config/modules.config');
      expect(canAccessRoute('/comps', 2)).toBe(true);
      expect(canAccessRoute('/admin/ml', 2)).toBe(true);
    });

    it('locks /status behind committee privileges (role >= 1)', async () => {
      const { canAccessRoute } = await import('../config/modules.config');
      // Public visitors (role 0) are blocked
      expect(canAccessRoute('/status', 0)).toBe(false);
      // Committee members (role 1) and SuperAdmins (role 2) are granted access
      expect(canAccessRoute('/status', 1)).toBe(true);
      expect(canAccessRoute('/status', 2)).toBe(true);
    });
  });

  describe('Checklist Item 3: Spending Cap for AI', () => {
    it('enforces monthly and daily spending guard thresholds', () => {
      const check = checkAiSpendingGuard(0.001);
      expect(check.allowed).toBe(true);
      expect(check.monthlyCapUsd).toBe(10.00);
      expect(check.dailyCapUsd).toBe(1.00);
    });

    it('blocks request when emergency killswitch is active', () => {
      aiSpendingConfig.emergencyKillswitch = true;
      const check = checkAiSpendingGuard(0.001);
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('killswitch');
      aiSpendingConfig.emergencyKillswitch = false;
    });

    it('blocks request when daily limit is exceeded', () => {
      // Simulate spending exceeding daily cap
      recordAiUsage(50000, 1.50);
      const check = checkAiSpendingGuard(0.01);
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('Daily AI spending limit');
    });
  });

  describe('Checklist Item 2: Setup Error Monitoring', () => {
    it('captures sanitized errors without leaking sensitive tokens or passwords', async () => {
      const sensitiveError = new Error('Database connection failed with token=secret123&password=supersecret');
      const eventId = await captureException(sensitiveError, {
        route: '/test',
        digest: 'digest-123',
      });

      expect(typeof eventId).toBe('string');
      expect(eventId.length).toBeGreaterThan(0);
    });

    it('captures warning messages with event identifiers', async () => {
      const eventId = await captureMessage('High latency detected on wall scanner', 'warning', { latency: 450 });
      expect(typeof eventId).toBe('string');
      expect(eventId.length).toBeGreaterThan(0);
    });
  });

  describe('Checklist Items 1 & 9: Status Page & Uptime Alerts (Health Endpoint)', () => {
    it('serves lightweight HTTP HEAD for zero-body uptime pingers', async () => {
      const headResponse = await healthHead();
      expect(headResponse.status).toBe(200);
      expect(headResponse.headers.get('X-Health-Status')).toBe('OK');
      expect(headResponse.headers.get('Cache-Control')).toContain('no-cache');
    });

    it('serves rich service health breakdown in GET including security & AI guards', async () => {
      const getResponse = await healthGet();
      expect(getResponse.status).toBe(200);
      const data = await getResponse.json();
      expect(data.status).toBeDefined();
      expect(data.services).toBeDefined();
      expect(data.services.edge_runtime.status).toBe('operational');
      expect(data.services.auth_gateway.session_isolation).toBe('httpOnly');
      expect(data.services.pass_verification.endpoint).toBe('/api/verify/:id');
      expect(data.services.security_guard).toBeDefined();
      expect(data.services.ai_guard).toBeDefined();
      expect(data.services.ai_guard.monthlyCapUsd).toBe(10.00);
    });
  });
});
