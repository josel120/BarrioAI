-- BarrioAI: buscar_productos_y_tiendas v2 — single cosine computation.
--
-- WHY: the previous body computed (p.embedding <=> query_embedding) twice
-- per row (SELECT + WHERE) and ordered by the derived similarity, which
-- prevents the planner from using the HNSW index for ordering. This
-- version computes the distance once in a `scored` CTE, over-samples by
-- the raw operator (index-friendly), then applies the similarity
-- threshold and the final presentation order (similarity, distance).
--
-- Kept invariants: security invoker (never definer), stable, language sql,
-- same signature and return shape as 20261027040000.

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
  ),
  scored as (
    select
      p.id as producto_id,
      p.nombre,
      p.precio,
      p.moneda,
      p.categoria,
      p.descripcion,
      t.id as tienda_id,
      t.nombre as tienda_nombre,
      t.telefono as tienda_telefono,
      t.direccion as tienda_direccion,
      st_y(t.ubicacion::geometry)::double precision as tienda_lat,
      st_x(t.ubicacion::geometry)::double precision as tienda_lng,
      st_distance(t.ubicacion, (select g from user_geo))::double precision as distance_m,
      (p.embedding <=> query_embedding) as cosine_dist
    from public.productos p
    join public.tiendas t on t.id = p.tienda_id
    where
      p.embedding is not null
      and p.disponible = true
      and st_dwithin(t.ubicacion, (select g from user_geo), max_distance_m)
    order by p.embedding <=> query_embedding
    limit greatest(match_count * 4, 40)
  )
  select
    producto_id, nombre, precio, moneda, categoria, descripcion,
    tienda_id, tienda_nombre, tienda_telefono, tienda_direccion,
    tienda_lat, tienda_lng, distance_m,
    (1 - cosine_dist)::double precision as similarity
  from scored
  where (1 - cosine_dist) >= similarity_threshold
  order by similarity desc, distance_m asc
  limit match_count;
$$;

grant execute on function public.buscar_productos_y_tiendas(
  vector(1536), double precision, double precision,
  double precision, integer, integer
) to anon, authenticated;
