---
name: barrio-ui
description: BarrioAI design system — mercado tokens, ticket-row pattern, app shell, Spanish copy rules, and accessibility floor for any UI work in this project.
---

# BarrioAI UI

Use this skill for any visual work in BarrioAI (Next.js 16 App Router +
Tailwind v4, mobile-first Spanish PWA). It records the shipped design so new
screens stay consistent. Pair with `bundled:taste` (preflight),
`frontend-design` (new concepts), and `web-design-guidelines` (audit).

## Tokens (`app/globals.css`, plain `@theme`)

- Primary `mercado`: 50 `#f0fdf4`, 100 `#dcfce7`, 200 `#bbf7d0`,
  500 `#22c55e`, 600 `#16a34a`, 700 `#15803d`, 800 `#166534`,
  900 `#14532d`, 950 `#052e16`. Actions: `bg-mercado-700`,
  hover `bg-mercado-800`; dark-mode text accents use `mercado-500`.
  Colors stay in plain `@theme` (never `inline`) so utilities use
  `var(--color-*)` and themes can override them at runtime.
- Themes: default Mercado (green) plus Meta (`data-theme="meta"` on
  `<html>`, Meta blue 600 `#0064e0` / light `#0082fb`). Both themes
  share the same `mercado-*` utilities — the override remaps the vars,
  so new screens must use `mercado-*` classes, never hardcoded greens
  or blues. Toggle lives in `SiteHeader`, choice persists in
  `localStorage` (`barrioai-tema`), init script in `layout.tsx`
  restores it before paint.
- Ink: `zinc-900` / `zinc-50` (dark). Secondary `zinc-600` / `zinc-300`,
  muted `zinc-500` / `zinc-400`. Dividers `zinc-200` / `zinc-800`.
- Notices: amber tint for location/help, red tint for errors.
- Type: Archivo (`--font-archivo` via `next/font`), one family —
  extrabold + tight tracking for headings, regular/medium for body.
  Prices and distances always `tabular-nums`.
- Radii by hierarchy: pills `rounded-full` (buttons, chips), `rounded-xl`
  (inputs), `rounded-2xl` (panels, previews). Never one radius everywhere.

## App shell (`app/layout.tsx`, `components/site.tsx`)

- `lang="es"`, skip link to `#contenido`, sticky `SiteHeader` (wordmark +
  Vender action), `TabBar` fixed bottom (Inicio / Buscar / Vender).
- Content column `max-w-md`, `px-4`, `pt-5`, `pb-28` (clears the tab bar).
  Never add fixed elements that overlap the tab bar.
- Icons: stroke SVG from `components/icons.tsx` only — never emoji.

## Signature pattern: ticket rows

Product and price lists render like a paper ticket: name, dotted leader,
price. Copy from `app/buscar/page.tsx`:

```tsx
<div className="flex items-baseline gap-2">
  <p className="min-w-0 flex-initial truncate font-semibold">{nombre}</p>
  <span aria-hidden="true" className="mx-1 min-w-6 flex-1 border-b-2 border-dotted border-zinc-300 dark:border-zinc-700" />
  <p className="shrink-0 font-bold tabular-nums text-mercado-700 dark:text-mercado-500">{formatPrecio(precio, moneda)}</p>
</div>
```

Meta line below: store · distance · category, truncated. Descriptions
`line-clamp-2` + `break-words`. Prices always render via `formatPrecio`
(`@/lib/formatPrecio`): PEN shows as `S/`, other codes keep `$` + code.

## Forms and states

- Every input has a `<label>` (visible or `sr-only`), `name`,
  `autoComplete`, correct `type`/`inputMode`; search placeholders end
  with `…` and show an example.
- Multi-step flows use real sequence numbers (see `MenuUploadForm` 1·2·3),
  not decorative cards.
- Async updates sit in `aria-live="polite"`; loading copy ends with `…`;
  errors name the problem and the fix; empty states invite the next action.
- Focus: global `:focus-visible` outline in `globals.css` — never remove
  it without a replacement. No decorative motion; color-only transitions.
