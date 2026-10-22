/**
 * KCLMC Portal Links Domain Module
 * 
 * Manages official directory links for social media bios (Instagram, SU, Linktree alternative).
 * Provides default fallbacks, data types, and sanitization.
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

export const DEFAULT_PORTAL_LINKS: PortalLink[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    title: 'Buy 2026/27 Membership',
    url: 'https://www.kclsu.org/groups/sports/join/mountaineerclimbsoc/',
    subtitle: 'Official KCLSU Union Shop • Required for meets & pass',
    icon: '🏛️',
    sort_order: 1,
    is_active: true,
    is_highlighted: true,
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    title: 'Activate Digital Climbing Pass',
    url: '/membership',
    subtitle: 'Safety gate, wall discount pass & verification QR',
    icon: '🧗',
    sort_order: 2,
    is_active: true,
    is_highlighted: false,
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    title: 'Official Club Website & Hub',
    url: '/',
    subtitle: "King's College London Mountaineering Club",
    icon: '⛰️',
    sort_order: 3,
    is_active: true,
    is_highlighted: false,
  },
  {
    id: '00000000-0000-4000-8000-000000000004',
    title: 'Where We Climb & Gym Discounts',
    url: '/guides',
    subtitle: 'London wall guide, partner discounts & crag topos',
    icon: '📍',
    sort_order: 4,
    is_active: true,
    is_highlighted: false,
  },
  {
    id: '00000000-0000-4000-8000-000000000005',
    title: 'Society Stash & Apparel Drops',
    url: '/drops/kclmc',
    subtitle: 'Official society tees, hoodies & gear drops',
    icon: '👕',
    sort_order: 5,
    is_active: true,
    is_highlighted: false,
  },
];

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
