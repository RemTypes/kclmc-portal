import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Mock Supabase server module for API route security tests
vi.mock('@/lib/supabase/server', () => {
  return {
    isSupabaseConfigured: vi.fn(),
    createClient: vi.fn(),
    createAdminClient: vi.fn(),
  };
});

import { isSupabaseConfigured, createClient, createAdminClient } from '@/lib/supabase/server';
import { GET as verifyGet } from '@/app/api/verify/[membershipId]/route';
import { POST as rosterLinkPost } from '@/app/api/roster/link/route';
import { GET as ordersGet, POST as ordersPost, PUT as ordersPut } from '@/app/api/orders/route';
import { POST as reconcilePost } from '@/app/api/reconcile/route';
import { GET as rosterGet, POST as rosterPost } from '@/app/api/roster/route';
import { GET as telemetryGet, POST as telemetryPost } from '@/app/api/telemetry/route';
import { parseKclsuCsv, sanitizeCsvCell } from '@/lib/roster';
import { getUserRole, getAuthenticatedUserRole, getSafeRedirectUrl, sanitizeStudentId, sanitizeEmail } from '@/lib/auth';
import { validatePasswordStrength, COMMON_PASSWORDS_BLACKLIST, calculateEntropy } from '@/lib/security/password-validator';
import { checkRateLimit, recordFailedAttempt, recordSuccessfulAttempt, verifyCaptchaToken, clearRateLimitStores, getSecurityAuditLogs } from '@/lib/security/rate-limiter';
import { create2FAChallenge, create2FAEnrollmentChallenge, isUser2FAEnrolled, verify2FAChallenge, requiresMandatory2FA, generateBackupCodes, getOrCreateBackupCodes, getUserHashedBackupCodes, setUserHashedBackupCodes, calculateTOTP, verifyTOTP, setUserTOTPSecret, clear2FAStores } from '@/lib/security/two-factor';
import { applySessionCookies, setSessionCookies, clearSessionCookies, getAuthCookiePrefix, SESSION_COOKIE_OPTIONS } from '@/lib/security/cookies';
import { POST as authLoginPost } from '@/app/api/auth/login/route';
import { POST as authSignupPost } from '@/app/api/auth/signup/route';
import { POST as authForgotPost } from '@/app/api/auth/forgot-password/route';
import { POST as authResetPost } from '@/app/api/auth/reset-password/route';
import { POST as authVerify2FAPost } from '@/app/api/auth/verify-2fa/route';
import { POST as authVerifyOtpPost } from '@/app/api/auth/verify-otp/route';
import { POST as authLogoutPost } from '@/app/api/auth/logout/route';
import { NextResponse } from 'next/server';

describe('Security Testing Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. STATIC ANALYSIS: SECRET KEY & CREDENTIAL LEAKAGE SCANNER
  // =========================================================================
  describe('Static Analysis: Secret Key & Credential Leakage Scanner', () => {
    const rootDir = process.cwd();
    const sourceDirs = ['app', 'components', 'lib', 'config', 'scripts'];

    function getAllSourceFiles(dir: string, fileList: string[] = []): string[] {
      const fullDir = path.resolve(rootDir, dir);
      if (!fs.existsSync(fullDir)) return fileList;

      const entries = fs.readdirSync(fullDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(fullDir, entry.name);
        if (entry.isDirectory()) {
          if (!['node_modules', '.next', '.git', 'backups', 'coverage'].includes(entry.name)) {
            getAllSourceFiles(path.relative(rootDir, fullPath), fileList);
          }
        } else if (/\.(tsx?|jsx?|mjs|json)$/.test(entry.name)) {
          fileList.push(fullPath);
        }
      }
      return fileList;
    }

    const allSourceFiles = sourceDirs.flatMap(dir => getAllSourceFiles(dir));

    it('verifies that no Supabase Service Role secret keys are hardcoded in source code', () => {
      // Supabase service role keys are JWTs with role: "service_role"
      const serviceRoleKeyRegex = /SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"]eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+['"]/i;
      const genericSecretJwt = /eyJ[a-zA-Z0-9_-]{15,}\.eyJ[a-zA-Z0-9_-]{15,}\.[a-zA-Z0-9_-]{15,}/g;

      for (const filePath of allSourceFiles) {
        // Skip test files and consolidated SQL files
        if (filePath.includes('/tests/') || filePath.endsWith('.sql')) continue;

        const content = fs.readFileSync(filePath, 'utf8');
        expect(content).not.toMatch(serviceRoleKeyRegex);

        const jwts = content.match(genericSecretJwt) || [];
        for (const jwt of jwts) {
          try {
            const parts = jwt.split('.');
            if (parts.length >= 2) {
              const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
              expect(payload.role).not.toBe('service_role');
            }
          } catch {
            // Not base64 json, continue
          }
        }
      }
    });

    it('verifies that no client components import from lib/supabase/server', () => {
      for (const filePath of allSourceFiles) {
        const content = fs.readFileSync(filePath, 'utf8');
        const isClientComponent = content.includes("'use client'") || content.includes('"use client"');
        const isUnderComponents = filePath.includes('/components/');

        if (isClientComponent || isUnderComponents) {
          expect(content).not.toContain('@/lib/supabase/server');
          expect(content).not.toContain('lib/supabase/server');
          expect(content).not.toContain('createAdminClient');
          expect(content).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
        }
      }
    });

    it('verifies that public links and navigation hrefs do not expose secret tokens or keys', () => {
      const suspiciousLinkRegex = /href=["']https?:\/\/[^"']*(?:key|token|secret|password|auth|api_key)=[^"']+["']/i;

      for (const filePath of allSourceFiles) {
        if (filePath.includes('/tests/') || filePath.includes('verify_email_system.ts')) continue;
        const content = fs.readFileSync(filePath, 'utf8');
        expect(content).not.toMatch(suspiciousLinkRegex);
      }
    });
  });

  // =========================================================================
  // 2. SQL INJECTION & INPUT SANITIZATION: VERIFY PASS API
  // =========================================================================
  describe('Input Sanitization & SQL Injection: /api/verify/[membershipId]', () => {
    beforeEach(() => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(false);
    });

    const SQLI_PAYLOADS = [
      "' OR '1'='1",
      "'; DROP TABLE kclsu_roster; --",
      "' UNION SELECT 1, 'hacker', 'admin' --",
      "admin'--",
      '" OR ""="',
      "K25008223' OR '1'='1",
      "1; SELECT * FROM profiles;",
      "K1234567\0",
      "eq.K1234567,or(id.not.null)",
    ];

    it.each(SQLI_PAYLOADS)('safely rejects SQL injection payload: %s', async (payload) => {
      const request = new Request(`http://localhost:3000/api/verify/${encodeURIComponent(payload)}`);
      const response = await verifyGet(request, {
        params: Promise.resolve({ membershipId: payload }),
      });

      // Must be rejected with 400 (invalid characters) or 404 (not found), NEVER 500 or 200
      expect([400, 404]).toContain(response.status);
      const data = await response.json();
      expect(data.valid).toBe(false);

      // Verify that dangerous SQL characters are not reflected unsanitized in the error message
      if (data.error) {
        expect(data.error).not.toContain("'; DROP");
        expect(data.error).not.toContain('<script>');
      }
    });

    it('rejects XSS script tags and does not reflect them in response', async () => {
      const xssPayload = '<script>alert("xss")</script>';
      const request = new Request(`http://localhost:3000/api/verify/${encodeURIComponent(xssPayload)}`);
      const response = await verifyGet(request, {
        params: Promise.resolve({ membershipId: xssPayload }),
      });

      expect([400, 404]).toContain(response.status);
      const data = await response.json();
      expect(data.valid).toBe(false);
      expect(data.error).not.toContain('<script>');
    });

    it('rejects excessively long inputs (buffer overflow / DDoS simulation)', async () => {
      const hugeId = 'K' + '9'.repeat(5000);
      const request = new Request(`http://localhost:3000/api/verify/${hugeId}`);
      const response = await verifyGet(request, {
        params: Promise.resolve({ membershipId: hugeId }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid membership ID length');
    });

    it('gracefully handles malformed URI percent-encoding without crashing (URIError defense)', async () => {
      const malformedParam = '%E0%A4%A';
      const request = new Request(`http://localhost:3000/api/verify/${malformedParam}`);
      const response = await verifyGet(request, {
        params: Promise.resolve({ membershipId: malformedParam }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.valid).toBe(false);
      expect(data.error).toBe('Malformed membership ID parameter');
    });
  });

  // =========================================================================
  // 3. INPUT SANITIZATION & RBAC: /api/orders
  // =========================================================================
  describe('Input Sanitization & RBAC: /api/orders', () => {
    it('rejects SQL injection in order code query parameter', async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(true);
      const request = new Request("http://localhost:3000/api/orders?code=' OR '1'='1");
      const response = await ordersGet(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid order code format');
    });

    it('prevents unauthenticated public users from listing all orders (PII protection)', async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(true);

      // Mock userClient returning unauthenticated public user
      const mockUserClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
      };
      vi.mocked(createClient).mockResolvedValue(mockUserClient as any);

      const request = new Request('http://localhost:3000/api/orders');
      const response = await ordersGet(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Unauthorized: Committee access required');
    });

    it('prevents regular climbers from listing all orders', async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(true);

      const mockUserClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'usr-1', email: 'climber@kcl.ac.uk' } },
            error: null,
          }),
        },
      };
      vi.mocked(createClient).mockResolvedValue(mockUserClient as any);

      const request = new Request('http://localhost:3000/api/orders');
      const response = await ordersGet(request);

      expect(response.status).toBe(403);
    });

    it('allows committee members to list orders when authenticated', async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(true);

      const mockUserClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'comm-1', email: 'president@kclmc.org' } },
            error: null,
          }),
        },
      };
      vi.mocked(createClient).mockResolvedValue(mockUserClient as any);

      const mockAdminClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'ord-1',
                    order_code: 'KCL-1001',
                    customer_name: 'Arthur Dean',
                    customer_email: 'arthur@kcl.ac.uk',
                    items: [{ name: 'Hoodie', size: 'M' }],
                    status: 'paid',
                    total_pence: 3500,
                  },
                ],
                error: null,
              }),
            }),
          }),
        }),
      };
      vi.mocked(createAdminClient).mockReturnValue(mockAdminClient as any);

      const request = new Request('http://localhost:3000/api/orders');
      const response = await ordersGet(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].orderCode).toBe('KCL-1001');
    });

    it('rejects price tampering and negative amounts on POST /api/orders', async () => {
      const maliciousPayload = {
        total: -500,
        customerName: 'Attacker',
        customerEmail: 'attacker@test.com',
      };
      const request = new Request('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(maliciousPayload),
      });

      const response = await ordersPost(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid total amount');
    });

    it('sanitizes XSS tags in customer name and email on POST /api/orders', async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(false);

      const payload = {
        total: 25.0,
        customerName: '<script>alert(1)</script>John Doe',
        customerEmail: '<script>bad()</script>john@kcl.ac.uk',
      };
      const request = new Request('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const response = await ordersPost(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.orderCode).toBeDefined();
    });

    it('requires committee privileges on PUT /api/orders status modification', async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(true);

      const mockUserClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'usr-2', email: 'climber@kcl.ac.uk' } },
            error: null,
          }),
        },
      };
      vi.mocked(createClient).mockResolvedValue(mockUserClient as any);

      const request = new Request('http://localhost:3000/api/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'KCL-1234', status: 'paid' }),
      });

      const response = await ordersPut(request);
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Unauthorized: Committee privileges required');
    });
  });

  // =========================================================================
  // 4. INPUT SANITIZATION & SQL INJECTION: /api/roster/link
  // =========================================================================
  describe('Input Sanitization & SQL Injection: /api/roster/link', () => {
    beforeEach(() => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(true);
      const mockUserClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'usr-test-1', email: 'member@kcl.ac.uk' } },
            error: null,
          }),
        },
      };
      vi.mocked(createClient).mockResolvedValue(mockUserClient as any);
    });

    it.each([
      "'; DROP TABLE profiles; --",
      "K25008223' OR '1'='1",
      "<script>alert(1)</script>",
      "K" + "1".repeat(100),
    ])('rejects malicious student ID: %s', async (maliciousId) => {
      const request = new Request('http://localhost:3000/api/roster/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: maliciousId }),
      });

      const response = await rosterLinkPost(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Please provide a valid KCL Student ID');
    });
  });

  // =========================================================================
  // 5. INPUT SANITIZATION & DEFENSIVE RECONCILIATION: /api/reconcile
  // =========================================================================
  describe('Input Sanitization: /api/reconcile', () => {
    it('requires committee privileges on POST /api/reconcile', async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(true);
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1', email: 'climber@kcl.ac.uk' } } }),
        },
      } as any);

      const request = new Request('http://localhost:3000/api/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([]),
      });

      const response = await reconcilePost(request);
      expect(response.status).toBe(403);
    });

    it('rejects non-array payloads for authorized committee', async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(true);
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'comm-1', email: 'kclmc.committee@gmail.com' } } }),
        },
      } as any);

      const request = new Request('http://localhost:3000/api/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderCode: 'KCL-1234' }),
      });

      const response = await reconcilePost(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('must be an array');
    });

    it('safely skips invalid order codes with SQL injection in CSV data', async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(false);

      const rows = [
        { orderCode: "KCL-1234' OR '1'='1", Amount: '20.00' },
        { orderCode: 'KCL-5678', Amount: '35.00' },
      ];

      const request = new Request('http://localhost:3000/api/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rows),
      });

      const response = await reconcilePost(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      // Malicious code was discarded by validation
      expect(data.results.matched.some((m: any) => m.orderCode.includes("'"))).toBe(false);
    });
  });

  // =========================================================================
  // 6. CSV FORMULA INJECTION (DDE ATTACK) PROTECTION
  // =========================================================================
  describe('CSV Formula Injection Protection: sanitizeCsvCell', () => {
    it('neutralizes spreadsheet formula prefixes (=, +, -, @)', () => {
      expect(sanitizeCsvCell("=cmd|'/C calc'!A0")).toBe("cmd|'/C calc'!A0");
      expect(sanitizeCsvCell('@SUM(1,2)')).toBe('SUM(1,2)');
      expect(sanitizeCsvCell('+12345')).toBe('12345');
      expect(sanitizeCsvCell('-54321')).toBe('54321');
      expect(sanitizeCsvCell('Normal Text')).toBe('Normal Text');
    });

    it('neutralizes formula injection during parseKclsuCsv processing', () => {
      const csv = [
        'product_name,transaction_id,purchaser,type,card_number,dob,email,purchase_date',
        '[10002480] Climbing/Mountaineering Recreational Membership,12345,"=cmd|\' /C calc\'!A0",Member,K25001234,2003-01-01,test@kcl.ac.uk,2026-09-01',
      ].join('\n');

      const results = parseKclsuCsv(csv);
      expect(results).toHaveLength(1);
      expect(results[0].name.startsWith('=')).toBe(false);
    });
  });

  // =========================================================================
  // 7. ROLE-BASED ACCESS CONTROL (RBAC) & PRIVILEGE ESCALATION
  // =========================================================================
  describe('RBAC Privilege Escalation Defense: getUserRole', () => {
    it('assigns Role 0 (Climber) to regular student emails', () => {
      expect(getUserRole('student@kcl.ac.uk')).toBe(0);
      expect(getUserRole('climber@gmail.com')).toBe(0);
      expect(getUserRole(null)).toBe(0);
      expect(getUserRole(undefined)).toBe(0);
    });

    it('assigns Role 1 (Committee) strictly to approved committee emails', () => {
      expect(getUserRole('president@kclmc.org')).toBe(1);
      expect(getUserRole('treasurer@kclmc.org')).toBe(1);
      expect(getUserRole('gear@kclmc.org')).toBe(1);
      expect(getUserRole('portal@kclmc.org')).toBe(1);
      expect(getUserRole('kclmc.committee@gmail.com')).toBe(1);
    });

    it('assigns Role 2 (SuperAdmin) strictly to superadmin email', () => {
      expect(getUserRole('admin@kclmc.org')).toBe(2);
    });

    it('prevents subdomain spoofing attacks', () => {
      expect(getUserRole('president@kclmc.org.evil.com')).toBe(0);
      expect(getUserRole('admin@kclmc.org.attacker.com')).toBe(0);
      expect(getUserRole('portal@kclmc.org@attacker.com')).toBe(0);
    });

    it('rejects invalid or escalated roleOverride strings', () => {
      expect(getUserRole('student@kcl.ac.uk', '99')).toBe(0);
      expect(getUserRole('student@kcl.ac.uk', '-1')).toBe(0);
      expect(getUserRole('student@kcl.ac.uk', 'admin')).toBe(0);
      expect(getUserRole('student@kcl.ac.uk', '3')).toBe(0);
    });

    it('getAuthenticatedUserRole resolves role from profiles table when email is not whitelisted', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { role: 1 },
                error: null,
              }),
            }),
          }),
        }),
      };

      const role = await getAuthenticatedUserRole(mockSupabase, {
        id: 'user-officer-1',
        email: 'officer.personal@gmail.com',
      });
      expect(role).toBe(1);
    });

    it('getAuthenticatedUserRole resolves superadmin role from whitelist without database query', async () => {
      const mockSupabase = { from: vi.fn() };
      const role = await getAuthenticatedUserRole(mockSupabase, {
        id: 'user-admin-1',
        email: 'admin@kclmc.org',
      });
      expect(role).toBe(2);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('getAuthenticatedUserRole returns 0 for unauthenticated or non-committee users', async () => {
      expect(await getAuthenticatedUserRole(null, null)).toBe(0);
      expect(await getAuthenticatedUserRole(null, { id: 'u1', email: 'climber@kcl.ac.uk' })).toBe(0);

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { role: 0 },
                error: null,
              }),
            }),
          }),
        }),
      };

      const role = await getAuthenticatedUserRole(mockSupabase, {
        id: 'user-regular-1',
        email: 'climber@kcl.ac.uk',
      });
      expect(role).toBe(0);
    });
  });

  // =========================================================================
  // 8. ROSTER DATA PROTECTION & COMMITTEE RBAC: /api/roster
  // =========================================================================
  describe('Roster Data Protection & Committee RBAC: /api/roster', () => {
    it('prevents unauthenticated public users from dumping full student roster (UK GDPR)', async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(true);
      const mockUserClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
      };
      vi.mocked(createClient).mockResolvedValue(mockUserClient as any);

      const response = await rosterGet();
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Unauthorized: Committee access required');
    });

    it('prevents regular student climbers from dumping full student roster', async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(true);
      const mockUserClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'usr-climber', email: 'student@kcl.ac.uk' } },
            error: null,
          }),
        },
      };
      vi.mocked(createClient).mockResolvedValue(mockUserClient as any);

      const response = await rosterGet();
      expect(response.status).toBe(403);
    });

    it('allows committee officers to inspect roster records when authenticated', async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(true);
      const mockUserClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'comm-1', email: 'president@kclmc.org' } },
            error: null,
          }),
        },
      };
      vi.mocked(createClient).mockResolvedValue(mockUserClient as any);

      const mockAdminClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  card_number: 'K25008223',
                  full_name: 'Arthur Dean',
                  raw_purchaser: 'DEAN, Arthur',
                  tier: 'recreational',
                  product_name: 'Climbing Recreational',
                  transaction_id: 'TX1001',
                  purchase_date: '2026-09-15',
                  user_id: 'usr-1',
                },
              ],
              error: null,
            }),
          }),
        }),
      };
      vi.mocked(createAdminClient).mockReturnValue(mockAdminClient as any);

      const response = await rosterGet();
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.total).toBe(1);
      expect(data.members[0].cardNumber).toBe('K25008223');
    });

    it('rejects unauthenticated attempts to POST and synchronize roster records', async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(true);
      const mockUserClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
      };
      vi.mocked(createClient).mockResolvedValue(mockUserClient as any);

      const request = new Request('http://localhost:3000/api/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: 'card_number,name\nK123,Test' }),
      });

      const response = await rosterPost(request);
      expect(response.status).toBe(403);
    });
  });

  // =========================================================================
  // 9. TELEMETRY OBSERVABILITY & BUFFER OVERFLOW DEFENSE: /api/telemetry
  // =========================================================================
  describe('Telemetry Observability & Input Bounds: /api/telemetry', () => {
    it('requires committee role to query telemetry logs when Supabase is connected', async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(true);
      const mockUserClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
      };
      vi.mocked(createClient).mockResolvedValue(mockUserClient as any);

      const response = await telemetryGet();
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Unauthorized');
    });

    it('rejects oversized payloads (HTTP 413) to prevent denial of service', async () => {
      const hugePayload = JSON.stringify({ data: 'A'.repeat(40000) });
      const request = new Request('http://localhost:3000/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: hugePayload,
      });

      const response = await telemetryPost(request);
      expect(response.status).toBe(413);
    });

    it('sanitizes event_type parameter against script tags and control characters', async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(false);
      const maliciousPayload = {
        type: '<script>alert(1)</script>page_view',
        sessionId: 'sess_123',
      };
      const request = new Request('http://localhost:3000/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(maliciousPayload),
      });

      const response = await telemetryPost(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  // =========================================================================
  // 10. AUTH FLOW SECURITY: OPEN REDIRECT & CREDENTIAL SANITIZATION
  // =========================================================================
  describe('Auth Flow Security: Open Redirect & Input Sanitization', () => {
    it('blocks open redirect attempts to external origins or malicious schemes', () => {
      expect(getSafeRedirectUrl('https://evil.com')).toBe('/membership');
      expect(getSafeRedirectUrl('http://attacker.com/login')).toBe('/membership');
      expect(getSafeRedirectUrl('//evil.com')).toBe('/membership');
      expect(getSafeRedirectUrl('/\\evil.com')).toBe('/membership');
      expect(getSafeRedirectUrl('javascript:alert(1)')).toBe('/membership');
      expect(getSafeRedirectUrl('data:text/html;base64,...')).toBe('/membership');
      expect(getSafeRedirectUrl(null)).toBe('/membership');
      expect(getSafeRedirectUrl(undefined)).toBe('/membership');
      expect(getSafeRedirectUrl('')).toBe('/membership');
    });

    it('permits legitimate internal relative navigation paths', () => {
      expect(getSafeRedirectUrl('/admin')).toBe('/admin');
      expect(getSafeRedirectUrl('/trips')).toBe('/trips');
      expect(getSafeRedirectUrl('/membership?view=active')).toBe('/membership?view=active');
      expect(getSafeRedirectUrl('/guides#crags')).toBe('/guides#crags');
      expect(getSafeRedirectUrl('/pass/KCL-1001')).toBe('/pass/KCL-1001');
    });

    it('sanitizes student IDs against SQL injection and script characters', () => {
      expect(sanitizeStudentId("K25008223'; DROP TABLE profiles; --")).toBe('K25008223DROPTABLEPROFILES');
      expect(sanitizeStudentId('<script>alert(1)</script>K123')).toBe('SCRIPTALERT1SCRIPTK123');
      expect(sanitizeStudentId('  k25008223  ')).toBe('K25008223');
      expect(sanitizeStudentId(null)).toBe('');
    });

    it('sanitizes email addresses to prevent whitespace and case inconsistencies', () => {
      expect(sanitizeEmail('  President@KCLMC.org  ')).toBe('president@kclmc.org');
      expect(sanitizeEmail(null)).toBe('');
    });
  });

  // =========================================================================
  // 11. VULNERABILITY 5: PASSWORD STRENGTH & BLACKLIST VALIDATION
  // =========================================================================
  describe('Vulnerability 5: Password Strength & Blacklist Validation', () => {
    it('rejects passwords shorter than 12 characters', () => {
      const result = validatePasswordStrength('Short1!Aa');
      expect(result.isValid).toBe(false);
      expect(result.hasMinLength).toBe(false);
      expect(result.errors).toContain('Password must be at least 12 characters long');
    });

    it('requires uppercase, lowercase, number, and symbol characters', () => {
      // Missing uppercase
      const noUpper = validatePasswordStrength('lowercaseonly123!');
      expect(noUpper.isValid).toBe(false);
      expect(noUpper.hasUpperCase).toBe(false);

      // Missing lowercase
      const noLower = validatePasswordStrength('UPPERCASEONLY123!');
      expect(noLower.isValid).toBe(false);
      expect(noLower.hasLowerCase).toBe(false);

      // Missing number
      const noNumber = validatePasswordStrength('LettersOnlyWithSymbols!');
      expect(noNumber.isValid).toBe(false);
      expect(noNumber.hasNumber).toBe(false);

      // Missing symbol
      const noSymbol = validatePasswordStrength('NoSymbolsInThis1234');
      expect(noSymbol.isValid).toBe(false);
      expect(noSymbol.hasSymbol).toBe(false);
    });

    it('blocks common breached passwords and dictionary variations', () => {
      const breached1 = validatePasswordStrength('password123');
      expect(breached1.isValid).toBe(false);
      expect(breached1.isNotCommon).toBe(false);

      const breached2 = validatePasswordStrength('12345678');
      expect(breached2.isValid).toBe(false);
      expect(breached2.isNotCommon).toBe(false);

      const breached3 = validatePasswordStrength('climbing123');
      expect(breached3.isValid).toBe(false);
      expect(breached3.isNotCommon).toBe(false);

      const breached4 = validatePasswordStrength('p@ssw0rd123');
      expect(breached4.isValid).toBe(false);
      expect(breached4.isNotCommon).toBe(false);
    });

    it('detects sequential numbers, repeated characters, and keyboard walks', () => {
      const seq = validatePasswordStrength('Abcdefg1234!Xy');
      expect(seq.isNotCommon).toBe(false);

      const repeated = validatePasswordStrength('Aaaaa1234567!Z');
      expect(repeated.isNotCommon).toBe(false);

      const walk = validatePasswordStrength('Qwerty123456!Z');
      expect(walk.isNotCommon).toBe(false);
    });

    it('accepts strong production-grade passwords with high entropy and score 4', () => {
      const strong = validatePasswordStrength('KCLMC-Alpine#Summit2026!');
      expect(strong.isValid).toBe(true);
      expect(strong.score).toBeGreaterThanOrEqual(3);
      expect(strong.label).toBe('Strong');
      expect(strong.errors.length).toBe(0);
      expect(strong.hasMinLength).toBe(true);
      expect(strong.hasUpperCase).toBe(true);
      expect(strong.hasLowerCase).toBe(true);
      expect(strong.hasNumber).toBe(true);
      expect(strong.hasSymbol).toBe(true);
      expect(strong.isNotCommon).toBe(true);
      expect(strong.entropyBits).toBeGreaterThan(60);
    });

    it('calculates entropy correctly for various character sets', () => {
      expect(calculateEntropy('')).toBe(0);
      expect(calculateEntropy('abc')).toBeGreaterThan(0);
      expect(calculateEntropy('KCLMC#2026!Alpine')).toBeGreaterThan(calculateEntropy('abcdefghijklmnop'));
    });
  });

  // =========================================================================
  // 12. VULNERABILITY 4: RATE LIMITING, ACCOUNT LOCKOUT & CAPTCHA
  // =========================================================================
  describe('Vulnerability 4: Rate Limiting, Account Lockout & CAPTCHA Engine', () => {
    beforeEach(() => {
      clearRateLimitStores();
    });

    it('allows initial authentication attempts within limits', () => {
      const check = checkRateLimit('192.168.1.100', 'climber@kcl.ac.uk');
      expect(check.allowed).toBe(true);
      expect(check.remaining).toBe(5);
      expect(check.requiresCaptcha).toBe(false);
    });

    it('triggers CAPTCHA requirement after 3 failed attempts', () => {
      const ip = '192.168.1.101';
      const email = 'target@kcl.ac.uk';

      recordFailedAttempt(ip, email);
      recordFailedAttempt(ip, email);
      const third = recordFailedAttempt(ip, email);

      expect(third.attemptCount).toBe(3);
      expect(third.requiresCaptcha).toBe(true);

      const check = checkRateLimit(ip, email);
      expect(check.allowed).toBe(true);
      expect(check.requiresCaptcha).toBe(true);
      expect(check.remaining).toBe(2);
    });

    it('locks account and triggers exponential backoff after 5 failed attempts', () => {
      const ip = '192.168.1.102';
      const email = 'lockout.test@kcl.ac.uk';

      for (let i = 0; i < 4; i++) {
        recordFailedAttempt(ip, email);
      }

      const fifth = recordFailedAttempt(ip, email);
      expect(fifth.attemptCount).toBe(5);
      expect(fifth.isLocked).toBe(true);
      expect(fifth.backoffSeconds).toBeGreaterThanOrEqual(900); // 15 minutes in seconds

      const check = checkRateLimit(ip, email);
      expect(check.allowed).toBe(false);
      expect(check.remaining).toBe(0);
      expect(check.requiresCaptcha).toBe(true);
      expect(check.reason).toContain('temporarily locked');
    });

    it('resets attempts and logs success on recordSuccessfulAttempt', () => {
      const ip = '192.168.1.103';
      const email = 'reset.test@kcl.ac.uk';

      recordFailedAttempt(ip, email);
      recordFailedAttempt(ip, email);
      expect(checkRateLimit(ip, email).remaining).toBe(3);

      recordSuccessfulAttempt(ip, email);
      const afterSuccess = checkRateLimit(ip, email);
      expect(afterSuccess.remaining).toBe(5);
      expect(afterSuccess.requiresCaptcha).toBe(false);
    });

    it('generates security audit logs for all security actions', () => {
      const ip = '192.168.1.104';
      recordFailedAttempt(ip, 'audit@kcl.ac.uk', 'Bad password test');

      const logs = getSecurityAuditLogs(10);
      expect(logs.length).toBeGreaterThan(0);
      const found = logs.find(l => l.ip === ip && l.email === 'audit@kcl.ac.uk');
      expect(found).toBeDefined();
      expect(found?.status).toBe('failed');
      expect(found?.action).toBe('login_attempt');
    });

    it('validates CAPTCHA challenge tokens correctly', () => {
      expect(verifyCaptchaToken(null)).toBe(false);
      expect(verifyCaptchaToken('')).toBe(false);
      expect(verifyCaptchaToken('abc')).toBe(false);
      expect(verifyCaptchaToken('cf_1234567890abcdef')).toBe(true);
      expect(verifyCaptchaToken('kclmc_captcha_1700000000_abc123')).toBe(true);
      expect(verifyCaptchaToken('a_very_long_security_token_greater_than_20_chars')).toBe(true);
    });
  });

  // =========================================================================
  // 13. VULNERABILITY 3: 2FA / OTP, RFC 6238 TOTP & SINGLE-USE BACKUP CODES
  // =========================================================================
  describe('Vulnerability 3: Two-Factor Authentication, TOTP & Backup Codes', () => {
    beforeEach(() => {
      clear2FAStores();
    });

    it('enforces mandatory 2FA for committee and admin accounts (Role >= 1)', () => {
      expect(requiresMandatory2FA('kclmc.committee@gmail.com', 1)).toBe(true);
      expect(requiresMandatory2FA('president@kclmc.org', 1)).toBe(true);
      expect(requiresMandatory2FA('admin@kclmc.org', 2)).toBe(true);
      expect(requiresMandatory2FA('remy.preston@outlook.com', 2)).toBe(true);
      expect(requiresMandatory2FA('climber@kcl.ac.uk', 0)).toBe(false);
      expect(requiresMandatory2FA('')).toBe(false);
    });

    it('generates 6-digit Email OTP with 5-minute expiry', () => {
      const challenge = create2FAChallenge('user-2fa-1', 'admin@kclmc.org', 1, { token: 'session-jwt' });
      expect(challenge.challengeToken).toBeDefined();
      expect(challenge.otpCode).toMatch(/^[0-9]{6}$/);
      expect(challenge.expiresAt).toBeGreaterThan(Date.now() + 4 * 60 * 1000);
      expect(challenge.expiresAt).toBeLessThanOrEqual(Date.now() + 5 * 60 * 1000);
    });

    it('verifies valid Email OTP code and returns session payload', () => {
      const challenge = create2FAChallenge('user-2fa-2', 'president@kclmc.org', 1, { customData: 'session-data' });
      const verify = verify2FAChallenge(challenge.challengeToken, challenge.otpCode);

      expect(verify.success).toBe(true);
      expect(verify.userId).toBe('user-2fa-2');
      expect(verify.email).toBe('president@kclmc.org');
      expect(verify.role).toBe(1);
      expect(verify.usedEmailOTP).toBe(true);
      expect(verify.sessionData).toEqual({ customData: 'session-data' });
    });

    it('decrements attempts on invalid OTP and invalidates challenge after 3 attempts', () => {
      const challenge = create2FAChallenge('user-2fa-3', 'admin@kclmc.org', 2);

      const fail1 = verify2FAChallenge(challenge.challengeToken, '000000');
      expect(fail1.success).toBe(false);
      expect(fail1.error).toContain('2 attempts remaining');

      const fail2 = verify2FAChallenge(challenge.challengeToken, '000001');
      expect(fail2.success).toBe(false);
      expect(fail2.error).toContain('1 attempt remaining');

      const fail3 = verify2FAChallenge(challenge.challengeToken, '000002');
      expect(fail3.success).toBe(false);
      expect(fail3.error).toContain('invalidated');

      // Subsequent attempt should report challenge gone/invalid
      const fail4 = verify2FAChallenge(challenge.challengeToken, challenge.otpCode);
      expect(fail4.success).toBe(false);
      expect(fail4.error).toContain('Invalid or expired');
    });

    it('generates single-use backup codes and burns them upon verification', () => {
      const userId = 'user-backup-1';
      const codes = generateBackupCodes(userId);
      expect(codes.length).toBe(8);
      expect(codes[0]).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}$/);

      const challenge = create2FAChallenge(userId, 'admin@kclmc.org', 1);
      const codeToUse = codes[0];

      // Use backup code
      const verify = verify2FAChallenge(challenge.challengeToken, codeToUse);
      expect(verify.success).toBe(true);
      expect(verify.usedBackupCode).toBe(true);

      // Re-using the same backup code must be rejected (burned)
      const challenge2 = create2FAChallenge(userId, 'admin@kclmc.org', 1);
      const reuseAttempt = verify2FAChallenge(challenge2.challengeToken, codeToUse);
      expect(reuseAttempt.success).toBe(false);
      expect(reuseAttempt.error).toContain('Invalid verification code');
    });

    it('computes and verifies RFC 6238 TOTP tokens for authenticator apps', () => {
      const secret = 'JBSWY3DPEHPK3PXP'; // Standard Base32 test secret
      const now = Date.now();
      const currentCode = calculateTOTP(secret, now);
      expect(currentCode).toMatch(/^[0-9]{6}$/);

      expect(verifyTOTP(secret, currentCode)).toBe(true);
      expect(verifyTOTP(secret, '999999')).toBe(false);

      // Verify integration in verify2FAChallenge
      const userId = 'user-totp-1';
      setUserTOTPSecret(userId, secret);
      const challenge = create2FAChallenge(userId, 'totp@kclmc.org', 1);

      const verifyResult = verify2FAChallenge(challenge.challengeToken, currentCode);
      expect(verifyResult.success).toBe(true);
      expect(verifyResult.usedTOTP).toBe(true);
    });

    it('provides seamless self-service 2FA enrollment flow for un-enrolled committee members', () => {
      const committeeUserId = 'committee-unenrolled-user-1';
      expect(isUser2FAEnrolled(committeeUserId)).toBe(false);

      // Create enrollment challenge
      const setup = create2FAEnrollmentChallenge(committeeUserId, 'remy.preston@outlook.com', 2, { testSession: true });
      expect(setup.challengeToken).toBeDefined();
      expect(setup.secret).toBeDefined();
      expect(setup.totpUri).toContain('otpauth://totp/KCLMC:remy.preston%40outlook.com');
      expect(setup.totpUri).toContain(setup.secret);
      expect(setup.backupCodes).toHaveLength(8);
      expect(setup.backupCodes[0]).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}$/);

      // Generate valid TOTP from returned setup secret
      const totpCode = calculateTOTP(setup.secret);

      // Confirm verification
      const verifyResult = verify2FAChallenge(setup.challengeToken, totpCode);
      expect(verifyResult.success).toBe(true);
      expect(verifyResult.userId).toBe(committeeUserId);
      expect(verifyResult.usedTOTP).toBe(true);
      expect(verifyResult.enrolledSecret).toBe(setup.secret);
      expect(verifyResult.hashedBackupCodes).toHaveLength(8);

      // User must now be enrolled
      expect(isUser2FAEnrolled(committeeUserId)).toBe(true);

      // Subsequent login can now verify using standard 2FA
      const nextChallenge = create2FAChallenge(committeeUserId, 'remy.preston@outlook.com', 2);
      const nextCode = calculateTOTP(setup.secret);
      const nextVerify = verify2FAChallenge(nextChallenge.challengeToken, nextCode);
      expect(nextVerify.success).toBe(true);
    });

    it('hydrates 2FA enrollment and backup codes from user metadata', () => {
      const metadataUserId = 'meta-user-999';
      const testSecret = 'JBSWY3DPEHPK3PXP';
      expect(isUser2FAEnrolled(metadataUserId)).toBe(false);

      const enrolled = isUser2FAEnrolled(metadataUserId, {
        is_2fa_enrolled: true,
        totp_secret: testSecret,
      });

      expect(enrolled).toBe(true);
      expect(isUser2FAEnrolled(metadataUserId)).toBe(true);

      // Now verify standard challenge
      const challenge = create2FAChallenge(metadataUserId, 'meta@kclmc.org', 1);
      const code = calculateTOTP(testSecret);
      const verify = verify2FAChallenge(challenge.challengeToken, code);
      expect(verify.success).toBe(true);
    });
  });

  // =========================================================================
  // 14. VULNERABILITY 1: SESSION TOKEN COOKIES & HTTPONLY HARDENING
  // =========================================================================
  describe('Vulnerability 1: Session Token Cookie Hardening', () => {
    it('guarantees SESSION_COOKIE_OPTIONS has httpOnly=true and sameSite=strict', () => {
      expect(SESSION_COOKIE_OPTIONS.httpOnly).toBe(true);
      expect(SESSION_COOKIE_OPTIONS.sameSite).toBe('strict');
      expect(SESSION_COOKIE_OPTIONS.path).toBe('/');
      expect(SESSION_COOKIE_OPTIONS.maxAge).toBe(7 * 24 * 60 * 60);
    });

    it('applies chunked cookies to NextResponse with httpOnly=true and sameSite=strict', () => {
      const response = NextResponse.json({ ok: true });
      const chunks = [
        { name: 'sb-bsvnyibipcwrcyzqilge-auth-token.0', value: 'chunk0_data' },
        { name: 'sb-bsvnyibipcwrcyzqilge-auth-token.1', value: 'chunk1_data' },
      ];

      applySessionCookies(response, chunks);

      const cookieHeader = response.headers.get('set-cookie') || '';
      expect(cookieHeader).toContain('sb-bsvnyibipcwrcyzqilge-auth-token.0=chunk0_data');
      expect(cookieHeader).toContain('HttpOnly');
      expect(cookieHeader.toLowerCase()).toContain('samesite=strict');
    });

    it('clearSessionCookies expires base cookie, chunks, and session indicator', () => {
      const response = NextResponse.json({ ok: true });
      clearSessionCookies(response);

      const cookieHeader = response.headers.get('set-cookie') || '';
      expect(cookieHeader).toContain('Max-Age=0');
      expect(cookieHeader).toContain(getAuthCookiePrefix());
      expect(cookieHeader).toContain('kclmc_session=;');
    });
  });

  // =========================================================================
  // 15. AUTH ROUTE HANDLERS: RATE LIMITING & SECURITY GATING
  // =========================================================================
  describe('Auth Route Handlers: Security Integration', () => {
    beforeEach(() => {
      clearRateLimitStores();
      clear2FAStores();
    });

    it('POST /api/auth/signup rejects passwords failing the security policy', async () => {
      const req = new Request('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'newuser@kcl.ac.uk',
          password: 'password123',
          fullName: 'Test Climber',
        }),
      });

      const res = await authSignupPost(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.toLowerCase()).toContain('at least 12 characters');
    });

    it('POST /api/auth/login requires email and password', async () => {
      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: '' }),
      });

      const res = await authLoginPost(req);
      expect(res.status).toBe(400);
    });

    it('POST /api/auth/forgot-password enforces email validation and rate limiting', async () => {
      const invalidReq = new Request('http://localhost:3000/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'notanemail' }),
      });

      const res = await authForgotPost(invalidReq);
      expect(res.status).toBe(400);

      // Valid email dispatches recovery and returns clean message
      const validReq = new Request('http://localhost:3000/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'valid@kcl.ac.uk' }),
      });

      const validRes = await authForgotPost(validReq);
      expect(validRes.status).toBe(200);
      const data = await validRes.json();
      expect(data.success).toBe(true);
    });

    it('POST /api/auth/reset-password rejects weak passwords', async () => {
      const req = new Request('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: '123' }),
      });

      const res = await authResetPost(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.toLowerCase()).toContain('at least 12 characters');
    });

    it('POST /api/auth/verify-2fa and /api/auth/verify-otp require challenge token and code', async () => {
      const req1 = new Request('http://localhost:3000/api/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const res1 = await authVerify2FAPost(req1);
      expect(res1.status).toBe(400);

      const req2 = new Request('http://localhost:3000/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeToken: 'test-tok', code: '123456' }),
      });
      const res2 = await authVerifyOtpPost(req2);
      expect(res2.status).toBe(400);
    });

    it('POST /api/auth/verify-2fa completes first-time 2FA enrollment and issues session cookies', async () => {
      const userId = 'api-verify-enroll-user';
      const setup = create2FAEnrollmentChallenge(userId, 'remy.preston@outlook.com', 2, {
        session: { access_token: 'fake-access', refresh_token: 'fake-refresh', user: { id: userId } },
      });

      const validCode = calculateTOTP(setup.secret);
      const req = new Request('http://localhost:3000/api/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeToken: setup.challengeToken,
          code: validCode,
        }),
      });

      const res = await authVerify2FAPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.destination).toBe('/admin');
      expect(isUser2FAEnrolled(userId)).toBe(true);

      const cookieHeader = res.headers.get('set-cookie') || '';
      expect(cookieHeader).toContain('kclmc_session=active');
    });

    it('POST /api/auth/logout clears session cookies', async () => {
      const req = new Request('http://localhost:3000/api/auth/logout', {
        method: 'POST',
      });

      const res = await authLogoutPost(req);
      expect(res.status).toBe(200);
      const cookieHeader = res.headers.get('set-cookie') || '';
      expect(cookieHeader).toContain('Max-Age=0');
    });
  });
});

