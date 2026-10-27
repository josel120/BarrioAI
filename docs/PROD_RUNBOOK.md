# BarrioAI — Production Go-Live Runbook

Single ordered checklist. Detail lives in the slice runbooks:

- `docs/SUPABASE_PROD.md` — Supabase provision, migration audit, verification SQL
- `docs/VERCEL_PROD.md` — Vercel env table, limits, log inspection
- `docs/CI_CD.md` — GitHub Actions, branch strategy, local repro

Names only below — never paste secret *values* into docs, chat, or git.

## Pre-flight (repo, code-side)

- [ ] **Dual lockfile (BLOCKER).** Repo has `package-lock.json` **and**
  `pnpm-lock.yaml`; Vercel's manager auto-detect is ambiguous with two.
  Delete exactly one (recommended: keep `package-lock.json`, delete
  `pnpm-lock.yaml`) and commit. CI uses `npm ci`.
- [ ] **CI green on `main`.** `CI` workflow: Install / Typecheck / Lint / Build
  (no secrets). `Supabase` workflow only runs when `supabase/**` changes;
  without the optional `SUPABASE_ACCESS_TOKEN` secret it lists migrations
  and exits 0 — do NOT make it a required check.
- [ ] **No `vercel.json` needed.** Confirmed: auto-detect build, default Node
  satisfies Next 16, default region OK, `maxDuration = 60` already in
  `app/api/upload/route.ts` (valid on Hobby and Pro).

## Step 1 — Create Supabase project (click-ops, ~5 min)

1. [Supabase Dashboard → New project](https://supabase.com/dashboard),
   name `barrioai-prod`, strong DB password, region closest to users.
2. Wait for green/healthy status; note the project ref
   (`<ref>.supabase.co`, Project Settings → General).

## Step 2 — Apply migrations (CLI preferred)

```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push
npx supabase migration list
```

Expect 4 applied in order: `20240101000000_init_barrioai`,
`20240101000001_search_v2`, `20261026000000_barrioai_core`,
`20261026000001_barrioai_dedup_indexes`. Fallback: paste each file's
contents in that order into Dashboard → SQL Editor (see
`docs/SUPABASE_PROD.md` §3). Then run the 10 verification SQL blocks
(`docs/SUPABASE_PROD.md` §4): extensions, tables, RLS on + 5 policies,
anon-read/anon-no-write, `menus` bucket + policy, 8 canonical indexes,
`match_productos` + EXECUTE grant, live RPC smoke test, Advisors.

## Step 3 — Vercel env vars (Production + Preview)

Project → Settings → Environment Variables; tick **Production** and
**Preview** for each of the 7 names from `.env.example`:

`NEXT_PUBLIC_SUPABASE_URL` (project URL) ·
`SUPABASE_SERVICE_ROLE_KEY` (**service_role secret**, server-only, never
`NEXT_PUBLIC_`) · `META_API_BASE_URL` (no trailing `/chat/completions`) ·
`META_API_KEY` (Meta dashboard, dev.meta.ai) · `META_VISION_MODEL` · `OPENAI_API_KEY` (optional for
upload, **required for search**) · `EMBEDDING_MODEL` (optional, default
`text-embedding-3-small` — leave unset unless you also change the
`vector(1536)` schema). Full per-var breakage table: `docs/VERCEL_PROD.md` §2.

## Step 4 — Connect repo and deploy

[vercel.com/new](https://vercel.com/new) → Import repo → Framework stays
**Next.js**, all commands at defaults → add the 7 env vars → **Deploy**.
Every push to `main` redeploys production automatically.

## Step 5 — Smoke tests (replace `APP` with the prod domain)

Run in order. `curl.exe` is Windows curl; PowerShell `Invoke-RestMethod`
equivalents follow each.

**5.1 Pages** — `GET https://APP/`, `/subir`, `/buscar`, `/vender` → 200.

**5.2 Search validation (bad body → 400, reaches validator even with no key):**

```bash
curl -X POST https://APP/api/search -H "content-type: application/json" -d "{}"
# expect 400 {"error":"Invalid request body",...}
```

```powershell
Invoke-RestMethod -Uri https://APP/api/search -Method Post `
  -ContentType "application/json" -Body "{}"
# expect 400
```

**5.3 Search negative path (bad coords → 400):**

```bash
curl -X POST https://APP/api/search -H "content-type: application/json" `
  -d '{"q":"ceviche","lat":999,"lng":-77.0428}'
# expect 400 Invalid request body
```

```powershell
Invoke-RestMethod -Uri https://APP/api/search -Method Post `
  -ContentType "application/json" -Body '{"q":"ceviche","lat":999,"lng":-77.0428}'
# expect 400
```

**5.4 Search backend (valid body → 200; 503 = key/backend problem, not request):**

```bash
curl -X POST https://APP/api/search -H "content-type: application/json" `
  -d '{"q":"ceviche","lat":-12.0464,"lng":-77.0428}'
# expect 200 {"results":[...],"count":N}
# 503 {"error":"busqueda semantica no disponible"} => OPENAI_API_KEY missing/broken
```

```powershell
Invoke-RestMethod -Uri https://APP/api/search -Method Post `
  -ContentType "application/json" -Body '{"q":"ceviche","lat":-12.0464,"lng":-77.0428}'
# expect 200; 503 => OPENAI_API_KEY missing/broken
```

**5.5 Upload happy path (small image < 4 MB → 201):**

```bash
curl -X POST https://APP/api/upload `
  -F image=@menu.jpg -F lat=-12.0464 -F lng=-77.0428
# expect 201 {"success":true,"tienda_id":"...","productos_insertados":N,...}
```

```powershell
curl.exe -X POST https://APP/api/upload `
  -F image=@menu.jpg -F lat=-12.0464 -F lng=-77.0428
# expect 201
```

Then confirm in Supabase Table Editor (`tiendas`, `productos`) and the
`menus` storage bucket.

**5.6 Upload negative path (bad coords → 400):**

```bash
curl -X POST https://APP/api/upload `
  -F image=@menu.jpg -F lat=999 -F lng=-77.0428
# expect 400 {"error":"Invalid geolocation coordinates"}
```

**5.7 Upload negative path (oversize → 413):** a file > 8 MB reaches the
route's own 413; on Vercel, files > **4.5 MB** are rejected earlier by the
platform (`413 FUNCTION_PAYLOAD_TOO_LARGE` before the handler runs).
`/vender` is safe (client-compresses to ≤1024 px JPEG); `/subir` sends raw
files, so 4.5–8 MB uploads fail in prod — compress in `MenuUploadForm`
(post-launch follow-up, see below).

## Step 6 — Rollback

Deployments tab → last healthy deployment → `•••` → **Instant Rollback**.
Restores code + build only — **not** env-var edits or Supabase data, so
re-check Step 3 after rolling back across an env change.

## Security notes (verified by release-captain audit)

- `service_role` never reaches the browser: `SUPABASE_SERVICE_ROLE_KEY` is
  referenced only in `app/api/upload/route.ts`, `app/api/search/route.ts`
  (server routes), the unimported `supabase/admin.ts` helper, docs, and CI
  build env. No client component imports `supabase/admin|client|server`;
  browser code only does `fetch("/api/...")`. No `NEXT_PUBLIC_*` key besides
  the Supabase URL, which is public by design.
- `POST /api/upload` is an **open, unauthenticated endpoint** with an 8 MB
  cap: anyone can create `tiendas`/`productos` rows and burn Llama + OpenAI
  quota. Accepted for launch; recommended follow-ups (not built): auth or
  signed-upload tokens, per-IP rate limiting, and client-side compression
  in `MenuUploadForm` to match the 4.5 MB platform cap.

## Post-launch

- Regen stale generated types after any schema change:
  `npx supabase gen types typescript --project-id <ref> --schema public > lib/supabase/database.types.ts`
  (current file has the v1 `buscar` shape and is missing `match_productos`).
- Re-run Supabase Advisors (Security + Performance) after first real data;
  known ignorable notes: doubled public-read policies, mutable search_path
  on the RPCs, RLS init-plan on `Owner manages tienda`.
- Optional: set `SUPABASE_ACCESS_TOKEN` GitHub secret to enable linked
  migration lint in CI; consider pinning Node via `engines` if a deploy
  ever breaks on a toolchain upgrade.
