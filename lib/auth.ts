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
  const superAdmin = getSuperAdminEmail();
  if (email.toLowerCase() === superAdmin.toLowerCase()) return 2;
  const committeeEmails = (process.env.COMMITTEE_EMAILS || 'president@kclmc.org,treasurer@kclmc.org,gear@kclmc.org,trips@kclmc.org,social@kclmc.org,portal@kclmc.org')
    .split(',')
    .map(e => e.trim().toLowerCase());
  if (committeeEmails.includes(email.toLowerCase())) return 1;
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
