-- BarrioAI: drop duplicate indexes created by the overlapping legacy + core migrations.
--
-- WHY: 20240101000000_init_barrioai.sql creates tiendas_ubicacion_gist_idx,
-- productos_embedding_hnsw_idx and productos_tienda_idx. 20261026000000_barrioai_core.sql
-- then creates the logically identical tiendas_ubicacion_gist, productos_embedding_hnsw
-- and productos_tienda_id_idx (different names, same definitions; IF NOT EXISTS cannot
-- dedup across names). Every fresh deploy therefore ends up with two GiST, two HNSW and
-- two btree indexes. The HNSW duplicate is the costly one: ~2x vector-index storage and
-- an extra index write on every embedding upsert.
--
-- This migration keeps the *_core set (canonical names) and drops the legacy-named
-- duplicates. It is idempotent (DROP INDEX IF EXISTS) and a no-op on databases where
-- the duplicates were already removed. Supabase applies migrations in filename order,
-- so this file (timestamp ...0001) always runs after ...26000000_barrioai_core.
--
-- NOTE: DROP INDEX takes a brief ACCESS EXCLUSIVE lock. On a fresh/small database this
-- is unnoticeable. Do NOT convert these to DROP INDEX CONCURRENTLY: migrations run
-- inside a transaction and CONCURRENTLY cannot run in one.

drop index if exists public.tiendas_ubicacion_gist_idx;
drop index if exists public.productos_embedding_hnsw_idx;
drop index if exists public.productos_tienda_idx;

-- Kept deliberately (no duplicate, still useful):
--   public.tiendas_owner_idx        (supports owner_id lookups from the legacy schema)
--   public.productos_fts_gin_idx    (supports the legacy fts column)
--   public.tiendas_ubicacion_gist, public.productos_embedding_hnsw,
--   public.productos_tienda_id_idx  (canonical core set)
