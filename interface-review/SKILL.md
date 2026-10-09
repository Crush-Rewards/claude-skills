---
name: interface-review
description: "Use when reviewing, auditing, or polishing a web interface — a screen, flow, component, PR diff, or Figma frame — for accessibility, layout, writing, typography, and UI polish (radius, shadows, motion, icons). Produces one consolidated, severity-ranked findings table with file:line evidence and a Block / Needs changes / Approve verdict. Read-only unless asked to implement. Modes: `quick` or `full` (default)."
---

# Interface review

Review the interface as one system. A strong interface is not five independent audits stapled
together. Position and spacing carry hierarchy before a word is read, the words themselves do the
explaining, type makes them legible, and polish is what makes the result feel deliberate rather than
assembled. Review the whole experience, then consolidate into one prioritized verdict.

**Where it runs:** in the repository that contains the interface under review — confirm the working
directory is that repo's root before the first command. For a Figma-only review there is no repo;
the frame is the artifact.

When reviewing, slow the interface down. Walk it as a keyboard-only user first — every flow must
complete without a mouse. Read the page instead of scanning the code: squint to check the hierarchy
holds, read one full paragraph for comfort, resize the viewport to catch bad wrapping and truncation
at real content lengths. Replay motion at 10% speed in the browser's Animations panel and walk every
state: hover, focus, active, loading, empty. What feels off at 10% speed is what's subtly wrong at
full speed.

**Match the project's styling system.** Before writing any fix, check how the codebase styles things
and express every change in that system: Tailwind utilities in a Tailwind project, plain declarations
in CSS, CSS Modules, styled-components or StyleX. Preserve the project's component library, tokens,
and density, and its established motion language except where a principle below prescribes an exact
interaction pattern. Never introduce a second styling approach just to apply a fix.

Treat numeric values as starting points for interfaces without an established density or spacing
system. Preserve deliberate platform chrome, compact professional tools, and project tokens when they
remain usable under hit-area, zoom, localization, and viewport stress tests.

Color notation, palette construction, and gamut are out of scope; this skill measures and reports
contrast but does not repaint the project.

## Reference files

The principles below are the checklist. The references hold the recipes — read the one you need
before writing a fix or judging a borderline case.

| File | Read when |
| --- | --- |
| `references/surfaces.md` | Border radius, optical alignment, shadows vs borders, image outlines |
| `references/animations.md` | Transitions vs keyframes, enter/exit, icon swaps, scale on press, `initial={false}` |
| `references/icons.md` | Stroke vs text weight, `currentColor` states, outline/fill, render size, RTL |
| `references/performance.md` | `transition: all`, `will-change` |
| `references/figma-annotation.md` | The review target is a Figma frame — how to draw finding cards on the canvas |

## How to run a review

### Resolve scope and mode first

Infer the screen, flow, feature, or repository scope from the request and current workspace. State
the resolved scope in the output. Use `full` when no mode is supplied.

| Mode | Coverage | Finding cap |
| --- | --- | --- |
| `quick` | Primary user path and highest-traffic states; report only `HIGH` and `MEDIUM` issues | 5 |
| `full` | Entire requested scope across all five domains, including empty, loading, error, and narrow-width states when present | 15 |

If the requested scope is too large to inspect credibly, narrow it to the highest-traffic complete
flow and state the boundary. Never imply uninspected surfaces were reviewed.

### Recon before judgment

Identify the framework, styling system, component library, design tokens, supported viewports, and
available preview or test commands. For copy, inspect nearby interface text, the product's
terminology, localization conventions, and any voice or content style guide before proposing a
change.

### Review in this order

Foundational failures must not be hidden by polish:

1. Accessibility
2. Layout
3. Writing
4. Typography
5. UI polish

When two domains appear to cover the same issue, assign it to the one that owns the underlying rule
and mention secondary effects in the **Why** cell. Report it once.

### Require evidence

Every finding cites `path/to/file:line` and shows the current implementation. If the review artifact
has no source files, cite the exact screen and component. Do not report a code-level finding from
visual appearance alone, or a visual finding from source code alone when runtime behavior determines
the result.

To inspect the rendered state, use whatever browser automation the session has, if any:
screenshots at the narrowest and widest supported widths, keyboard-only walks, emulated
`prefers-reduced-motion`, and computed-style reads for contrast. Without one, mark those checks
**Not verified**.

### Review without mutating by default

Treat a review request as read-only. Do not edit source code unless the user also asks to implement
the findings. When implementation is requested, preserve the consolidated report as the change scope
and re-run the relevant verification afterward.

## Accessibility

Accessibility is not a compliance checkbox bolted on at the end; it is the floor for interface
craft. Most of it is free if you use the platform: native elements ship with keyboard support, real
labels announce themselves, and a visible focus ring is one CSS rule. When unsure, prefer the
platform default over a custom rebuild, and remove ARIA rather than add it.

1. **Native elements first.** The first rule of ARIA: don't use ARIA when a native element exists.
   `<button>` for actions, `<a href>` for navigation (it must support Cmd/Ctrl/middle-click), never
   `<div onClick>`. No ARIA is better than bad ARIA.
2. **Visible focus rings.** Style `:focus-visible`, not bare `:focus`, so keyboard users get a ring
   and mouse users usually don't. Prefer the browser's unmodified focus indicator. If the design
   needs a custom ring, use a project focus token or another explicit color and verify the complete
   indicator against every adjacent color it crosses; `currentColor` is acceptable only after the
   same check. Use at least a `2px` solid perimeter or an equivalent visible area. Never use
   `outline: none` without a verified replacement, and preserve system colors in forced-colors mode.
3. **Full keyboard support.** Every pointer interaction needs a keyboard path, following the ARIA APG
   patterns: Escape closes overlays, arrow keys move within composite widgets (tabs, menus,
   listboxes), Tab moves between widgets, Enter and Space activate. Only `tabindex="0"` (join the
   natural tab order) and `tabindex="-1"` (programmatic focus), never positive values. Composite
   widgets use roving tabindex: the active item is `0`, all others `-1`.
4. **Trap and restore focus.** Modals set `inert` on the background content, move focus inside on
   open, and return focus to the trigger on close. Add `overscroll-behavior: contain` so background
   content doesn't scroll.
5. **Minimum hit area.** WCAG 2.5.8's Level AA baseline is a 24×24 CSS-pixel target or one of its
   defined spacing, equivalent-control, inline, user-agent, or essential exceptions. For easier
   activation, aim for 44×44px in touch contexts and 40×40px in desktop interfaces when density
   permits. Extend with a pseudo-element if the visible element should stay smaller. Never let
   extended hit areas overlap.
6. **Label and type every control.** Every input gets a `<label for>` or wrapping `<label>`; a
   placeholder is never a label, and label and control share one hit target: no dead zones between a
   checkbox and its text. Add `autocomplete` with a meaningful `name`, and the correct `type` and
   `inputmode` for the keyboard. Never block paste; users paste passwords and one-time codes.
7. **Accessible names everywhere.** Icon-only buttons need a descriptive `aria-label`. Visible label
   text must appear in the accessible name. Decorative elements get `aria-hidden="true"`, never on a
   focusable element.
8. **Don't rely on color alone.** Status needs a redundant cue: icon, text, or underline alongside
   the color. Determine which WCAG contrast requirement applies from the content and state, then
   measure the rendered foreground/background pair. When contrast fails, report the pair and the
   requirement it misses; do not change the project's colors unless asked.
9. **Honor `prefers-reduced-motion`.** Wrap motion in
   `@media (prefers-reduced-motion: no-preference)` so it is opt-in. Under reduced motion, replace
   slides and scales with opacity crossfades; kill parallax and autoplay entirely. Independent of the
   preference: autoplaying media needs a visible pause control, and toasts carrying actions or errors
   stay until dismissed.

## Layout

Layout communicates before a single word is read: position, spacing, and alignment carry hierarchy
on their own, and generous space beats decoration. A good layout also survives stress: resize it,
translate it, mirror it for RTL, and it should still hold together.

1. **Group with space, not lines.** Negative space is the primary grouping tool; background shapes
   second; separator lines last, only where space alone can't carry the structure. The gap between
   groups must be at least 2× the gap within a group (`8px` intra-group → `16px`+ inter-group), or
   the grouping reads as noise.
2. **Keep controls distinct from content.** Interactive elements must look interactive: a background
   shape, a border, or a consistent placement zone. Never style a control identically to adjacent
   static text.
3. **Align to shared edges.** Pick alignment edges and stick to them; every stray edge reads as
   noise. Use one project spacing step for each level of subordination (`16px` is a useful default).
   Use logical properties (`padding-inline-start`, `margin-inline-end`) for direction-dependent
   layout; reserve physical left/right for genuinely physical geometry.
4. **Order by importance.** The most important content sits near the top and the leading edge;
   reading order flows top-to-bottom, leading-to-trailing. Think in leading/trailing, not left/right.
5. **Breathing room between targets.** Without an established density system, start with `12px`
   between adjacent bordered or filled controls and `24px` of clearance around borderless text- and
   icon-only controls. Compact layouts may use less when the hit areas above do not overlap and the
   controls remain visually distinct.
6. **Hold structure until it breaks.** Breakpoints come from the content, not device presets. Keep
   the expanded layout as long as it genuinely fits and collapse late; prefer container queries for
   component-level adaptation. Test the smallest and largest sizes first.
7. **Plan for growth and clipping.** Plan for substantial and language-dependent string growth rather
   than relying on a universal percentage: no fixed widths or heights on text containers, and let
   rows wrap. Never park critical actions where resizing or scrolling clips them; keep them reachable
   in the normal flow or stable chrome appropriate to the product.

## Writing

Clear and brief beats clever, consistency beats variety, and the best error message is the
interaction redesigned so the error can't happen. Preserve intentional brand character when it
remains clear and appropriate to the stakes: treat a difference from generic plain language as a
finding only when it creates inconsistency, ambiguity, translation risk, or an inappropriate tone.

1. **One voice, flexible tone.** The product has one voice, established by its existing system rather
   than invented during a local edit. Keep terms consistent: if it's "Archive" in the menu, it isn't
   "Move to storage" in the toast. Tone flexes with the stakes:

   | Context | Tone |
   | --- | --- |
   | Success, onboarding, empty states | Warm, can be light |
   | Routine actions, settings | Neutral, minimal |
   | Errors, destructive confirmations | Calm, plain, zero playfulness |
   | Data loss, security | Serious, explicit |

2. **Plain words over clever ones.** Choose easily understood words and delete every word that isn't
   needed. No idioms, colloquialisms, or humor that won't translate. Skip unnecessary gender:
   "Subscribers can post recipes", not "each subscriber can post his or her recipes". Match the input
   device: "tap" on touch, "click" with a pointer, "select" when both are possible. Never build
   sentences by concatenating fragments around variables (`"You have " + n + " new messages"`); word
   order changes per language, so use full templated strings with proper pluralization.
3. **Verb-first buttons.** Button labels start with a verb naming the specific action: "Send", "Save
   draft", "Delete project". Never "OK!", "Let's go!", or bare "Yes"/"No" on consequential actions.
   Confirmation buttons repeat the consequence so the dialog is answerable without reading the body:
   "Delete this project?" offers `Delete project` and `Cancel`, not `Yes` and `No`.
4. **Links describe their destination.** Link text makes sense out of context; screen-reader users
   navigate by a list of the page's links. "Read the billing docs", never "Click here" (which also
   fails the device-verb rule on touch), and never a bare "Learn more" when several appear on one
   page. Suffix each: "Learn more about exports".
5. **One capitalization policy.** Pick title case or sentence case per element type (all buttons, all
   headings) and apply it consistently; sentence case is the safer default: calmer, no per-word case
   rules, localizes cleanly. "Save Changes" beside "Discard changes" reads as sloppiness.
6. **Errors say how to fix, next to where it broke.** An error is an instruction, adjacent to the
   failing field:

   | Bad | Good |
   | --- | --- |
   | That password is too short | Choose a password with at least 8 characters |
   | Invalid name | Use only letters for your name |
   | Oops! Something went wrong. | Unable to save. Check your connection and try again. |

   No blame, no "oops", no exclamation marks. Phrase hints positively ("Use only letters", not "Don't
   use numbers or symbols") and show them before the mistake, not after. If the same error keeps
   firing for many users, redesign the interaction instead of rewording it.
7. **Empty states point forward.** An empty state says what this place is and how to fill it, with
   one clear next action:

   ```html
   <!-- Bad: a shrug -->
   <p>No results.</p>

   <!-- Good: orientation plus a next step -->
   <p class="font-medium">No projects yet</p>
   <p class="text-sm text-zinc-500">Projects keep your tasks and files together.</p>
   <button class="mt-4">Create a project</button>
   ```

   Search and filter empty states name the query and offer an exit: "No results for 'quarterly'.
   Clear filters". Never park crucial persistent information in an empty state; it disappears the
   moment content exists.

## Typography

Good typography is mostly restraint. A sensible scale, comfortable spacing and enough contrast beat
any clever effect. A label, a table cell, a marketing headline and an article paragraph should not
share one set of rules.

1. **Fewer fonts, sizes and weights.** Rarely use more than three fonts. Weight and size define
   hierarchy, but overusing them hurts readability quickly. Pair for contrast, not similarity: a
   serif headline with a sans body reads as deliberate, two near-identical sans-serifs read as a
   mistake. Below `18px`, stay at weight `400`+; weights under `300` are display-only (`28px`+).
2. **Use a type scale with semantic names.** Define a small set of sizes and deviate from it as
   little as possible. Hard-coded sizes without a system break down at scale. For solo projects,
   default names like `text-sm` work fine as long as the usage rules are clear. On a team, name sizes
   by use (`text-body-sm`), not by size.
3. **Heading sizes descend with level.** Within a coherent page hierarchy, map heading levels to
   descending steps of the type scale: a visually subordinate heading should not accidentally
   overpower its parent. Adjacent levels may share a size toward the small end of the scale as long
   as weight or spacing keeps them distinct. Semantic heading choice belongs to Accessibility; this
   rule controls only visual treatment.
4. **Line-height by role.** Headings tighter, around `1.1`. Body copy `1.5` to `1.6`. Prefer unitless
   values so line-height scales with the font size; fixed values like `24px` do not. Anything that
   wraps to three or more lines needs at least `1.4`, even in height-constrained rows.
5. **Cap the measure.** Cap long-form text around 60–75 characters per line. `65ch` measures
   characters directly; a pixel or rem cap is just as good (at a `16px` body size roughly
   `560px`–`680px`, so Tailwind's `max-w-xl` or `max-w-2xl`). What matters is that a cap exists and
   the resulting line length sits in range.
6. **Wrap deliberately.** `text-wrap: balance` on headings. `text-wrap: pretty` on descriptions. Skip
   both in long-form text. `overflow-wrap: break-word` where long words, links or IDs could escape
   the container. `white-space: nowrap` on labels and badges where a line break looks broken.
7. **Tabular numbers on changing values.** Apply `font-variant-numeric: tabular-nums` to timers,
   counters, prices — any value that changes.
8. **Truncate without losing content.** Single line: `text-overflow: ellipsis` with
   `overflow: hidden` and `white-space: nowrap`. Multiple lines: `line-clamp`. If the missing text
   matters, keep the full value reachable in a tooltip or expanded view.
9. **Inputs at 16px on mobile.** iOS Safari zooms the whole page when an input's text is smaller than
   `16px`. Keep input text at `16px` on mobile viewports (`text-base sm:text-sm`). Avoid the
   `maximum-scale=1` viewport meta: Safari ignores it for pinch zoom, but every other browser honors
   it and blocks zooming, which fails WCAG.

## UI polish

Great interfaces rarely come from a single thing. It's usually a collection of small details that
compound into a great experience. This section assumes an animation belongs; deciding whether it
belongs at all, and what it costs the user at its trigger frequency, is a separate question worth
asking first — and the answer defaults to no.

1. **Concentric border radius.** Outer radius = inner radius + padding. → `references/surfaces.md`
2. **Optical over geometric alignment.** Buttons with icons, play triangles, and asymmetric icons
   need manual adjustment. → `references/surfaces.md`
3. **Shadows for elevation, borders for structure.** Layered transparent `box-shadow` for depth; keep
   borders that communicate structure or state. → `references/surfaces.md`
4. **Interruptible animations.** CSS transitions for interactive state changes; keyframes only for
   staged one-shot sequences. → `references/animations.md`
5. **Split and stagger enter animations.** Only for infrequent staged entrances; ~100ms between
   semantic chunks. Anything the user triggers often should not stagger. → `references/animations.md`
6. **Subtle exit animations.** Small fixed `translateY`, softer and shorter than the enter, `ease-out`
   both ways. → `references/animations.md`
7. **Contextual icon animations.** Exactly: scale `0.25`→`1`, opacity `0`→`1`, blur `4px`→`0px`;
   with a motion library `{ type: "spring", duration: 0.3, bounce: 0 }`; without one, CSS cross-fade
   with `cubic-bezier(0.2, 0, 0, 1)`. → `references/animations.md`
8. **Image outlines.** `1px` outline, pure black `oklch(0 0 0 / 0.1)` in light mode and pure white
   `oklch(1 0 0 / 0.1)` in dark mode — never a tinted neutral. → `references/surfaces.md`
9. **Scale on press.** Always `scale(0.96)`, never below `0.95`, with a `static` opt-out prop.
   → `references/animations.md`
10. **Skip animation on page load.** `initial={false}` on `AnimatePresence` for stateful toggles;
    verify it doesn't kill an intentional entrance. → `references/animations.md`
11. **Never `transition: all`.** Name the exact properties. → `references/performance.md`
12. **`will-change` sparingly.** Only `transform`, `opacity`, `filter`, only on observed first-frame
    stutter, never `all`. → `references/performance.md`
13. **Match icon stroke to text weight.** `1.5px` beside regular text, `2px` beside semibold; one icon
    set per surface. → `references/icons.md`
14. **One SVG, recolored per state.** `currentColor` plus CSS color/opacity; outline default, fill
    for active. → `references/icons.md`

| Mistake | Fix |
| --- | --- |
| Same border radius on closely nested parent and child | `outerRadius = innerRadius + padding` |
| Icons look off-center | Adjust optically with padding or fix the SVG directly |
| Border used only to fake elevation | Layered transparent `box-shadow`; keep structural and state borders |
| Jarring staged entrance or contextual exit | Stagger infrequent entrances; keep context-preserving exits subtle |
| Stateful icon or toggle animates its default state on page load | `initial={false}` on that `AnimatePresence`; preserve intentional entrances |
| `transition: all` | Specify exact properties |
| First-frame animation stutter | `will-change: transform` (sparingly) |
| Hairline icon beside bold text | Match stroke width to text weight |
| Separate icon assets per state | One `currentColor` SVG, states via CSS |
| Filled icons everywhere | Outline default, fill only for the active state |

## Review output format

Always use the following sections, in order.

### Scope and Coverage

State the mode, exact scope, stack and styling conventions, and any review boundary. Then show
coverage:

| Domain | Evidence inspected | Result |
| --- | --- | --- |
| Accessibility | Files, components, states, or checks | Findings count or `Clear` |

Include all five domains. `Clear` means inspected with no actionable finding; `Not reviewed` must
explain why.

### Findings

One table ordered by severity, then reach and leverage:

| # | Severity | Domain | Location | Before | After | Why |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | HIGH | Accessibility | `src/Dialog.tsx:42` | `<button><XIcon /></button>` | Add `aria-label="Close"` and hide the icon from the accessibility tree | The icon-only control has no accessible name |

Severity is one shared scale:

- `HIGH`: blocks a task, misleads the user, hides content or controls, causes data-loss risk, or
  creates a repeated systemic failure.
- `MEDIUM`: meaningfully harms comprehension, efficiency, adaptability, or consistency.
- `LOW`: isolated polish with limited task impact. Include only in `full` mode.

Within a severity, rank by reach and leverage. A token or shared-component fix outranks the same
symptom in one leaf component.

Each row is one root cause: list every confirmed location in the same row rather than producing a
row per occurrence. Respect the mode's finding cap, and never pad the report to reach it. If there
are no findings, omit the table and state "No actionable interface findings."

**Figma frames:** when the review target is a Figma frame and the file is editable, every row also
lands on the canvas as an annotation card. Follow `references/figma-annotation.md` exactly. This
needs a Figma tool that can write to the file (e.g. the Figma MCP's `use_figma`). If there is none,
the file is view-only, or the user asked for the report only, output the table alone and say the
frame was not annotated.

### Considered but Rejected

Record candidates considered but deliberately rejected. A candidate is rejected when the principle
permits the current implementation, evidence is insufficient, the project convention is intentional,
or the proposed change would add complexity without user benefit.

Include 1–3 candidates in `quick` mode and 2–5 in `full` mode:

| Location | Candidate | Rejected because |
| --- | --- | --- |
| `src/Card.tsx:28` | Increase the shadow | Existing depth matches the shared surface token; changing one card would reduce consistency |

These are real candidates inspected during the review, not invented filler. If the scope genuinely
contains fewer borderline candidates, include the ones that exist and say so.

### Verification

Run safe, relevant checks available in the project. Inspect the rendered interface when runtime
behavior or visual judgment matters. List each check or interaction, the exact command or steps, and
the observed result. Separate checks that passed from checks marked **Not verified**; never convert a
verification gap into a finding.

### Verdict

End with exactly one:

- `Block` — one or more `HIGH` findings remain.
- `Needs changes` — only `MEDIUM` or `LOW` findings remain.
- `Approve` — no actionable findings remain and the claimed coverage was verified.

## Common mistakes

| Mistake | Fix |
| --- | --- |
| `outline: none` to remove the focus ring | Style `:focus-visible` instead; mouse clicks won't show it |
| `<div onClick>` for a button or link | `<button>` for actions, `<a href>` for navigation |
| Placeholder used as the only label | Add a visible `<label for>`; placeholders disappear on input |
| Positive `tabindex` to fix focus order | Fix the DOM order; only use `0` and `-1` |
| `aria-hidden="true"` on a focusable element | Remove it or make the element non-focusable |
| Submit disabled until the form is valid | Keep it enabled; validate on submit and focus the first error |
| Separator line where spacing would do | Remove the line, double the gap between groups |
| `margin-left` / `padding-right` in a localizable layout | `margin-inline-start` / `padding-inline-end` |
| Breakpoints at 768/1024 because they're the defaults | Break where the content actually stops fitting |
| Fixed-width text container sized to one language | `max-width` + wrapping; test pseudo-localization and representative locales |
| `OK` / `Yes` confirming a destructive dialog | Repeat the consequence: "Delete project" |
| "Click here" or bare "Learn more" link | Describe the destination: "Read the billing docs" |
| "Oops! Something went wrong." | Say what to do, next to the failing field |
| "Save Changes" beside "Discard changes" | One capitalization policy per element type |
| Hard-coded one-off font sizes | Use the type scale |
| `line-height: 24px` on scalable text | Unitless value (`1.5`) |
| Full-width paragraphs | Cap around 60–75 characters per line |
| Numbers cause layout shift | `tabular-nums` |
| Truncated text with no way to read it | Tooltip or expanded view for the full value |
| Inputs below `16px` zoom on iOS | `text-base sm:text-sm` |
| Six disconnected domain reports | Consolidate into one ranked findings table |
| Visual claim inferred only from source | Inspect the rendered state or mark it not verified |
| Review silently edits code | Stay read-only unless implementation was requested |
| "Approve" with pending actionable findings | Use `Needs changes` or `Block` |
