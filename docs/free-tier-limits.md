# Límites del free tier (Supabase + Vercel)

Objetivo: llegar al **4 nov 2026** (cierre de la hackathon) sin pasarnos
de ningún cupo gratuito. Todo tope vive en
[lib/limits.ts](../lib/limits.ts) y se puede subir por env (`LIMIT_*`,
ver `.env.example`) sin tocar código.

## Cupos verificados (páginas de precios, oct 2026)

| Servicio | Cupo free | Nuestro consumo principal |
| --- | --- | --- |
| Supabase DB | 500 MB | `productos.embedding vector(1536)` + índice HNSW |
| Supabase Storage | 1 GB | 1 foto de menú por tienda (bucket `menus`) |
| Supabase egress | 5 GB (+5 GB cacheado) | RPC de búsqueda + fotos públicas |
| Supabase pausa | tras 1 semana sin actividad | el cron diario evita la pausa |
| Vercel transferencia | 100 GB/mes | páginas + respuestas API |
| Vercel funciones | 1M invocaciones, 4 h CPU activa/mes | `/api/search`, `/api/upload` |
| Vercel Image Optimization | 5K transformaciones/mes | no la usamos (`next/image` ausente) |
| Vercel Cron | plan Hobby: 1 vez/día por job | `0 6 * * *` cumple; no subir la frecuencia |
| Meta/OpenAI | cuota de la cuenta | 1 llamada de visión/ext + 1 de embeddings |

## Topes aplicados (defaults)

| Tope | Valor | Protege |
| --- | --- | --- |
| Foto de menú (servidor) | 4 MB, JPG/PNG/WebP | Storage + egress |
| Foto de menú (bucket) | 4 MB + MIME allowlist (migración `20261028000000`) | Storage, aunque se salte la API |
| Productos por subida | 60 (antes 200) | DB: ~0,8 MB por menú |
| Tiendas totales (nuevas) | 300 → 503 al llegar | Storage: ~90 MB con fotos comprimidas |
| Productos totales (tiendas nuevas) | 5 000 → 503 al llegar | DB: ~65 MB de vectores+índice |
| Subidas por IP | 5/min y 20/h | cuota de visión + funciones |
| Búsquedas por IP | 30/min | cuota de embeddings + funciones |
| Resultados por búsqueda | máx. 20 | egress + CPU del RPC |
| Productos por tienda (GET) | máx. 100, cache CDN 60 s | egress |
| Re-embeddings por cron | 20/día | cuota de embeddings |
| Caché de embeddings de búsqueda | 500 consultas, TTL 10 min | las consultas repetidas de la demo no repagan |

Notas:

- El cliente ya comprime la foto a ≤1024 px JPEG (~300 KB); el tope de
  4 MB del servidor es contra abuso directo de la API, no el caso normal.
- Al actualizar una tienda, la foto anterior se borra de Storage tras
  publicar. Sin esto, cada actualización filtraba un blob huérfano.
- Los topes globales solo bloquean tiendas **nuevas** (503 en español);
  actualizar una tienda existente siempre funciona.
- El rate limit es en memoria por instancia (ver `lib/rateLimit.ts`):
  acota el abuso por instancia, no es un contador global exacto.

## Qué revisar a mano (5 min, 2 veces por semana)

1. Supabase → *Project Settings → Usage*: DB size, Storage, egress.
   Alerta mental al 50 %: DB 250 MB, Storage 500 MB, egress 2,5 GB.
2. Vercel → *Settings → Usage*: Fast Data Transfer, Function
   Invocations, Fluid Active CPU (la más ajustada: 4 h/mes).
3. Si un cupo se acerca: bajar `LIMIT_MAX_TIENDAS` /
   `LIMIT_MAX_PRODUCTOS` / rates en Vercel env y redeploy; la demo
   sigue viva con lo ya publicado porque buscar no crea datos.

## Si se llega a un tope durante la demo

- **503 "Alcanzamos el cupo de tiendas de la demo"**: subir
  `LIMIT_MAX_TIENDAS`/`LIMIT_MAX_PRODUCTOS` tras revisar el punto 1.
- **429**: esperar el `Retry-After`; es por IP, no global.
- **Proyecto pausado por inactividad**: cualquier visita + el cron
  diario lo mantienen activo; si se pausó, *Restore project* en el
  dashboard de Supabase tarda unos minutos.
