/**
 * Shared text-embedding client for BarrioAI.
 *
 * CRITICAL INVARIANT: product ingestion (POST /api/upload) and query search
 * (POST /api/search) must embed with the same provider + model. Vectors from
 * different models live in different spaces, and mixing them silently breaks
 * cosine ranking. Both routes resolve the provider through
 * `resolveEmbeddingProvider()`, so the choice is always consistent.
 *
 * Provider selection:
 *   1. Meta Model API (OpenAI-compatible `/embeddings`) when META_API_KEY and
 *      META_EMBEDDING_MODEL are both set — the hackathon path.
 *   2. Otherwise OpenAI when OPENAI_API_KEY is set (model EMBEDDING_MODEL,
 *      default text-embedding-3-small).
 *   3. Otherwise embeddings are unavailable (callers degrade gracefully).
 *
 * The pgvector column is vector(1536): any embedding with a different
 * dimension is rejected (returns null) instead of corrupting the index.
 */

import { LIMITS } from "@/lib/limits";

export const EMBEDDING_DIMENSIONS = 1536;

const EMBEDDING_TIMEOUT_MS = 15_000;

interface EmbeddingsApiResponse {
  data: { index: number; embedding: number[] }[];
}

type EmbeddingProvider =
  | { kind: "meta"; baseUrl: string; apiKey: string; model: string }
  | { kind: "openai"; apiKey: string; model: string };

export function resolveEmbeddingProvider(): EmbeddingProvider | null {
  const metaKey = process.env.META_API_KEY;
  const metaModel = process.env.META_EMBEDDING_MODEL;
  if (metaKey && metaModel) {
    const baseUrl = (
      process.env.META_API_BASE_URL ?? "https://api.meta.ai/v1"
    ).replace(/\/+$/, "");
    return { kind: "meta", baseUrl, apiKey: metaKey, model: metaModel };
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return {
      kind: "openai",
      apiKey: openaiKey,
      model: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
    };
  }

  return null;
}

export function isEmbeddingAvailable(): boolean {
  return resolveEmbeddingProvider() !== null;
}

async function callEmbeddingsApi(
  provider: EmbeddingProvider,
  input: string[],
): Promise<number[][] | null> {
  const url =
    provider.kind === "meta"
      ? `${provider.baseUrl}/embeddings`
      : "https://api.openai.com/v1/embeddings";

  const res = await fetch(url, {
    method: "POST",
    signal: AbortSignal.timeout(EMBEDDING_TIMEOUT_MS),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({ model: provider.model, input }),
  });
  if (!res.ok) return null;

  const json = (await res.json()) as EmbeddingsApiResponse;
  return json.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

/**
 * Embed a batch of texts. Returns one entry per input; entries are null when
 * the provider is unavailable, the request fails, or a vector has the wrong
 * dimension. Never throws.
 */
export async function embedTexts(
  texts: string[],
): Promise<(number[] | null)[]> {
  const provider = resolveEmbeddingProvider();
  if (!provider || texts.length === 0) return texts.map(() => null);

  try {
    const vectors = await callEmbeddingsApi(provider, texts);
    if (!vectors) return texts.map(() => null);
    return vectors.map((v) =>
      Array.isArray(v) && v.length === EMBEDDING_DIMENSIONS ? v : null,
    );
  } catch {
    return texts.map(() => null);
  }
}

// Identical demo queries ("ceviche", "pollo a la brasa") repeat all day;
// caching their vectors in-memory (per instance) saves one paid provider
// call per repeat. Bounded size + TTL so it can never grow stale or large.
const queryCache = new Map<string, { vector: number[]; expiresAt: number }>();

/** Embed a single search query. Returns null when unavailable. Never throws. */
export async function embedQuery(query: string): Promise<number[] | null> {
  const cacheKey =
    LIMITS.queryEmbeddingCacheEntries > 0
      ? query.trim().toLowerCase().replace(/\s+/g, " ")
      : null;
  if (cacheKey) {
    const cached = queryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.vector;
    if (cached) queryCache.delete(cacheKey);
  }
  const [vector] = await embedTexts([query]);
  if (!vector) return null;
  if (cacheKey) {
    if (queryCache.size >= LIMITS.queryEmbeddingCacheEntries) {
      const oldest = queryCache.keys().next().value;
      if (oldest !== undefined) queryCache.delete(oldest);
    }
    queryCache.set(cacheKey, {
      vector,
      expiresAt: Date.now() + LIMITS.queryEmbeddingCacheTtlMs,
    });
  }
  return vector;
}
