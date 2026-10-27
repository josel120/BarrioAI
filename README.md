# BarrioAI

Mobile-first app that digitalizes local commerce in one photo.

A merchant photographs a physical menu or chalkboard. BarrioAI extracts
structured products with the **Meta Model API** (vision + structured JSON),
stores them with **PostGIS** geolocation and **pgvector** embeddings in
Supabase, and makes them instantly discoverable via semantic localized search.

## Stack

TypeScript · Next.js 16 App Router · TailwindCSS · Supabase
(PostgreSQL + PostGIS + pgvector) · Meta Model API (menu extraction) ·
OpenAI (text embeddings)

## Core Flow

Photo + HTML5 geolocation → `POST /api/upload` → Meta vision model
(JSON Schema) → Zod validation → batch embeddings → Supabase upsert
(`tiendas` + `productos`) → `POST /api/search` (similarity + distance rank)

## Routes

| Route       | What it does                                              |
| ----------- | --------------------------------------------------------- |
| `/`         | Landing                                                   |
| `/subir`    | Merchant upload: menu photo + geolocation (new flow)      |
| `/vender`   | Merchant upload: one-tap photo capture (original flow)    |
| `/buscar`   | Localized semantic search UI                              |
| `POST /api/upload` | Multipart `image`, `lat`, `lng`, optional `nombre`, `tiendaId` → `201` with extracted items |
| `POST /api/search` | JSON `q`, `lat`, `lng`, `radius_m`, `limit` → ranked results |

## Run Locally

Prerequisites: Node 24, a Supabase project, a Meta API key
([dev.meta.ai](https://dev.meta.ai) dashboard), an OpenAI API key
(for embeddings; without it uploads save with `embedding = null`
and search returns 503).

```bash
npm ci
cp .env.example .env.local   # fill in the 7 variables (see below)
```

Apply the database migrations in filename order, either with the CLI:

```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push
```

or by pasting each file from `supabase/migrations/` into the
Supabase Dashboard → SQL Editor:

1. `20240101000000_init_barrioai.sql`
2. `20240101000001_search_v2.sql`
3. `20261026000000_barrioai_core.sql`
4. `20261026000001_barrioai_dedup_indexes.sql`

Then:

```bash
npm run dev        # http://localhost:3000 (add -p <port> if busy)
```

## Configuration

All variables live in `.env.local` (gitignored, never commit).
`.env` holds non-secret defaults only.

| Variable | Required for | Notes |
| -------- | ------------ | ----- |
| `NEXT_PUBLIC_SUPABASE_URL` | everything | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | upload, search | Server-only. Use the legacy `service_role` JWT — the new `sb_secret_*` key is rejected by this project's PostgREST |
| `META_API_BASE_URL` | upload | `https://api.meta.ai/v1` (no trailing `/chat/completions`) |
| `META_API_KEY` | upload | Meta dashboard key |
| `META_VISION_MODEL` | upload | `muse-spark-1.3` |
| `OPENAI_API_KEY` | search (upload degrades) | Embeddings via `text-embedding-3-small` (1536 dims, must match the `vector(1536)` schema) |
| `EMBEDDING_MODEL` | optional | Defaults to `text-embedding-3-small`; leave unset |

## Scripts

```bash
npm run dev     # dev server (Turbopack)
npm run build   # production build (must pass with empty env: API clients are lazy)
npm start       # serve the production build
npm run lint    # eslint (must be clean)
npx tsc --noEmit  # typecheck (must be clean)
```

CI (`.github/workflows/`) runs install → typecheck → lint → build on
every push/PR with no secrets required.

## Deploy

Vercel Git integration owns preview + production deploys; `main` is
production. No `vercel.json` needed (see `docs/VERCEL_PROD.md` for why).
Full checklist with smoke tests: [`docs/PROD_RUNBOOK.md`](docs/PROD_RUNBOOK.md).

## Docs

- [`docs/PROD_RUNBOOK.md`](docs/PROD_RUNBOOK.md) — ordered go-live checklist
- [`docs/SUPABASE_PROD.md`](docs/SUPABASE_PROD.md) — project setup, migration audit, verification SQL
- [`docs/VERCEL_PROD.md`](docs/VERCEL_PROD.md) — env table, plan limits, log inspection
- [`docs/CI_CD.md`](docs/CI_CD.md) — workflows, secrets, local repro
