# BarrioAI — Borrador para el portal (Cerebral Valley)

> Ajustar a los campos exactos del portal (confirmados el 28 oct con login).
> Track: **Indie** · Tema: **Build for Your World**

## Título

BarrioAI — Lo que vende tu barrio, a un toque

## Descripción corta

Los menús del barrio viven en un papel: invisibles para cualquiera que no
pase por la puerta. BarrioAI convierte una foto de ese menú en una tienda
buscable en menos de un minuto. El comerciante fotografía su menú o
pizarrón; la IA de Meta lo lee, lo estructura con precios y lo ubica en
el mapa. Sus vecinos lo encuentran por antojo ("ceviche", "pollo a la
brasa"), ven precio y distancia, y piden por WhatsApp. Sin cuentas, sin
catálogos que armar, sin apps nuevas.

## El problema

Miles de negocios de barrio venden todos los días sin existir en internet:
su única vitrina es un menú escrito a mano. Digitalizarlos con las
herramientas actuales les pide computadora, fotos producto por producto y
conocimiento técnico que no tienen. El resultado: el comercio local pierde
contra plataformas que cobran comisión por cada venta.

## Cómo funciona

1. **Foto.** El comerciante abre barrioai.vercel.app, marca la ubicación
   de su local (GPS o zona) y fotografía el menú.
2. **Extracción (Meta).** La Meta Model API (`muse-spark-1.3`, visión)
   lee la foto y devuelve productos, precios y categorías estructurados.
3. **Revisión.** El dueño corrige nombres y precios antes de publicar y
   guarda un código de tienda: su llave para actualizar sin contraseñas.
4. **Búsqueda (Meta).** Los productos se indexan con embeddings de Meta +
   PostGIS/pgvector: el vecino busca por significado y cercanía, no por
   nombre exacto.
5. **Pedido.** Cada resultado muestra precio (S/), distancia y botón de
   WhatsApp con el mensaje ya escrito. La compra se cierra directo con la
   tienda, sin intermediarios.

## Uso de herramientas Meta (25%)

Meta Model API de punta a punta en el mismo flujo: **visión** para
digitalizar el menú y **embeddings** para la búsqueda semántica de los
vecinos. Ingesta y búsqueda comparten proveedor y modelo, así los
vectores siempre son comparables. OpenAI existe solo como respaldo si
Meta no responde; el camino normal nunca lo toca.

## Impacto (30%)

- Costo de entrada cero: un celular y una foto reemplazan al catálogo.
- El negocio aparece donde ya lo buscan: cerca, con precio visible.
- Sin comisiones ni intermediarios: el pedido va directo al WhatsApp
  de la tienda.
- Pensado para el barrio real: GPS opcional (zonas manuales), precios en
  soles, funciona con datos móviles.

## Profundidad técnica (20%)

- Next.js 16 + Supabase (Postgres, PostGIS y pgvector 1536) + Meta Model API.
- RPC de búsqueda híbrida: similitud coseno + distancia, con índices
  HNSW/GiST.
- Embeddings con estado y reintentos automáticos (cron diario): ningún
  producto queda invisible por una falla temporal.
- Límites de uso documentados para no superar el plan gratuito
  (docs/free-tier-limits.md).
- CI completa en cada PR: tipos, lint, build y E2E contra la build de
  producción — todo en verde.

## Links

- App en vivo: https://barrioai.vercel.app
- Video demo: (pegar link tras grabarlo, 31 oct)
- Repo: (pegar si el portal lo pide)
- Guía de usuario: docs/guia-nuevos-usuarios.pdf

## Datos de la demo

Todas las tiendas visibles en la demo son inventadas (Pollería El
Ejemplo, Cevichería La Muestra, Bodega Don Ejemplo — Miraflores), con
teléfonos de ejemplo. Ningún dato real de comerciantes.
