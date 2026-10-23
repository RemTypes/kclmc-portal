/**
 * KCLMC Platform - Cloudflare D1 Database Access Layer
 * 
 * Provides resilient access to Cloudflare D1 across:
 * 1. Cloudflare Workers Edge runtime (via @opennextjs/cloudflare getCloudflareContext().env.DB)
 * 2. Local test / Vitest environment (via in-memory mock or injected test adapter)
 */

export interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[]; success: boolean; meta?: any }>;
  run(): Promise<{ success: boolean; meta?: any }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<Array<{ results?: T[]; success: boolean; meta?: any }>>;
  exec(query: string): Promise<{ count: number; duration: number }>;
}

let dbOverride: D1Database | null = null;

/**
 * Override the D1 database instance (primarily for automated testing).
 */
export function setD1DatabaseOverride(db: D1Database | null): void {
  dbOverride = db;
}

/**
 * Returns the current D1 database instance.
 * Returns null if not running in Cloudflare Workers and no override is set.
 */
export async function getD1Database(): Promise<D1Database | null> {
  if (dbOverride) {
    return dbOverride;
  }

  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    const env = (ctx as any)?.env;
    if (env?.DB) {
      return env.DB as D1Database;
    }
  } catch {
    // Not running inside Cloudflare Worker runtime
  }

  // Check if globally bound in Cloudflare worker globalThis
  const globalEnv = (globalThis as any)?.env;
  if (globalEnv?.DB) {
    return globalEnv.DB as D1Database;
  }

  return null;
}
