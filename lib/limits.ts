/**
 * Free-tier guardrails for the hackathon (Supabase Free + Vercel Hobby).
 *
 * Why these numbers (verified on the pricing pages, Oct 2026):
 * - Supabase Free: 500 MB database, 1 GB Storage, 5 GB egress (+5 GB
 *   cached), project paused after 1 week of inactivity.
 * - Vercel Hobby: 100 GB Fast Data Transfer, 1M function invocations,
 *   4 h Fluid Active CPU / month, 5K image transformations / month.
 *
 * The caps below keep the demo far from every ceiling even under abuse:
 * - 5,000 productos x ~13 KB (vector(1536) row + HNSW index) ~= 65 MB DB.
 * - 300 tiendas with one ~300 KB compressed photo each ~= 90 MB Storage.
 * - Every search/upload still costs one Meta/OpenAI call, so per-IP
 *   windows + a query-embedding cache bound that spend too.
 *
 * All values are env-overridable (LIMIT_*) so a paid upgrade or a hotter
 * demo day is a config change, not a code change. Invalid env values
 * fall back to the defaults.
 */

function intEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export const LIMITS = {
  /** Server rejects menu photos above this (client compresses to ~300 KB). */
  uploadMaxImageBytes: intEnv("LIMIT_UPLOAD_MAX_IMAGE_BYTES", 4 * 1024 * 1024, 256 * 1024, 8 * 1024 * 1024),
  /** Products accepted per upload (was 200: one menu could eat ~2.6 MB DB). */
  uploadMaxProducts: intEnv("LIMIT_UPLOAD_MAX_PRODUCTS", 60, 1, 200),
  uploadRatePerMinute: intEnv("LIMIT_UPLOAD_RATE_PER_MINUTE", 5, 1, 60),
  uploadRatePerHour: intEnv("LIMIT_UPLOAD_RATE_PER_HOUR", 20, 1, 1000),
  searchRatePerMinute: intEnv("LIMIT_SEARCH_RATE_PER_MINUTE", 30, 1, 300),
  /** Rows returned per search (bounds RPC work + response egress). */
  searchMaxResults: intEnv("LIMIT_SEARCH_MAX_RESULTS", 20, 1, 50),
  tiendaRatePerMinute: intEnv("LIMIT_TIENDA_RATE_PER_MINUTE", 60, 1, 600),
  tiendaMaxProducts: intEnv("LIMIT_TIENDA_MAX_PRODUCTS", 100, 1, 500),
  /** Global demo caps: new tiendas are refused (503) once reached. */
  maxTiendas: intEnv("LIMIT_MAX_TIENDAS", 300, 1, 100_000),
  maxProductos: intEnv("LIMIT_MAX_PRODUCTOS", 5_000, 1, 1_000_000),
  /** Daily cron re-embeds at most this many pending productos. */
  cronRetryBatch: intEnv("LIMIT_CRON_RETRY_BATCH", 20, 1, 50),
  /** In-memory cache for identical search-query embeddings. */
  queryEmbeddingCacheEntries: intEnv("LIMIT_QUERY_CACHE_ENTRIES", 500, 0, 10_000),
  queryEmbeddingCacheTtlMs: intEnv("LIMIT_QUERY_CACHE_TTL_MS", 10 * 60_000, 0, 3_600_000),
} as const;
