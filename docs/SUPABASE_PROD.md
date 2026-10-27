# BarrioAI — Supabase Production Runbook

Goal: provision a production Supabase project for BarrioAI and verify it, then wire
Vercel. All claims about repo files in this doc were verified by reading them
(2026-10-26). Companion audit appendix at the bottom.

Contract (from `.env.example`, names only — never paste values into chat/docs):

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server only, never `NEXT_PUBLIC_`)
- `META_API_BASE_URL`, `META_API_KEY`, `META_VISION_MODEL`
- `OPENAI_API_KEY` (optional), `EMBEDDING_MODEL` (optional, default `text-embedding-3-small`)

Key facts that shape this runbook:

- All Supabase traffic goes through `POST /api/upload` and `POST /api/search`
  (`app/api/upload/route.ts`, `app/api/search/route.ts`), which use `service_role`
  server-side. Browser code (`app/buscar/page.tsx`, `app/components/MerchantCapture.tsx`,
  `components/MenuUploadForm.tsx`) only does `fetch("/api/...")` — it never imports
  `@supabase/*`. So **no `NEXT_PUBLIC_SUPABASE_ANON_KEY` is needed** anywhere.
- The app uses supabase-js over HTTPS (PostgREST + Storage + RPC). It opens **zero
  direct Postgres connections**, so there is no `DATABASE_URL` to configure.
- Migration chain (applied in filename order): `20240101000000_init_barrioai.sql` →
  `20240101000001_search_v2.sql` → `20261026000000_barrioai_core.sql` →
  `20261026000001_barrioai_dedup_indexes.sql`. Details in the appendix.

---

## 1. Create the project (click-ops, ~5 min)

1. Go to [Supabase Dashboard → New project](https://supabase.com/dashboard).
2. Name: `barrioai-prod`. Set a strong database password, store it in your password
   manager. Region: closest to your users (e.g. US East for Mexico).
3. Wait until project status is green/healthy.
4. Note the project ref (the `<ref>` in `<ref>.supabase.co`, visible in Project
   Settings → General).

## 2. Apply migrations — preferred: Supabase CLI

The CLI version is pinned in `package.json` devDependencies (`supabase ^2.122.0`).

```bash
npx supabase login
npx supabase link --project-ref <ref>   # paste the ref from step 1.4, then the DB password
npx supabase db push
```

Expected output: one `Applying migration ...` line per file, in this order:

```text
20240101000000_init_barrioai
20240101000001_search_v2
20261026000000_barrioai_core
20261026000001_barrioai_dedup_indexes
```

Verify what the remote believes is applied:

```bash
npx supabase migration list
```

Expected: all four versions listed under remote with no pending local entries.

## 3. Apply migrations — fallback: Dashboard SQL editor

Use only if the CLI path fails. Dashboard → SQL Editor → New query, then paste and
**Run** each file's full contents **in this exact order**, one at a time:

1. `supabase/migrations/20240101000000_init_barrioai.sql`
2. `supabase/migrations/20240101000001_search_v2.sql`
3. `supabase/migrations/20261026000000_barrioai_core.sql`
4. `supabase/migrations/20261026000001_barrioai_dedup_indexes.sql`

Expected: each run ends with `Success. No rows returned`. Then continue at §4 —
do not skip verification (the fallback path does not record rows in
`supabase_migrations.schema_migrations`, so re-run §2 later from a machine with the
CLI if you want `migration list` to be authoritative).

## 4. Verify (SQL Editor, run each block)

**4.1 Extensions.**

```sql
select extname from pg_extension where extname in ('postgis','vector','pgcrypto');
```

Expected: 3 rows (`postgis`, `vector`, `pgcrypto`).

**4.2 Tables + canonical columns.**

```sql
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('tiendas','productos');
```

Expected: 2 rows. Canonical prod shape is the legacy-first superset (both migrations
applied in order): `tiendas` has `owner_id, categoria, direccion, telefono`;
`productos` has `disponible, fts`; `moneda` is `char(3)`, `precio` is
`numeric(10,2)`. The app works with this shape.

**4.3 RLS is on.**

```sql
select relname, relrowsecurity from pg_class
where relname in ('tiendas','productos');
```

Expected: `relrowsecurity = true` for both.

**4.4 RLS policies.**

```sql
select tablename, policyname, roles, cmd from pg_policies
where schemaname = 'public' and tablename in ('tiendas','productos')
order by tablename, policyname;
```

Expected rows (5 — the doubled public-read pair is intentional, see appendix):

| tablename  | policyname           | roles                | cmd    |
|------------|----------------------|----------------------|--------|
| productos  | Public read productos| {public}             | SELECT |
| productos  | productos public read| {anon, authenticated}| SELECT |
| tiendas    | Owner manages tienda | {public}             | ALL    |
| tiendas    | Public read tiendas  | {public}             | SELECT |
| tiendas    | tiendas public read  | {anon, authenticated}| SELECT |

**4.5 Anon can read, anon cannot write** (proves RLS from the anon role's view):

```sql
set role anon;
select count(*) from public.productos;   -- must succeed
insert into public.productos (tienda_id, nombre)
values ('00000000-0000-0000-0000-000000000000', 'rls-probe');  -- must FAIL
reset role;
```

Expected: `count` returns a number (0 on a fresh DB); the insert fails with
`new row violates row-level security policy for table "productos"`.

**4.6 Storage bucket + policy.**

```sql
select id, public from storage.buckets where id = 'menus';
select policyname, roles, cmd from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and policyname = 'menus public read';
```

Expected: bucket row `(menus, true)`; one policy row
`('menus public read', {anon, authenticated}, SELECT)`.

**4.7 Indexes — canonical set only, no legacy duplicates.**

```sql
select indexname from pg_indexes
where schemaname = 'public' and tablename in ('tiendas','productos')
order by indexname;
```

Expected (exact set; `..._gist_idx` / `..._hnsw_idx` / `..._tienda_idx` legacy names
must be ABSENT — migration `...0001_dedup_indexes` removed them):

```text
productos_embedding_hnsw
productos_fts_gin_idx
productos_pkey
productos_tienda_id_idx
productos_tienda_id_nombre_key
tiendas_owner_idx
tiendas_pkey
tiendas_ubicacion_gist
```

**4.8 RPCs + EXECUTE grant.**

```sql
select proname from pg_proc where proname in ('match_productos','buscar_productos_cercanos');
select grantee from information_schema.routine_privileges
where routine_schema = 'public' and routine_name = 'match_productos'
  and privilege_type = 'EXECUTE';
```

Expected: both function names; grantees include `anon` and `authenticated`
(`match_productos` is what `/api/search` calls; `buscar_productos_cercanos` is the
kept legacy RPC — harmless, see appendix).

**4.9 Live RPC smoke test** (dummy 1536-dim zero vector, Lima coords):

```sql
select * from public.match_productos(
  ('[' || repeat('0,', 1535) || '0]')::vector(1536),
  -12.0464, -77.0428, 5000, 20
);
```

Expected: success with 0 rows on a fresh DB (proves the function, the vector cast,
and the PostGIS path all execute).

**4.10 Advisors.** Dashboard → Advisors → run Security and Performance advisors.
Expected: no errors. Known info/perf-only notes you may ignore (see appendix):

- "Multiple permissive policies" on `tiendas`/`productos` (legacy + core SELECT pair).
- `function_search_path_mutable` on `match_productos` / `buscar_productos_cercanos`.
- "Auth RLS Initialization Plan" on `Owner manages tienda` (`auth.uid()` not wrapped
  in `(select ...)`).

## 5. Wire Vercel (names only)

1. Supabase Dashboard → Project Settings → Data API → copy the project URL into
   Vercel env var `NEXT_PUBLIC_SUPABASE_URL`.
2. Project Settings → API Keys → copy the **`service_role` secret key** (NOT the
   publishable/anon key) into Vercel env var `SUPABASE_SERVICE_ROLE_KEY`. Mark it
   sensitive; it must never be prefixed `NEXT_PUBLIC_`.
3. Set `META_API_BASE_URL`, `META_API_KEY`, `META_VISION_MODEL`,
   plus optional `OPENAI_API_KEY` / `EMBEDDING_MODEL`.
4. Redeploy. Smoke test prod: upload a menu photo, then search for an item.

## 6. Connection guidance (Vercel serverless)

- **Nothing to configure.** Both API routes use supabase-js (HTTPS to PostgREST /
  Storage / RPC), which is stateless and needs no pool. Verified: `package.json`
  has no `pg`/`postgres`/ORM dependency, and no route opens a SQL connection.
- If a future change adds direct Postgres access (Drizzle/Prisma/raw SQL), use the
  **Shared Pooler** connection string (Supavisor, port `6543`, Project Settings →
  Database) from serverless functions — never the direct port-`5432` string, which
  exhausts `max_connections` under Vercel's concurrency. That change is not needed
  today; do not add a `DATABASE_URL` now.

## 7. Anon-key / helper verdict (verified by repo-wide search)

- `supabase/client.ts` and `supabase/server.ts` reference
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` but **nothing imports them** (only self-matches in
  a repo-wide search); `supabase/admin.ts` and `lib/supabase/database.types.ts` are
  likewise unimported. `tsconfig.json` type-checks them (`include: **/*.ts`) and
  `tsc`/build pass, so they are inert. **Leave them in place** for future auth work;
  do not add the anon key to Vercel until a browser-side Supabase client actually
  ships. Do not import `supabase/admin.ts` from client components (module-scope
  `service_role` client).
- `lib/supabase/database.types.ts` is stale: its `Functions` section has the v1
  `buscar_productos_cercanos` shape (pre-`search_v2`, no telefono/coords) and is
  missing `match_productos`. Table types still match (legacy-first superset). Regen
  after §2 whenever the schema changes:

```bash
npx supabase gen types typescript --project-id <ref> --schema public \
  > lib/supabase/database.types.ts
```

(requires `npx supabase login` first.)

## 8. Troubleshooting

- `db push` asks for a password: use the database password from §1, not the access token.
- `relation "tiendas" already exists` during §3: a file was pasted twice or out of
  order — start over on a fresh project; the legacy file is run-once by design.
- `/api/search` returns 503 `busqueda semantica no disponible`: `OPENAI_API_KEY` is
  unset or the embeddings call failed (see `app/api/search/route.ts`).
- `/api/upload` returns 502 `AI returned malformed structure`: the Meta endpoint
  returned non-JSON; check `META_API_BASE_URL` (no trailing `/chat/completions`)
  and `META_VISION_MODEL`.

---

## Appendix — migration-chain audit (why this runbook is safe)

Fresh-project order (Supabase applies strictly in filename order):

| File | Effect on fresh DB | Re-runnable? |
|------|--------------------|--------------|
| `20240101000000_init_barrioai` | extensions, full tables, 5 indexes, `menus` bucket, `buscar_productos_cercanos` v1, RLS + 3 policies | Run-once (tracked; no `IF NOT EXISTS` on tables/policies) — normal for a first migration |
| `20240101000001_search_v2` | `DROP IF EXISTS` + recreate `buscar_productos_cercanos` with telefono + lat/lng | Yes (drop-first) |
| `20261026000000_barrioai_core` | all `IF NOT EXISTS` / `OR REPLACE` / `DROP POLICY IF EXISTS`; adds `match_productos` + `EXECUTE` grant + `menus public read` storage policy | Yes |
| `20261026000001_barrioai_dedup_indexes` | `DROP INDEX IF EXISTS` × 3 (legacy-named duplicates) | Yes |

Harmless on a DB that already has the legacy migration(s): the core file's
`CREATE TABLE IF NOT EXISTS` is a no-op there (legacy tables are a superset of the
core columns, and the app only touches shared columns), policies are
drop-if-exists + create, the RPC is `OR REPLACE`, the bucket insert is
`ON CONFLICT DO NOTHING`. The dedup file only drops indexes the legacy file created.

Deliberately kept duplicates (harmless, documented so nobody "fixes" them blindly):

- Two public-read SELECT policies per table (legacy `PUBLIC` + core
  `TO anon, authenticated`): permissive policies union; reads stay public. Merging
  them would change semantics for hypothetical future DB roles, so they stay.
- `buscar_productos_cercanos` RPC stays next to `match_productos`: unused by the
  app, tiny, zero runtime cost.
- Type drift `moneda char(3)` vs `varchar(3)`, `precio numeric(10,2)` vs `numeric`:
  legacy-first order wins; the app reads/writes both shapes identically.
