---
name: barrio-diseno-criterio
description: Design judgment and anti-pattern audit for BarrioAI views, so no screen reads as a generic AI template.
---

# BarrioAI — Design judgment

Use it before creating or reworking any view. It complements [barrio-ui](../barrio-ui/SKILL.md) (tokens and ticket rows): this skill provides the judgment, barrio-ui provides the system. Distilled inspiration from Impeccable (pbakaus/impeccable).

## Mode of each surface

- **Operate** (search, sell, store detail): the user completes a task. Scannability, consistency, and precise detail win. The brand lives in the details, not in effects.
- **Persuade** (landing or presentation only): a memorable moment is allowed there. Never mix modes: a task screen is not decorated like a landing page.

## Two-pass process

1. Short plan: palette (from `mercado-*`, never loose colors), type (Archivo), layout in one sentence, and the single memorable element.
2. Anti-template review: if the plan would work unchanged for any other app, it is not a decision. Change what is generic and say what you changed and why before coding.

## Anti-patterns that betray AI UI (reject)

- Identical icon+title+text cards as page structure; cards inside cards are always wrong.
- An uppercase label above every heading ("eyebrow"), 01/02/03 numbering when there is no real sequence, gradient text, decorative glass/blur.
- A thick colored side border on cards or notices, hard unblurred shadows outside a declared neobrutalist world.
- A giant metric with a small label and supporting stats as the default hero.
- A modal for tasks that need neither interruption nor protected focus.
- Emoji icons or Unicode glyphs; stroke SVG icons from `components/icons.tsx`.
- The same fade-and-rise entrance on every section. One orchestrated moment, not scattered effects.

## Quality floor (verify in the render, together)

- Contrast: body and placeholder text ≥ 4.5:1, large text ≥ 3:1. On colored surfaces, tint secondary text from that hue, never gray.
- Shadows carry an offset and soft blur; a zero-offset colored halo is decoration.
- Tight groups, generous separation; more space above a heading than below it.
- Always ship states: hover, visible focus, disabled, loading, error, and empty, with real content.
- Browser surfaces are designed too: text selection, focus rings, scrollbars, and tabular numerals inherit the palette.
- Copy stays in Spanish and actionable: the control names its action ("Publicar menú", not "Enviar"); the error names the problem and the way out.

## Vocabulary for requesting changes

`audit` (review against this list), `polish` (final detail pass), `distill` (strip to the essence), `harden` (errors, edge cases, i18n), `animate` (purposeful motion), `clarify` (copy and labels). At the end of a visual pass: look at the result and remove one accessory, per Chanel's advice.

## Limits in BarrioAI

- Never break the golden path: photo → extraction → search → WhatsApp.
- `max-w-md` column, `pb-28` above the TabBar, prices via `formatPrecio` with `tabular-nums`.
- Verify at real mobile width (360–430 px) before calling a view done.
