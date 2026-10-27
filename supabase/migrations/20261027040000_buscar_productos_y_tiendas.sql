-- BarrioAI unified hybrid search: semantic (pgvector) + geo (PostGIS).
--
-- buscar_productos_y_tiendas() joins productos with their tiendas, filters by
-- cosine similarity AND by distance in meters, and returns everything the
-- client search view needs (product, store, coordinates, rank signals).
--
-- Notes:
--   * Uses the caller's RLS context (security invoker): public read policies
--     on tiendas/productos apply. Never switch this to security definer.
--   * ST_DWithin on the geography column uses the GiST index; the ORDER BY
--     on the cosine operator (<=>) can use the HNSW index.
--   * similarity = 1 - cosine_distance, range [-1, 1]; typical useful
--     thresholds are 0.2 - 0.4 for text-embedding-3-small.

create or replace function public.buscar_productos_y_tiendas(
  query_embedding vector(1536),
  user_lat double precision,
  user_lng double precision,
  similarity_threshold double precision default 0.3,
  max_distance_m integer default 5000,
  match_count integer default 20
)
returns table (
  producto_id uuid,
  nombre text,
  precio numeric,
  moneda varchar(3),
  categoria text,
  descripcion text,
  tienda_id uuid,
  tienda_nombre text,
  tienda_telefono text,
  tienda_direccion text,
  tienda_lat double precision,
  tienda_lng double precision,
  distance_m double precision,
  similarity double precision
)
language sql
stable
security invoker
as $$
  with user_geo as (
    select st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography as g
  )
  select
    p.id as producto_id,
    p.nombre as nombre,
    p.precio as precio,
    p.moneda as moneda,
    p.categoria as categoria,
    p.descripcion as descripcion,
    t.id as tienda_id,
    t.nombre as tienda_nombre,
    t.telefono as tienda_telefono,
    t.direccion as tienda_direccion,
    st_y(t.ubicacion::geometry)::double precision as tienda_lat,
    st_x(t.ubicacion::geometry)::double precision as tienda_lng,
    st_distance(t.ubicacion, user_geo.g)::double precision as distance_m,
    (1 - (p.embedding <=> query_embedding))::double precision as similarity
  from public.productos p
  join public.tiendas t on t.id = p.tienda_id
  cross join user_geo
  where
    p.embedding is not null
    and p.disponible = true
    and (1 - (p.embedding <=> query_embedding)) >= similarity_threshold
    and st_dwithin(t.ubicacion, user_geo.g, max_distance_m)
  order by similarity desc, distance_m asc
  limit match_count;
$$;

grant execute on function public.buscar_productos_y_tiendas(
  vector(1536), double precision, double precision,
  double precision, integer, integer
) to anon, authenticated;
