-- Extensions
create extension if not exists "pgcrypto";
create extension if not exists "postgis";
create extension if not exists "vector";

-- ==========================================
-- TIENDAS (Stores)
-- ==========================================
create table public.tiendas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  nombre text not null,
  categoria text,
  direccion text,
  telefono text,
  foto_menu_url text,
  -- geography(Point) allows accurate meter-based distance queries (ST_DWithin)
  ubicacion geography(Point, 4326) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tiendas_ubicacion_gist_idx on public.tiendas using gist (ubicacion);
create index tiendas_owner_idx on public.tiendas (owner_id);

-- ==========================================
-- PRODUCTOS (Products)
-- ==========================================
create table public.productos (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas(id) on delete cascade,
  nombre text not null,
  precio numeric(10,2) check (precio >= 0),
  moneda char(3) not null default 'MXN',
  categoria text not null default 'Otros',
  descripcion text,
  disponible boolean not null default true,
  -- 1536 = text-embedding-3-small. Change if you swap embedding models.
  embedding vector(1536),
  -- Full-text search fallback (hybrid search)
  fts tsvector generated always as (
    to_tsvector('spanish', nombre || ' ' || coalesce(descripcion, '') || ' ' || categoria)
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tienda_id, nombre) -- Enables idempotent upserts on re-upload
);

create index productos_tienda_idx on public.productos (tienda_id);
create index productos_fts_gin_idx on public.productos using gin (fts);
-- HNSW is superior to IVFFlat for low-latency, high-recall semantic search
create index productos_embedding_hnsw_idx on public.productos
  using hnsw (embedding vector_cosine_ops);

-- Storage bucket for menu photos
insert into storage.buckets (id, name, public) values ('menus', 'menus', true)
on conflict (id) do nothing;

-- ==========================================
-- RPC: Semantic + Geo Localized Search
-- ==========================================
create or replace function public.buscar_productos_cercanos(
  query_embedding vector(1536),
  lat float,
  lng float,
  radio_metros int default 2000,
  limite int default 20
)
returns table (
  id uuid, tienda_id uuid, tienda_nombre text,
  nombre text, precio numeric, categoria text, descripcion text,
  distancia_metros float, similitud float
)
language sql stable
as $$
  select
    p.id, p.tienda_id, t.nombre as tienda_nombre,
    p.nombre, p.precio, p.categoria, p.descripcion,
    ST_Distance(t.ubicacion, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) as distancia_metros,
    (1 - (p.embedding <=> query_embedding))::float as similitud
  from public.productos p
  join public.tiendas t on t.id = p.tienda_id
  where p.disponible = true
    and p.embedding is not null
    and ST_DWithin(t.ubicacion, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography, radio_metros)
  order by p.embedding <=> query_embedding
  limit limite;
$$;

-- RLS: Public read, owner-only write (API uses Service Role and bypasses this)
alter table public.tiendas enable row level security;
alter table public.productos enable row level security;

create policy "Public read tiendas" on public.tiendas for select using (true);
create policy "Public read productos" on public.productos for select using (true);
create policy "Owner manages tienda" on public.tiendas for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);