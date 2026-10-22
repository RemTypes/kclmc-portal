/**
 * KCLMC Portal Links Domain Module
 * 
 * Manages official directory links for social media bios (Instagram, SU, Linktree alternative).
 * All link data is dynamically loaded and managed through the Supabase database.
 */

export interface PortalLink {
  id: string;
  title: string;
  url: string;
  subtitle?: string | null;
  icon?: string;
  sort_order: number;
  is_active: boolean;
  is_highlighted: boolean;
  created_at?: string;
  updated_at?: string;
}

export const LEGACY_DEFAULT_LINK_IDS: Record<string, string> = {
  'link-kclsu-shop': '00000000-0000-4000-8000-000000000001',
  'link-membership-pass': '00000000-0000-4000-8000-000000000002',
  'link-club-hub': '00000000-0000-4000-8000-000000000003',
  'link-guides': '00000000-0000-4000-8000-000000000004',
  'link-drops': '00000000-0000-4000-8000-000000000005',
};

/**
 * Normalizes link IDs, resolving legacy string IDs to valid UUIDs.
 */
export function resolveLinkId(id: string): string {
  if (LEGACY_DEFAULT_LINK_IDS[id]) {
    return LEGACY_DEFAULT_LINK_IDS[id];
  }
  return id;
}

/**
 * Checks if a string is a standard RFC4122 UUID.
 */
export function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Validates and normalizes URLs for bio links.
 * Allows root-relative portal links (/membership) or absolute HTTP/HTTPS URLs.
 * Rejects dangerous schemes like javascript: or data: and falls back to '#'.
 */
export function sanitizeLinkUrl(url: string | null | undefined): string {
  if (!url) return '#';
  const clean = url.trim();
  if (!clean) return '#';
  if (/^(javascript|data|vbscript):/i.test(clean)) return '#';
  if (clean.startsWith('/')) return clean;
  if (/^https?:\/\//i.test(clean)) return clean;
  if (clean.startsWith('mailto:')) return clean;
  if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(clean)) {
    return `https://${clean}`;
  }
  return '#';
}
