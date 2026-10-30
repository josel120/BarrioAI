# BarrioAI — Guion de impacto y video demo (Hackathon Meta)

**Track: Indie · Tema: "Build for Your World"**
**Demo en vivo: https://barrioai.vercel.app**
**Regla: todo dato mostrado es inventado (tiendas demo). Nada de PII real.**

## El problema (esto abre el video y el writeup)

En el barrio, el menú vive en un papel o un pizarrón. Si no pasas por la
puerta del local, no existe: no está en ningún buscador, no tiene precios
visibles, no se puede pedir a distancia. Miles de negocios venden todos
los días y son invisibles para sus propios vecinos.

Digitalizarlos suele pedirles una computadora, un catálogo, fotos de cada
plato y alguien que sepa hacerlo. No lo tienen. Lo que sí tienen es el
menú ya escrito — en la pared.

## La solución en una frase

BarrioAI convierte una foto de ese menú en una tienda buscable en menos
de un minuto: la IA de Meta lo lee, lo estructura con precios, lo ubica
en el mapa y lo deja listo para pedir por WhatsApp.

## Cómo lo resuelve cada pieza (Impacto 30%)

| Pieza | Problema que ataca |
|---|---|
| Foto única del menú o pizarrón | El comerciante no tiene catálogo digital ni tiempo de crearlo |
| Extracción con Meta vision (`muse-spark-1.3`) | Leer texto y precios de una foto real, con luz real, sin tipear nada |
| Revisión antes de publicar | La IA puede equivocarse: el dueño corrige nombres y precios en segundos |
| Código de tienda | Sin cuentas ni contraseñas: el dueño guarda un código y con él actualiza |
| Ubicación GPS o zona manual | El negocio aparece cerca de quien lo busca, aunque no quiera dar GPS exacto |
| Búsqueda semántica + distancia | El vecino busca "ceviche" o "algo para el almuerzo", no el nombre exacto |
| Botón de WhatsApp | El pedido se cierra donde el barrio ya conversa: WhatsApp, sin apps nuevas |
| Límites y costos de nube controlados | Aguanta el plan gratuito: la demo no se cae por cuota a mitad del evento |

## Guion de video (una toma lo más continua posible)

0:00–0:10 — **El problema.** Plano del pizarrón de una tienda (ficticia,
de las demo). Voz: "Este menú solo lo ve quien pasa por la puerta."
0:10–0:25 — **La foto.** Abrir barrioai.vercel.app en el celular, tocar
"Publicar mi menú", marcar ubicación, tomar la foto del menú.
0:25–0:50 — **La lectura.** "Leyendo tu menú…" (~20 s; acelerar en
edición si hace falta, sin cortar el resultado). Aparece la lista:
corregir un precio en vivo para mostrar la revisión.
0:50–1:05 — **Publicar.** "Publicar menú revisado" → "Tu tienda ya está
en BarrioAI" → guardar el código de tienda.
1:05–1:30 — **El vecino.** Cambiar de rol (mismo celular vale): buscar el
producto recién publicado, ver precio y distancia en el ticket y el pin
en el mapa.
1:30–1:45 — **El pedido.** Tocar WhatsApp: se abre el chat con el mensaje
ya escrito. Enviarlo.
1:45–2:00 — **Cierre.** Voz: "Una foto. Eso es todo lo que necesita un
negocio de barrio para existir en internet." Logo y URL.

Ajustar la duración total a lo que pida el portal (confirmado el 28 oct).

## Tiendas demo (inventadas, Miraflores — para que la búsqueda siempre encuentre)

| Tienda | Producto a buscar | WhatsApp guardado |
|---|---|---|
| Pollería El Ejemplo (demo) | Pollo a la brasa 1/4 | 51999111222 |
| Cevichería La Muestra (demo) | Ceviche clasico | 51999333444 |
| Bodega Don Ejemplo (demo) | Pan frances | 51999555666 |

Plan B si la red falla: estas tiendas ya están publicadas; la demo puede
empezar directo en la búsqueda (paso 1:05) y mostrar la publicación
después, o apoyarse en las capturas del flujo.

## Frase Meta (para el writeup y el pitch)

> BarrioAI usa la Meta Model API de punta a punta: visión
> (`muse-spark-1.3`) para leer el menú fotografiado y embeddings de
> Meta para que los vecinos busquen por antojo, no por nombre exacto.
> OpenAI queda solo como respaldo si Meta no responde.
