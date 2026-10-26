-- BarrioAI core schema: tiendas + productos with PostGIS geo + pgvector embeddings.
-- Applies on a fresh Supabase Postgres (PostGIS + pgvector available).

-- (1) Extensions
create extension if not exists postgis;
create extension if not exists vector;
create extension if not exists "pgcrypto";

-- (2) Tiendas
create table if not exists public.tiendas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  foto_menu_url text,
  ubicacion geography(Point, 4326) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- (3) Productos
create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas (id) on delete cascade,
  nombre text not null,
  precio numeric,
  moneda varchar(3) not null default 'MXN',
  categoria text not null default 'Otros',
  descripcion text,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tienda_id, nombre)
);

-- (4) RLS: public read only; writes go through service_role (bypasses RLS)
alter table public.tiendas enable row level security;
alter table public.productos enable row level security;

drop policy if exists "tiendas public read" on public.tiendas;
create policy "tiendas public read"
  on public.tiendas
  for select
  to anon, authenticated
  using (true);

drop policy if exists "productos public read" on public.productos;
create policy "productos public read"
  on public.productos
  for select
  to anon, authenticated
  using (true);

-- (5) Indexes
create index if not exists tiendas_ubicacion_gist
  on public.tiendas using gist (ubicacion);

create index if not exists productos_embedding_hnsw
  on public.productos using hnsw (embedding vector_cosine_ops);

create index if not exists productos_tienda_id_idx
  on public.productos (tienda_id);

-- (6) Localized semantic search
create or replace function public.match_productos(
  query_embedding vector(1536),
  match_lat double precision,
  match_lng double precision,
  radius_m integer default 5000,
  match_count integer default 20
)
returns table (
  producto_id uuid,
  tienda_id uuid,
  tienda_nombre text,
  nombre text,
  precio numeric,
  moneda varchar(3),
  categoria text,
  descripcion text,
  distance_m double precision,
  similarity double precision
)
language sql
stable
security invoker
as $$
  select
    p.id as producto_id,
    p.tienda_id as tienda_id,
    t.nombre as tienda_nombre,
    p.nombre as nombre,
    p.precio as precio,
    p.moneda as moneda,
    p.categoria as categoria,
    p.descripcion as descripcion,
    st_distance(
      t.ubicacion,
      st_setsrid(st_makepoint(match_lng, match_lat), 4326)::geography
    )::double precision as distance_m,
    (1 - (p.embedding <=> query_embedding))::double precision as similarity
  from public.productos p
  join public.tiendas t on t.id = p.tienda_id
  where
    p.embedding is not null
    and st_dwithin(
      t.ubicacion,
      st_setsrid(st_makepoint(match_lng, match_lat), 4326)::geography,
      radius_m
    )
  order by similarity desc, distance_m asc
  limit match_count;
$$;

grant execute on function public.match_productos(
  vector(1536), double precision, double precision, integer, integer
) to anon, authenticated;

-- (7) Public storage bucket for original menu photos
insert into storage.buckets (id, name, public)
values ('menus', 'menus', true)
on conflict (id) do nothing;

drop policy if exists "menus public read" on storage.objects;
create policy "menus public read"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'menus');
