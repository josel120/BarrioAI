<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# BarrioAI — Agent Guide

Mobile-first Spanish PWA: merchants photograph a menu, Meta vision
extracts products, Supabase (PostGIS + pgvector) stores them, shoppers
find them via localized semantic search. Stack: Next.js 16 App Router,
React 19, Tailwind v4, Supabase, Meta Model API, Leaflet.

## Commands

```bash
npm run dev       # dev server (Turbopack); add -p <port> if 3000 is busy
npm run build     # must pass with EMPTY env — API clients stay lazy
npm start         # serve the production build
npm run lint      # eslint — must be clean
npx tsc --noEmit  # typecheck — must be clean
```

CI (`.github/workflows/ci.yml`, `supabase.yml`) runs
install → typecheck → lint → build on every push/PR with no secrets.
Reproduce CI failures locally with the same commands, in order.

Package manager is **npm** (`package-lock.json`). Never add a
`pnpm-lock.yaml` / `yarn.lock`.

## Architecture Map

- `app/api/upload/route.ts` — multipart `image/lat/lng` → Meta vision
  (`json_schema`, `muse-spark-1.3`) → Zod → `embedTexts()` →
  upsert `tiendas` + `productos`, photo to Storage. `runtime=nodejs`,
  `maxDuration=60`.
- `app/api/search/route.ts` — JSON `q/lat/lng/radius_m/threshold/limit`
  → `embedQuery()` → `buscar_productos_y_tiendas` RPC → ranked rows.
  400 on bad body, 503 when embeddings unavailable.
- `lib/ai/embeddings.ts` — THE shared embedding client. Both API routes
  resolve provider via `resolveEmbeddingProvider()`. Never embed from
  anywhere else.
- `lib/ai/prompts.ts` — Meta vision prompts. Chat Completions uses
  OpenAI-style `image_url` parts (`input_image` 400s — Responses only).
- `app/buscar/page.tsx` + `components/MapSearch.tsx` — search UI:
  ticket rows + Leaflet map loaded client-only (`ssr: false`).
- `components/site.tsx`, `components/icons.tsx` — app shell (header +
  tab bar) and stroke-SVG icons. Never emoji.
- `lib/formatPrecio.ts`, `lib/formatDistance.ts`,
  `lib/formatWhatsApp.ts` — always render prices/distances/WhatsApp
  links through these.
- `supabase/migrations/` — 7 files, applied in filename order
  (`npx supabase db push` or Dashboard SQL Editor).

## Invariants (do not break)

1. **Embedding consistency**: ingestion and search MUST share
   provider + model (Meta when `META_API_KEY` + `META_EMBEDDING_MODEL`,
   else OpenAI, else 503). Vectors are `vector(1536)`; wrong dims are
   rejected, never stored.
2. **Lazy server clients**: route modules must import side-effect free
   so `next build` passes with empty env. Env access inside handlers /
   getters only.
3. **Service-role key**: use the legacy `service_role` JWT for
   `SUPABASE_SERVICE_ROLE_KEY`. The new `sb_secret_*` key is rejected
   by this project's PostgREST (empty-body 401).
4. **Tailwind v4 wiring**: CSS goes through `@tailwindcss/turbopack`
   registered in `next.config.ts`. If utilities stop compiling, check
   the loader first — never ship raw `@theme`/`@apply`.
5. **Spanish UI**: `lang="es"`, Spanish copy, `S/` prices via
   `formatPrecio`, `tabular-nums` for prices/distances.
6. **mercado-* utilities only** for brand color — the Meta theme
   (`data-theme="meta"`) remaps the same vars. No hardcoded greens/blues.

## Skills & Conventions

- UI work: read `.agents/skills/barrio-ui/SKILL.md` first (tokens, app
  shell, ticket-row pattern, a11y floor: labels, `aria-live`,
  `:focus-visible`).
- Supabase/DB work: read `.agents/skills/supabase/SKILL.md` (+
  `supabase-postgres-best-practices` before touching schema, RLS, or RPCs).
- Zod validates every API boundary; `.catch()` defaults keep extraction
  resilient. Errors are Spanish, user-actionable, and name the fix.
- Mobile-first `max-w-md` column, `pb-28` clears the tab bar. Never add
  fixed elements overlapping it.
- Leaflet needs `window`: dynamic import with `ssr: false` + skeleton.
  Pins use `divIcon` (no marker-asset bug).

## Env

Secrets in `.env.local` (gitignored, overrides `.env`); `.env` holds
non-secret defaults. Template: `.env.example` (8 vars). Never commit
or print values. Prod values live in Vercel (Prod + Preview).

## Environment Gotchas (Windows)

- PowerShell 5.1: no `Invoke-WebRequest -Form` — use `curl.exe`.
- es-MX locale: decimal commas corrupt vector strings — join floats
  with InvariantCulture.
- npm cache must be workspace-local (`$env:npm_config_cache`); run
  from the plain `C:\` path, not a UNC path.
