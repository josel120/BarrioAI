# BarrioAI

Mobile-first Spanish PWA that digitalizes local commerce in one photo.

A merchant photographs a physical menu or chalkboard. BarrioAI extracts
structured products with the **Meta Model API** (vision + structured JSON),
stores them with **PostGIS** geolocation and **pgvector** embeddings in
Supabase, and makes them instantly discoverable via localized semantic
search — ticket-style results, a Leaflet map, and one-tap WhatsApp contact.

Live: [barrioai.vercel.app](https://barrioai.vercel.app)

## Stack

TypeScript · Next.js 16 App Router · React 19 · TailwindCSS v4 ·
Supabase (PostgreSQL + PostGIS + pgvector) · Meta Model API (menu
extraction + optional embeddings) · OpenAI (fallback embeddings) ·
Leaflet / react-leaflet (search map)

## Core Flow

Photo + HTML5 geolocation → `POST /api/upload` → Meta vision model
(`json_schema`) → Zod validation → batch embeddings → Supabase upsert
(`tiendas` + `productos`, menu photo in Storage) →
`POST /api/search` (`buscar_productos_y_tiendas` RPC: similarity +
distance rank)

Upload and search resolve embeddings through one shared client
(`lib/ai/embeddings.ts`), so query and document vectors always share
provider + model. Meta embeddings win when `META_EMBEDDING_MODEL` is
set, otherwise OpenAI. All vectors are 1536 dims (`vector(1536)`).

## Routes

| Route              | What it does                                                        |
| ------------------ | ------------------------------------------------------------------- |
| `/`                | Landing with deep-links to `/buscar?q=…` (auto-search)              |
| `/subir`           | Merchant upload: menu photo + geolocation (new flow)                |
| `/vender`          | Merchant upload: one-tap photo capture (original flow)              |
| `/buscar`          | Localized semantic search: ticket rows + map + WhatsApp contact     |
| `POST /api/upload` | Multipart `image`, `lat`, `lng`, optional `nombre`, `tiendaId` → `201` with extracted items |
| `POST /api/search` | JSON `q`, `lat`, `lng`, `radius_m`, `threshold`, `limit` → ranked results |

## Run Locally

Prerequisites: Node 24, a Supabase project, a Meta API key
([dev.meta.ai](https://dev.meta.ai) dashboard), an embedding provider —
Meta (`META_EMBEDDING_MODEL`) or OpenAI. Without any embedding key,
uploads save with `embedding = null` and search returns 503.

```bash
npm ci
cp .env.example .env.local   # fill in the variables (see below)
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
5. `20261027002725_moneda_pen_default.sql`
6. `20261027003218_backfill_moneda_pen.sql`
7. `20261027040000_buscar_productos_y_tiendas.sql`

Then:

```bash
npm run dev        # http://localhost:3000 (add -p <port> if busy)
```

## Configuration

All secrets live in `.env.local` (gitignored, never commit).
`.env` holds non-secret defaults only. `.env.local` overrides `.env`.

| Variable | Required for | Notes |
| -------- | ------------ | ----- |
| `NEXT_PUBLIC_SUPABASE_URL` | everything | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | upload, search | Server-only. Use the legacy `service_role` JWT — the new `sb_secret_*` key is rejected by this project's PostgREST |
| `META_API_BASE_URL` | upload, Meta embeddings | `https://api.meta.ai/v1` (no trailing `/chat/completions`) |
| `META_API_KEY` | upload | Meta dashboard key |
| `META_VISION_MODEL` | upload | `muse-spark-1.3` |
| `META_EMBEDDING_MODEL` | Meta embeddings | When set (+ `META_API_KEY`), upload AND search use Meta `/embeddings` |
| `OPENAI_API_KEY` | OpenAI embeddings | Fallback when Meta embeddings unset; via `text-embedding-3-small` (1536 dims, must match the `vector(1536)` schema) |
| `EMBEDDING_MODEL` | optional | Defaults to `text-embedding-3-small`; leave unset |

## Project Structure

```text
app/
  api/upload/route.ts    # menu extraction → embeddings → Supabase upsert
  api/search/route.ts    # query embedding → buscar_productos_y_tiendas RPC
  buscar/page.tsx        # search UI: ticket rows + client-only Leaflet map
  subir/page.tsx         # merchant upload (photo + geolocation)
  vender/page.tsx        # merchant upload (one-tap capture)
  layout.tsx             # es locale, Archivo font, theme init, app shell
  globals.css            # Tailwind v4 + mercado tokens + Meta theme
  manifest.ts            # PWA manifest
components/
  site.tsx               # SiteHeader + bottom TabBar (Inicio/Buscar/Vender)
  MapSearch.tsx          # Leaflet map: pins, user dot, WhatsApp popups
  MenuUploadForm.tsx     # 3-step upload form (1·2·3)
  SearchSkeletons.tsx    # map + results loading states
  icons.tsx              # stroke SVG icons (never emoji)
lib/
  ai/embeddings.ts       # shared embedding client (Meta → OpenAI → null)
  ai/prompts.ts          # Meta vision system/user prompts
  search/types.ts        # shared SearchResultRow
  supabase/database.types.ts
  formatPrecio.ts / formatDistance.ts / formatWhatsApp.ts
  hooks/useGeolocation.ts
supabase/migrations/     # 7 migrations, applied in filename order
docs/                    # production runbooks (see below)
```

## Design System

Spanish copy, mobile-first, `max-w-md` column. Mercado green tokens
(`bg-mercado-700`, …) in `app/globals.css`, with a Meta-blue theme
remapping the same utilities via `data-theme="meta"` — new screens
must use `mercado-*` classes, never hardcoded colors. Product lists
use the ticket-row pattern (name · dotted leader · price). Icons are
stroke SVG from `components/icons.tsx`, never emoji. Full rules for
agents: `.agents/skills/barrio-ui/SKILL.md`.

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
