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
let cachedDb: D1Database | null = null;

/**
 * Override the D1 database instance (primarily for automated testing).
 */
export function setD1DatabaseOverride(db: D1Database | null): void {
  dbOverride = db;
  if (!db) {
    cachedDb = null;
  }
}

/**
 * Returns the current D1 database instance.
 * Returns null if not running in Cloudflare Workers and no override is set.
 */
export async function getD1Database(): Promise<D1Database | null> {
  if (dbOverride) {
    return dbOverride;
  }
  if (cachedDb) {
    return cachedDb;
  }

  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    let ctx: any;
    try {
      ctx = await (getCloudflareContext as any)({ async: true });
    } catch {
      ctx = await getCloudflareContext();
    }
    const env = ctx?.env;
    if (env?.DB) {
      cachedDb = env.DB as D1Database;
      return cachedDb;
    }
  } catch {
    // Not running inside Cloudflare Worker runtime
  }

  // Check if globally bound in Cloudflare worker globalThis or process.env
  const globalEnv = (globalThis as any)?.env;
  if (globalEnv?.DB) {
    cachedDb = globalEnv.DB as D1Database;
    return cachedDb;
  }

  if ((globalThis as any)?.DB) {
    cachedDb = (globalThis as any).DB as D1Database;
    return cachedDb;
  }

  if ((process.env as any)?.DB) {
    cachedDb = (process.env as any).DB as D1Database;
    return cachedDb;
  }

  return null;
}

/**
 * Returns the Cloudflare Worker environment bindings (DB, EMAIL, etc.).
 */
export async function getCloudflareEnv(): Promise<Record<string, any>> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    let ctx: any;
    try {
      ctx = await (getCloudflareContext as any)({ async: true });
    } catch {
      ctx = await getCloudflareContext();
    }
    if (ctx?.env) {
      return ctx.env;
    }
  } catch {
    // Not running inside Cloudflare Worker runtime
  }

  const globalEnv = (globalThis as any)?.env;
  if (globalEnv) return globalEnv;

  return (globalThis as any) || {};
}

