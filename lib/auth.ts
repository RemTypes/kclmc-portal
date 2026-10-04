export type Role = 0 | 1 | 2;

export const ROLE_NAMES: Record<Role, string> = {
  0: 'Public / Climber',
  1: 'Committee Member',
  2: 'SuperAdmin',
};

export function getSuperAdminEmail(): string {
  return process.env.SUPERADMIN_EMAIL || 'admin@kclmc.org';
}

export function getUserRole(email: string | null | undefined, roleOverride?: string | null): Role {
  if (roleOverride !== undefined && roleOverride !== null && roleOverride !== '') {
    const parsed = parseInt(roleOverride, 10);
    if (parsed === 0 || parsed === 1 || parsed === 2) return parsed as Role;
  }
  if (!email) return 0;
  const normalized = email.toLowerCase().trim();
  const superAdmin = getSuperAdminEmail().toLowerCase().trim();
  if (
    normalized === superAdmin ||
    normalized === 'remy.preston@outlook.com' ||
    normalized === 'remy.preston@kcl.ac.uk'
  ) {
    return 2;
  }
  const committeeEmails = (process.env.COMMITTEE_EMAILS || 'kclmc.committee@gmail.com,president@kclmc.org,treasurer@kclmc.org,gear@kclmc.org,trips@kclmc.org,social@kclmc.org,portal@kclmc.org,remy.preston@outlook.com,remy.preston@kcl.ac.uk')
    .split(',')
    .map(e => e.trim().toLowerCase());
  if (committeeEmails.includes(normalized)) return 1;
  return 0;
}

export async function getAuthenticatedUserRole(
  supabase: any,
  user: { id?: string; email?: string | null } | null | undefined
): Promise<Role> {
  if (!user) return 0;

  // 1. Check email whitelist first
  const emailRole = getUserRole(user.email);
  if (emailRole >= 1) return emailRole;

  // 2. Query profiles table in Supabase if client & user ID exist
  if (supabase && typeof supabase.from === 'function' && user.id) {
    try {
      const query = supabase.from('profiles').select('role').eq('id', user.id);
      const res = typeof query?.maybeSingle === 'function'
        ? await query.maybeSingle()
        : (typeof query?.single === 'function' ? await query.single() : null);

      const profile = res?.data;
      if (profile && (profile.role === 1 || profile.role === 2)) {
        return profile.role as Role;
      }
    } catch (e) {
      console.warn('Failed to query user profile role:', e);
    }
  }

  return 0;
}

export function getSafeRedirectUrl(target: string | null | undefined, fallback: string = '/membership'): string {
  if (!target) return fallback;
  const trimmed = target.trim();
  // Ensure target is a relative internal path starting with a single slash
  // Disallow protocol-relative URLs (//), backslash tricks (/\), schemes (http:, javascript:), and null bytes
  if (
    trimmed.startsWith('/') &&
    !trimmed.startsWith('//') &&
    !trimmed.startsWith('/\\') &&
    !trimmed.includes(':') &&
    !trimmed.includes('\0')
  ) {
    return trimmed;
  }
  return fallback;
}

export function sanitizeStudentId(id: string | null | undefined): string {
  if (!id) return '';
  return id.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 32);
}

export function sanitizeEmail(email: string | null | undefined): string {
  if (!email) return '';
  return email.trim().toLowerCase().slice(0, 255);
}

export const UNIVERSITIES = [
  "King's College London",
  "University College London (UCL)",
  "Imperial College London",
  "Queen Mary University of London (QMUL)",
  "London School of Economics (LSE)",
  "Brunel University London",
  "City, University of London",
  "St George's, University of London",
  "Birkbeck, University of London",
  "Royal Holloway, University of London",
  "SOAS University of London",
  "Other UK Institution",
  "Alumni / Associate / Guest",
] as const;

export type UniversityOption = (typeof UNIVERSITIES)[number] | string;

export const DEFAULT_UNIVERSITY = "King's College London";

export function sanitizeUniversity(uni: string | null | undefined): string {
  if (!uni) return DEFAULT_UNIVERSITY;
  const trimmed = uni.trim().slice(0, 150);
  return trimmed || DEFAULT_UNIVERSITY;
}

