-- BarrioAI: schema consolidation.
--
-- WHY: column existence currently depends on migration ORDER luck.
-- 20240101000000_init_barrioai.sql creates tiendas.telefono/direccion/
-- categoria/owner_id and productos.disponible/fts, while
-- 20261026000000_barrioai_core.sql re-declares both tables WITHOUT those
-- columns behind CREATE TABLE IF NOT EXISTS (a no-op once the legacy
-- migration ran). The current RPC (buscar_productos_y_tiendas) references
-- telefono/direccion/disponible, so any environment that applied only the
-- core lineage breaks at query time. These statements make the final
-- schema explicit and idempotent regardless of lineage.

alter table public.tiendas add column if not exists categoria text;
alter table public.tiendas add column if not exists direccion text;
alter table public.tiendas add column if not exists telefono text;
alter table public.tiendas
  add column if not exists owner_id uuid references auth.users (id) on delete set null;

alter table public.productos
  add column if not exists disponible boolean not null default true;

-- FTS fallback column (legacy lineage only). Generated columns cannot use
-- ADD COLUMN IF NOT EXISTS, so guard via information_schema.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'productos' and column_name = 'fts'
  ) then
    alter table public.productos
      add column fts tsvector generated always as (
        to_tsvector('spanish', nombre || ' ' || coalesce(descripcion, '') || ' ' || categoria)
      ) stored;
  end if;
end $$;

create index if not exists productos_fts_gin_idx
  on public.productos using gin (fts);

create index if not exists tiendas_owner_idx
  on public.tiendas (owner_id);

-- Case/whitespace-insensitive dedup. UNIQUE (tienda_id, nombre) is
-- case-sensitive, so "Pollo a la Brasa" and "pollo a la brasa" could both
-- exist for one tienda. This unique index closes that gap.
-- NOTE: if case-variant duplicates already exist, this statement fails
-- loudly on purpose — merge those rows first, then re-run.
create unique index if not exists productos_tienda_nombre_norm_uidx
  on public.productos (tienda_id, lower(btrim(nombre)));
