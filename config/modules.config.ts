export interface ModuleDefinition {
  id: string;
  name: string;
  description: string;
  route: string;
  brand: 'kclmc' | 'lube' | 'shared' | 'admin';
  enabled: boolean;
  requiredRole: 0 | 1 | 2; // 0: Public, 1: Committee, 2: SuperAdmin
  allowOnlySuperAdmin?: boolean;
  category: 'content' | 'drops' | 'competitions' | 'admin' | 'tools';
}

export const modulesConfig: Record<string, ModuleDefinition> = {
  club: {
    id: 'club',
    name: 'KCLMC Club Hub',
    description: 'Mountaineering, trad, and club sessions hub',
    route: '/',
    brand: 'kclmc',
    enabled: true,
    requiredRole: 0,
    category: 'content',
  },
  trips: {
    id: 'trips',
    name: 'Trips Calendar',
    description: 'Upcoming mountaineering, trad, and winter climbing trips',
    route: '/trips',
    brand: 'kclmc',
    enabled: true,
    requiredRole: 0,
    category: 'content',
  },
  guides: {
    id: 'guides',
    name: 'Crags & Gyms Guides',
    description: 'Crag directories and London wall discount information',
    route: '/guides',
    brand: 'kclmc',
    enabled: true,
    requiredRole: 0,
    category: 'content',
  },
  dropsKclmc: {
    id: 'dropsKclmc',
    name: 'KCLMC Merch Drops',
    description: 'KCLMC Alpine group-buy pre-orders with live MOQ tracker',
    route: '/drops/kclmc',
    brand: 'kclmc',
    enabled: true,
    requiredRole: 0,
    category: 'drops',
  },
  membership: {
    id: 'membership',
    name: 'Membership Portal',
    description: 'Digital KCLMC membership card, climber ID, and safety profile',
    route: '/membership',
    brand: 'kclmc',
    enabled: true,
    requiredRole: 0,
    category: 'content',
  },
  lubeComps: {
    id: 'lubeComps',
    name: 'LUBE Comps Schedule',
    description: 'London University Bouldering Events rounds and venue dates',
    route: '/comps',
    brand: 'lube',
    enabled: false,
    requiredRole: 0,
    category: 'competitions',
  },
  lubeLeaderboard: {
    id: 'lubeLeaderboard',
    name: 'LUBE Leaderboard',
    description: 'University and individual live rankings across comp rounds',
    route: '/leaderboard',
    brand: 'lube',
    enabled: false,
    requiredRole: 0,
    category: 'competitions',
  },
  lubeScoring: {
    id: 'lubeScoring',
    name: 'Circuit Engine Live Scoring',
    description: 'Circuit-based bouldering scorecard with instant Flash/Top/Zone logging',
    route: '/scoring',
    brand: 'lube',
    enabled: false,
    requiredRole: 0,
    category: 'competitions',
  },
  dropsLube: {
    id: 'dropsLube',
    name: 'LUBE Chalk Drop',
    description: 'LUBE high-contrast chalk monochrome official series apparel',
    route: '/drops/lube',
    brand: 'lube',
    enabled: false,
    requiredRole: 0,
    category: 'drops',
  },
  adminReconcile: {
    id: 'adminReconcile',
    name: 'Payment Reconciliation',
    description: '3-tier CSV matching engine for KCLSU payment reports',
    route: '/admin/reconcile',
    brand: 'admin',
    enabled: true,
    requiredRole: 1,
    category: 'admin',
  },
  adminExport: {
    id: 'adminExport',
    name: 'Manufacturer Export',
    description: 'Sizing matrix and printer specification CSV generator',
    route: '/admin/export',
    brand: 'admin',
    enabled: true,
    requiredRole: 1,
    category: 'admin',
  },
  adminScan: {
    id: 'adminScan',
    name: 'Pass Scanner',
    description: 'Mobile QR and code scanner for check-ins at climbing walls',
    route: '/admin/scan',
    brand: 'admin',
    enabled: true,
    requiredRole: 1,
    category: 'admin',
  },
  adminModules: {
    id: 'adminModules',
    name: 'Modules & Permissions Manager',
    description: 'Control module toggles, routes, and role-based permissions',
    route: '/admin/modules',
    brand: 'admin',
    enabled: true,
    requiredRole: 1,
    category: 'admin',
  },
};

export function getModuleByRoute(pathname: string): ModuleDefinition | undefined {
  return Object.values(modulesConfig).find(
    m => m.route === pathname || (m.route !== '/' && pathname.startsWith(m.route))
  );
}

export function canAccessRoute(pathname: string, userRole: number): boolean {
  const moduleDef = getModuleByRoute(pathname);
  if (!moduleDef) return true; // Unregistered route defaults to open unless protected by middleware
  if (!moduleDef.enabled && userRole < 2) return false;
  return userRole >= moduleDef.requiredRole;
}
