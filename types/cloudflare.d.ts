import type {
  D1Database as CloudflareD1Database,
  D1PreparedStatement as CloudflareD1PreparedStatement,
  D1Response as CloudflareD1Response,
  D1Result as CloudflareD1Result,
  R2Bucket as CloudflareR2Bucket,
  Fetcher as CloudflareFetcher,
} from '@cloudflare/workers-types';

declare global {
  type D1Database = CloudflareD1Database;
  type D1PreparedStatement = CloudflareD1PreparedStatement;
  type D1Response = CloudflareD1Response;
  type D1Result<T = unknown> = CloudflareD1Result<T>;
  type R2Bucket = CloudflareR2Bucket;
  type Fetcher = CloudflareFetcher;
}
