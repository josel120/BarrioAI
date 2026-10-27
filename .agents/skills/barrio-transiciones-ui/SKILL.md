---
name: barrio-transiciones-ui
description: Motion tokens and CSS transitions ready for BarrioAI views, with durations, easings, and reduced-motion guards.
---

# BarrioAI — UI transitions

Use it when animating opens, closes, state changes, or screen changes. CSS first, no dependencies. Distilled inspiration from Transitions.dev (Jakubantalik/transitions.dev, 35 transitions); only the ones useful for a mobile task PWA are kept here.

## Tokens (propose in `app/globals.css` as variables, with confirmation)

| Token | Value | Use |
|---|---|---|
| `--duration-micro` | 80ms | delays, shake segments |
| `--duration-quick` | 150ms | closes, text swaps |
| `--duration-fast` | 250ms | opens, icon swaps, page slides |
| `--duration-medium` | 350ms | panel/toast closes |
| `--duration-slow` | 400ms | panel opens, skeleton reveals |
| `--duration-stagger` | 40ms | per-item offset (infrequent entries only) |
| `--ease-smooth-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | open/close, slide, resize |
| `--scale-modal` | 0.96 | modal/sheet starting scale |
| `--blur-small` | 2px | cross-blur on swaps and reveals |

Every new animation references tokens, never loose durations in the component.

## Catalog chosen for BarrioAI

- **Skeleton → content** (search): placeholder pulse, then reveal with cross-fade + 2px blur at 400ms. This is the `app/loading.tsx` and results case.
- **Modal / sheet** (store detail, confirm): enters scale 0.96→1 at 250ms, exits softer at 150ms.
- **Panel reveal**: slide + cross-blur for in-column panels (e.g. map ↔ list in Search).
- **Page side-by-side**: list ↔ detail with an 8px slide and 3px blur at 250ms.
- **Text swap / soft text swap**: states changing in place ("Buscando…" → "12 resultados") with blur and a 4px rise, 150ms.
- **Icon swap**: cross-fade with blur and scale 0.25→1 at 250ms (e.g. heart, eye, check).
- **Error shake** (sell form): per-segment shake with a self-reverting border; the message stays, the gesture does not punish.
- **Success check** (menu published): stroke-drawn check after saving; a single celebration moment.
- **Toast**: rises with fade + blur, slower in than out.
- **Accordion**: expand via `grid-template-rows` with a rotating chevron (categories, FAQs).
- **Sliding tabs**: the pill slides in segmented controls; never move the fixed bottom TabBar.

## Rules

- Always interruptible: CSS transitions for interactive states; keyframes only for staged sequences that run once.
- Exits are softer than entries; ease-out on both.
- Stagger only infrequent entries that communicate hierarchy; never repeated interactions (the results list is not staggered on every search).
- `transition: all` is forbidden: list the properties. Animate `transform` and `opacity`; `width/height` only for deliberate resizes.
- Mandatory guard: `@media (prefers-reduced-motion: reduce)` lands on the final state with no motion.
- Nothing here may cover the TabBar or steal focus: content keeps `pb-28` and visible focus intact.
