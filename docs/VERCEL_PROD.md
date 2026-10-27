# BarrioAI — Vercel Production Runbook

Stack: Next.js 16 App Router (`next@16.4.3`, React 19) + Supabase (Postgres + PostGIS + pgvector).
Routes: `/`, `/subir` (upload form, raw file), `/vender` (upload, client-compressed),
`/buscar` (search UI), `POST /api/upload` (`runtime=nodejs`, `maxDuration=60`),
`POST /api/search` (`runtime=nodejs`, default duration).

## 0. Pre-connect cleanup (do this FIRST, in the repo)

The repo currently contains **two lockfiles**: `package-lock.json` (npm) **and**
`pnpm-lock.yaml` (pnpm). Vercel auto-detects the package manager from the lockfile,
so two lockfiles make detection ambiguous. Delete exactly one of them and commit:

- Recommended: keep `package-lock.json` (npm ships with Node, zero extra setup),
  delete `pnpm-lock.yaml`. (Either choice works; pick the manager you use locally.)

## 1. Why there is deliberately NO `vercel.json`

Every setting Vercel needs is already inferred or lives in code:

| Concern | Resolution, no file needed |
|---|---|
| Framework / build / install | Auto-detected: Next.js, `next build`, installer from the (single) lockfile after step 0 |
| Node version | No `.nvmrc`/`engines` pin; Vercel's default Node satisfies Next 16 (`@types/node ^20` in repo). Pin later via `engines` in `package.json` only if a deploy ever breaks on a Node upgrade |
| Function region | Default `iad1` (Washington, DC) for new projects. Static assets are CDN-cached near users (Mexico) regardless. Set Project Settings → Functions → Region only to sit next to your Supabase project region (see §4) |
| Upload timeout | `export const maxDuration = 60` is already in `app/api/upload/route.ts`. Valid on Hobby and Pro (see §4) |
| `next.config.ts` | Prod-sound as-is: `images.remotePatterns` allows `https://*.supabase.co/storage/v1/object/public/**` (matches Supabase Storage public URLs). No `output`/`headers` needed. `serverActions.bodySizeLimit: "8mb"` is harmless (uploads go through the Route Handler, not Server Actions) |

## 2. Environment variables

Set each variable for **Production + Preview** (dashboard: Project → Settings →
Environment Variables; tick both environments). Pull to local dev with
`vercel env pull .env.local` instead of setting Development in the dashboard.
Never print or paste secret *values* anywhere except the dashboard fields.

| Variable | Env selection | Secret? | Required? | If missing / wrong |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production + Preview | No (`NEXT_PUBLIC`, baked into client bundle; URL only) | Yes | Build still passes (lazy clients). Upload → 500; search → 500 |
| `SUPABASE_SERVICE_ROLE_KEY` | Production + Preview | **Yes, server-only. Never add `NEXT_PUBLIC_`** (bypasses RLS) | Yes | Same as above: upload/search → 500 |
| `META_API_BASE_URL` | Production + Preview | Server-only (no `NEXT_` prefix). Base URL **without** `/chat/completions` | Yes for upload | Upload → 500 (`Meta API …` in logs). Search unaffected |
| `META_API_KEY` | Production + Preview | **Yes** | Yes for upload | Wrong/missing → Meta 401 → upload 500. Search unaffected. Key: Meta dashboard (dev.meta.ai) |
| `META_VISION_MODEL` | Production + Preview | No (plain value, still server-only) | Yes for upload | Wrong/missing → Meta 4xx → upload 500. Search unaffected |
| `OPENAI_API_KEY` | Production + Preview | **Yes** | Upload: no (degrades). Search: **yes** | Upload still succeeds, products saved with `embedding = null`. Search → **503** `busqueda semantica no disponible` |
| `EMBEDDING_MODEL` | Production + Preview | No (plain value) | No, default `text-embedding-3-small` | Unset → default used. If you ever change it, the new model must match the vector dimension in your Supabase schema |

Notes from code reading (verified, not assumed):

- `POST /api/search` validates the body **before** checking the key: invalid JSON →
  400 even with no key; valid body + no/broken key → 503. Use this to tell
  "bad request" apart from "search backend down" when verifying.
- `POST /api/upload` failure map: no/invalid image → 400; image > 8 MB → 413;
  zero products detected → 422; malformed AI JSON → 502; everything else → 500.

## 3. Connect repo and deploy (exact dashboard steps)

1. [vercel.com/new](https://vercel.com/new) → Import the BarrioAI Git repository →
   Framework Preset stays **Next.js** (auto-detected) → leave Build Command
   (`next build`), Output Directory (`.next`), Install Command (from lockfile),
   Development Command (`next dev`) at defaults.
2. Expand **Environment Variables**, add the 7 variables from §2, ticking
   **Production** and **Preview** for each → **Deploy**.
3. Wait for Build → Deployment Ready. The first Production deploy gets the
   production domain; every later push to `main` redeploys automatically.

## 4. Plan limits, regions, payload cap (assumptions labeled)

- **ASSUMPTION — plan:** this runbook assumes Hobby or Pro. `maxDuration = 60` on
  `/api/upload` is within limits on both: Vercel raised Hobby functions to 60 s
  ([changelog, 2024](https://vercel.com/changelog/vercel-functions-for-hobby-can-now-run-up-to-60-seconds));
  Pro allows more. **Verify:** deployment → Functions tab → check the upload
  function's Max Duration column; a `504 FUNCTION_INVOCATION_TIMEOUT` in logs
  means the handler outran its budget (Llama 30 s + OpenAI 15 s timeouts fit in 60 s).
- **Region:** keep default `iad1` unless your Supabase project lives in another
  region — function↔database distance dominates latency, not user↔function.
  Change via Project Settings → Functions → Region (dashboard, no code change).
  **Verify Supabase region:** Supabase dashboard → Project Settings → General →
  Region.
- **VERIFIED platform cap — request bodies ≤ 4.5 MB**
  ([docs](https://vercel.com/docs/functions/limitations),
  [error ref](https://vercel.com/docs/errors/FUNCTION_PAYLOAD_TOO_LARGE.md)):
  Vercel rejects larger bodies with platform `413 FUNCTION_PAYLOAD_TOO_LARGE`
  **before** the handler runs. Consequences:
  - `/vender` (client-compresses to ≤1024 px JPEG q0.82, always ≪ 1 MB): safe.
  - `/subir` (sends the raw file, allows up to 8 MB): uploads between
    4.5–8 MB fail in production with the platform 413. The form's 413 message
    ("La imagen supera los 8 MB…") still reads sensibly, but the real ceiling is
    4.5 MB. Follow-up (outside this runbook's scope): compress in
    `MenuUploadForm` like `MerchantCapture` does, or lower its `MAX_IMAGE_BYTES`.
- **Watch item (not a change):** `/api/search` uses the default function duration
  (no `maxDuration` export). One embedding call (~seconds) + one RPC normally fits;
  if search logs ever show 504s, add `export const maxDuration = 30` to
  `app/api/search/route.ts`.

## 5. Verify production (in order)

Replace `APP` with the production domain.

1. Pages load: `GET https://APP/`, `https://APP/subir`, `https://APP/buscar`,
   `https://APP/vender` → 200, no console errors. (Geolocation prompts appear on
   `/subir` and `/vender`; deny-safe fallback exists only on `/subir`.)
2. Search validation (no key needed to reach the validator):
   `curl -X POST https://APP/api/search -H 'content-type: application/json' -d '{}'`
   → expect **400** `Invalid request body`.
3. Search backend:
   `curl -X POST https://APP/api/search -H 'content-type: application/json' -d '{"q":"ceviche","lat":-12.0464,"lng":-77.0428}'`
   → expect **200** with `{results, count}`. A **503** here means
   `OPENAI_API_KEY` is missing/broken or the embeddings call failed — not a
   request problem.
4. Upload (small image, < 4 MB):
   `curl -X POST https://APP/api/upload -F image=@menu.jpg -F lat=-12.0464 -F lng=-77.0428`
   → expect **201** with `tienda_id` and `productos_insertados`. Then confirm the
   row + products exist in Supabase (Table Editor: `tiendas`, `productos`) and the
   file landed in the `menus` storage bucket.
5. Upload validation: same call with `-F lat=999` → expect **400**.

## 6. Rollback

Deployments tab → find the last healthy deployment → `•••` → **Instant Rollback**
→ confirm. Rollback restores code + build output; it does **not** revert env-var
edits or Supabase data, so re-check §2 after rolling back across an env change.

## 7. Log inspection

- Request/function logs: deployment → **Functions** tab (per-route invocations,
  status, duration) or Project → **Logs** → Runtime Logs. App errors are prefixed
  `[BarrioAI Upload Error]` / `[BarrioAI Search Error]`.
- Build failures: deployment → **Build Logs** (missing env vars never break the
  build — clients are lazy; build failures are dependency/TS issues instead).
- Full text to grep: `FUNCTION_PAYLOAD_TOO_LARGE` (payload cap),
  `FUNCTION_INVOCATION_TIMEOUT` (duration), `Llama API` (vision backend).
