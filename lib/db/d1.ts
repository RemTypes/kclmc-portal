import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { D1Database, D1Response } from '@cloudflare/workers-types';

let testD1Database: D1Database | null = null;

/**
 * Allows test suites to inject a mock D1Database instance.
 */
export function setTestD1Database(db: D1Database | null) {
  testD1Database = db;
}

/**
 * Returns the Cloudflare D1 Database binding if running inside the Worker runtime,
 * or null if running in standard Node.js development or testing environments.
 */
export async function getD1Database(): Promise<D1Database | null> {
  if (testD1Database) {
    return testD1Database;
  }

  try {
    const { env } = await getCloudflareContext();
    return (env as any)?.DB || null;
  } catch {
    // getCloudflareContext throws when executed outside of Cloudflare workerd runtime
    return null;
  }
}

/**
 * Checks if Cloudflare D1 is actively available in the current execution context.
 */
export async function isD1Available(): Promise<boolean> {
  const db = await getD1Database();
  return db !== null;
}

/**
 * Helper to execute a query on D1 and return typed results.
 */
export async function queryD1<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const db = await getD1Database();
  if (!db) {
    throw new Error('Cloudflare D1 is not available in this environment');
  }

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<T>();
  return result.results || [];
}

/**
 * Helper to execute a single row query on D1.
 */
export async function queryOneD1<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const db = await getD1Database();
  if (!db) {
    throw new Error('Cloudflare D1 is not available in this environment');
  }

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.first<T>();
  return result || null;
}

/**
 * Helper to execute an INSERT, UPDATE, or DELETE on D1.
 */
export async function executeD1(sql: string, params: any[] = []): Promise<D1Response> {
  const db = await getD1Database();
  if (!db) {
    throw new Error('Cloudflare D1 is not available in this environment');
  }

  const stmt = db.prepare(sql).bind(...params);
  return await stmt.run();
}
