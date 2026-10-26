drop function if exists public.buscar_productos_cercanos(vector, float, float, int, int);

create function public.buscar_productos_cercanos(
  query_embedding vector(1536), lat float, lng float,
  radio_metros int default 2000, limite int default 20
)
returns table (
  id uuid, tienda_id uuid, tienda_nombre text, tienda_telefono text,
  tienda_lat float, tienda_lng float,
  nombre text, precio numeric, categoria text, descripcion text,
  distancia_metros float, similitud float
) language sql stable as $$
  select
    p.id, p.tienda_id, t.nombre, t.telefono,
    ST_Y(t.ubicacion::geometry)::float, ST_X(t.ubicacion::geometry)::float,
    p.nombre, p.precio, p.categoria, p.descripcion,
    ST_Distance(t.ubicacion, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography)::float,
    (1 - (p.embedding <=> query_embedding))::float
  from public.productos p
  join public.tiendas t on t.id = p.tienda_id
  where p.disponible = true and p.embedding is not null
    and ST_DWithin(t.ubicacion, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography, radio_metros)
  order by p.embedding <=> query_embedding
  limit limite;
$$;