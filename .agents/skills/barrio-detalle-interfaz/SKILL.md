---
name: barrio-detalle-interfaz
description: Visual micro-detail for BarrioAI: concentric radii, shadows, hit areas, states, and icons that make the interface feel cared for.
---

# BarrioAI — Interface detail

Use it in the final pass of any component, or when something "looks off" without an obvious cause. Always speak in the project's system (Tailwind v4 + `mercado-*` tokens), never a second styling system. Distilled inspiration from Make Interfaces Feel Better (jakubkrehel/make-interfaces-feel-better).

## Surfaces

- **Concentric radius**: outer radius = inner radius + padding. Equal radii on nested elements is the most common "feels off" bug. In BarrioAI: a `rounded-2xl` (16px) panel with a child at 8px padding → child `rounded-lg` (8px).
- **Shadows for elevation, borders for structure**: if a border only fakes depth, replace it with layered transparent shadows with offset and blur. Borders that communicate structure or state (dividers, selection, focus) stay.
- **Align optically, not geometrically**: icon+text pairs, play triangles, and asymmetric glyphs are nudged by eye (1–2px), not by the ruler.
- **Images**: a 1px semi-transparent `outline` on photos (menus, stores) so no image edge floats.
- **Minimum 44px hit area** on mobile even when the glyph is 20px; the TabBar and ticket-row buttons included.

## Typography

- `-webkit-font-smoothing: antialiased` on the root (already in the system; do not duplicate).
- `tabular-nums` on every aligned number: prices, distances, counts. Always via `formatPrecio`/`formatDistance`.
- `text-wrap: balance` on headings and `pretty` on short paragraphs; no widows on store cards.

## Icons

- Stroke weight matched to the neighboring text weight; icons from `components/icons.tsx` in `currentColor`, one SVG recolored per state (never two files per color).
- Icon swaps cross-fade: opacity 0→1, scale 0.25→1, blur 4px→0. No visibility flicker.

## Motion (detail, not spectacle)

- Press: `scale` 0.97–0.98 on primary buttons while pressed; release returns with no bounce.
- Staged entries: split into semantic chunks and stagger ~100ms; routine content is neither staggered nor animated on page mount.
- Short exits: a small `translateY` with ease-out, softer than the entry.
- `transition: all` is forbidden (list the properties), and no preventive `will-change` everywhere.

## Five-minute review

1. Walk the states: hover, visible focus, active, loading, error, empty.
2. Check nested radii, shadows, and hit areas on the densest screen (Search).
3. Verify prices and distances align with `tabular-nums`.
4. If a motion feels doubtful, watch it slowly: what bothers you at 10% speed is what people notice at 100%.
