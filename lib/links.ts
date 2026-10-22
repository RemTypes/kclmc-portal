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
    id: 'link-kclsu-shop',
    title: 'Buy 2026/27 Membership',
    url: 'https://www.kclsu.org/groups/sports/join/mountaineerclimbsoc/',
    subtitle: 'Official KCLSU Union Shop • Required for meets & pass',
    icon: '🏛️',
    sort_order: 1,
    is_active: true,
    is_highlighted: true,
  },
  {
    id: 'link-membership-pass',
    title: 'Activate Digital Climbing Pass',
    url: '/membership',
    subtitle: 'Safety gate, wall discount pass & verification QR',
    icon: '🧗',
    sort_order: 2,
    is_active: true,
    is_highlighted: false,
  },
  {
    id: 'link-club-hub',
    title: 'Official Club Website & Hub',
    url: '/',
    subtitle: "King's College London Mountaineering Club",
    icon: '⛰️',
    sort_order: 3,
    is_active: true,
    is_highlighted: false,
  },
  {
    id: 'link-guides',
    title: 'Where We Climb & Gym Discounts',
    url: '/guides',
    subtitle: 'London wall guide, partner discounts & crag topos',
    icon: '📍',
    sort_order: 4,
    is_active: true,
    is_highlighted: false,
  },
  {
    id: 'link-drops',
    title: 'Society Stash & Apparel Drops',
    url: '/drops/kclmc',
    subtitle: 'Official society tees, hoodies & gear drops',
    icon: '👕',
    sort_order: 5,
    is_active: true,
    is_highlighted: false,
  },
];

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
