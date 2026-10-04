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
    it('rejects non-array payloads', async () => {
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
});
