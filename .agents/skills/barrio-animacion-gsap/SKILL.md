---
name: barrio-animacion-gsap
description: When and how to use GSAP in BarrioAI (React 19, Next.js 16) for scroll, timelines, and sequences CSS cannot solve, without hurting mobile performance.
---

# BarrioAI — GSAP animation

Use it only when CSS ([barrio-transiciones-ui](../barrio-transiciones-ui/SKILL.md)) is not enough: choreographed sequences, scroll-linked motion, pinning, or parallax. Distilled inspiration from GreenSock's official skills (greensock/gsap-skills: core, timeline, ScrollTrigger, react, performance).

## Before installing

- GSAP is **not** a project dependency. Installing `gsap` and `@gsap/react` requires explicit user confirmation; never as a side effect of "animating something".
- All GSAP lives on the client: a `"use client"` component or a dynamic import with `ssr: false`, same as Leaflet. No GSAP in Server Components.

## React pattern (mandatory)

- Prefer `useGSAP` from `@gsap/react` with `scope` set to the container ref; register plugins once (`gsap.registerPlugin(useGSAP, ScrollTrigger)`).
- Without `@gsap/react`: `gsap.context(fn, ref)` inside `useEffect`, always with `return () => ctx.revert()`. No cleanup means leaks and orphaned ScrollTriggers after navigation.
- Wrap callbacks created after the effect with `contextSafe`.
- Selectors always scoped to the container; never global strings that cross components.

## Timelines

- Sequence with `gsap.timeline({ defaults: { duration: 0.5, ease: "power2.out" } })`, `addLabel()` labels, and the position parameter (`"<"`, `"-=0.2"`, `"label+=0.3"`). Chaining with `delay` is forbidden.
- ScrollTrigger goes on the timeline or the root tween, never on child tweens.

## ScrollTrigger in a mobile PWA

- Explicit `start`/`end` (`"top 85%"`, `"+=100%"`); `scrub: 1` smooths and cheapens. `markers` never in production.
- Pinning: avoid in the `max-w-md` column unless the design asks for it and it is verified on a real phone; do not animate the pinned element itself, animate its children.
- `ScrollTrigger.refresh()` after images, fonts, or the map load, debounced; not on every resize.
- In Search, the Leaflet map already owns its gestures: no ScrollTrigger may compete with its scroll/zoom.

## Performance (mobile first)

- Animate only `transform` (x, y, scale, rotation) and `opacity`. Never `width/height/top/left` for movement.
- `will-change: transform` only on elements that actually animate.
- `gsap.quickTo()` for continuously updated properties (followers, pointer parallax).
- Stagger instead of dozens of manual tweens; kill off-screen animations and on unmount.
- Test on a low-end device: if it cannot hold 60fps, the animation gets simpler or goes away.

## Accessibility

- Respect `prefers-reduced-motion` with `gsap.matchMedia()`: no motion, straight to the final state.
- The golden path (photo → extraction → search → WhatsApp) never waits on an animation to work.
