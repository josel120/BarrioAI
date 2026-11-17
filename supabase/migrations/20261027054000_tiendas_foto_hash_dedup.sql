-- BarrioAI: evita tiendas/productos duplicados al republicar un menú.
--
-- WHY: POST /api/upload insertaba una tienda nueva en cada publicación
-- sin tiendaId. Subir la misma foto dos veces (o tomar una foto nueva
-- del mismo pizarrón) creaba otra tienda en el mismo lugar con los
-- mismos productos, y el upsert de productos no ayudaba porque su
-- clave es (tienda_id, nombre) y la tienda era nueva cada vez.
--
-- Esta migración agrega la base para deduplicar sin borrar nada:
--   1. tiendas.foto_hash: SHA-256 (hex) de la última foto de menú
--      publicada. Un índice único parcial impide que el mismo archivo
--      cree dos tiendas, incluso con dos subidas concurrentes.
--   2. buscar_candidatas_tienda_duplicada(): candidatas cercanas (o con
--      la misma foto) junto a sus productos, para que la ruta decida
--      con nombre + distancia + coincidencia de menú (lib/dedup.ts).
--      Devuelve claim_hash, así que SOLO service_role puede ejecutarla:
--      se revoca el EXECUTE que Postgres da a PUBLIC por defecto.
--
-- Las tiendas duplicadas que ya existan NO se fusionan aquí: no hay
-- forma segura de saber cuál conserva el claim correcto. Se fusionan a
-- mano desde la tienda que tenga el código válido.

alter table public.tiendas
  add column if not exists foto_hash text;

comment on column public.tiendas.foto_hash is
  'SHA-256 hex de la última foto de menú publicada. NULL en tiendas previas a la deduplicación.';

create unique index if not exists tiendas_foto_hash_uidx
  on public.tiendas (foto_hash)
  where foto_hash is not null;

create index if not exists tiendas_nombre_norm_idx
  on public.tiendas (lower(btrim(nombre)));

create or replace function public.buscar_candidatas_tienda_duplicada(
  p_lat double precision,
  p_lng double precision,
  p_radio_m double precision default 100,
  p_foto_hash text default null
)
returns table (
  id uuid,
  nombre text,
  foto_hash text,
  claim_hash text,
  distancia_m double precision,
  productos jsonb
)
language sql
stable
security invoker
as $$
  with referencia as (
    select st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography as g
  ),
  cercanas as (
    select
      t.id,
      t.nombre,
      t.foto_hash,
      t.claim_hash,
      st_distance(t.ubicacion, referencia.g)::double precision as distancia_m
    from public.tiendas t
    cross join referencia
    where
      (p_foto_hash is not null and t.foto_hash = p_foto_hash)
      or st_dwithin(t.ubicacion, referencia.g, p_radio_m)
    order by
      (p_foto_hash is not null and t.foto_hash = p_foto_hash) desc,
      distancia_m asc
    limit 10
  )
  select
    c.id,
    c.nombre,
    c.foto_hash,
    c.claim_hash,
    c.distancia_m,
    coalesce(
      jsonb_agg(
        jsonb_build_object('nombre', p.nombre, 'precio', p.precio)
      ) filter (where p.id is not null),
      '[]'::jsonb
    ) as productos
  from cercanas c
  left join public.productos p on p.tienda_id = c.id
  group by c.id, c.nombre, c.foto_hash, c.claim_hash, c.distancia_m
  order by
    (p_foto_hash is not null and c.foto_hash = p_foto_hash) desc,
    c.distancia_m asc;
$$;

revoke execute on function public.buscar_candidatas_tienda_duplicada(
  double precision, double precision, double precision, text
) from public, anon, authenticated;

grant execute on function public.buscar_candidatas_tienda_duplicada(
  double precision, double precision, double precision, text
) to service_role;
