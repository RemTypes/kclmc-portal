import { describe, it, expect } from 'vitest';
import {
  auditFileContent,
  COPY_AUDIT_RULES,
  runFrontendCopyAudit,
  findFilesToScan
} from '../scripts/check_frontend_copy';

describe('Frontend Copy & Text Audit Engine', () => {
  it('detects outdated Supabase references in JSX text and string literals', () => {
    const mockJsx = `
      export default function AdminPage() {
        return (
          <div>
            <h1>Admin Panel</h1>
            <p>All data is synced with Supabase Postgres automatically.</p>
            <span>Supabase Connected</span>
          </div>
        );
      }
    `;

    const violations = auditFileContent('/test/mock/page.tsx', mockJsx);
    const supabaseErrors = violations.filter(v => v.ruleId === 'OUTDATED_STORAGE_SUPABASE');

    expect(supabaseErrors.length).toBe(2);
    expect(supabaseErrors[0].match.toLowerCase()).toBe('supabase');
    expect(supabaseErrors[0].severity).toBe('error');
    expect(supabaseErrors[0].suggestion).toContain('Cloudflare D1');
  });

  it('ignores standard import statements for legacy code seams', () => {
    const mockCode = `
      import { createClient } from '@/lib/supabase/client';
      import { supabaseMock } from '@/lib/supabase';
      
      export const config = { runtime: 'edge' };
    `;

    const violations = auditFileContent('/test/mock/page.tsx', mockCode);
    const supabaseErrors = violations.filter(v => v.ruleId === 'OUTDATED_STORAGE_SUPABASE');

    expect(supabaseErrors.length).toBe(0);
  });

  it('detects deprecated 2FA and authenticator app prompts', () => {
    const mockLoginJsx = `
      export default function LoginPage() {
        return (
          <div>
            <h2>Two-Factor Authentication is required for your account</h2>
            <p>Please scan QR with Authenticator App</p>
            <button>Activate 2FA</button>
          </div>
        );
      }
    `;

    const violations = auditFileContent('/test/mock/login.tsx', mockLoginJsx);
    const twoFactorWarnings = violations.filter(v => v.ruleId === 'DEPRECATED_2FA_MESSAGING');

    expect(twoFactorWarnings.length).toBeGreaterThan(0);
    expect(twoFactorWarnings.some(w => w.context.includes('Authenticator App'))).toBe(true);
  });

  it('detects hardcoded localhost URLs in client components', () => {
    const mockJsx = `
      export function Banner() {
        return <a href="http://localhost:3000/api/download">Download</a>;
      }
    `;

    const violations = auditFileContent('/test/mock/banner.tsx', mockJsx);
    const localhostErrors = violations.filter(v => v.ruleId === 'DEV_LOCALHOST_URL_IN_UI');

    expect(localhostErrors.length).toBe(1);
    expect(localhostErrors[0].severity).toBe('error');
  });

  it('detects calls to retired 2FA endpoints', () => {
    const mockJsx = `
      async function setup() {
        await fetch('/api/auth/setup-2fa');
        await fetch('/api/auth/verify-2fa', { method: 'POST' });
      }
    `;

    const violations = auditFileContent('/test/mock/setup.tsx', mockJsx);
    const deadEndpointWarnings = violations.filter(v => v.ruleId === 'DEAD_2FA_API_ENDPOINTS');

    expect(deadEndpointWarnings.length).toBe(2);
  });

  it('scans frontend directories and collects files successfully', () => {
    const files = findFilesToScan(process.cwd());
    expect(files.length).toBeGreaterThan(10);
    expect(files.some(f => f.includes('app/'))).toBe(true);
  });
});
