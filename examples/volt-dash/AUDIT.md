# Volt Dash UI audit (impeccable `/audit` + critique pass)

Target: the v2.0 menus, HUD and overlays (`src/index.html`, `src/ui.js`, `src/icons.js`), judged from `out/screens-v2/*.png` (390x844, 360x780, 412x915) and the detector.

How it ran: `impeccable context` loaded fine (no PRODUCT.md or DESIGN.md existed, so PRODUCT.md was written from the brief and marked as inferred). `impeccable detect --json` ran over the three UI files. The concept roll ran degraded (its roll service is unreachable from this sandbox), and the coordinator pinned the direction anyway: keep Volt Dash's dusk-city identity and stage themes, and evolve them. This was a subagent run with no question tool, so no decision page was served; that substitution is noted here.

## Audit health score (v2)

| # | Dimension | Score | Key finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 2 | The global `prefers-reduced-motion` kill sets every animation to 0.01ms and drops the feedback (coin fly, pop-ins); `--dim` (#8b7fbd) labels on the #120a33 nav are about 4.3:1 at 11px |
| 2 | Performance | 3 | Sound overall. All 5 prop styles are built per chunk (25 groups), and snow, sparks and stars update on the CPU every frame even on Low (Low only trims their counts) |
| 3 | Theming | 2 | Tokens exist, but ui.js and main.js hard-code about 25 hex values (ITEM_COLORS, toast colours, a `#ff4a5e` error red repeated 4 times) |
| 4 | Responsive | 3 | Targets are 44px or more, but at 360x780 the logo collides with the Daily button and the NEON COURIER RUN line runs into the scene; toasts cover page titles |
| 5 | Implementation integrity | 1 | Interchangeable with any neon mobile-game template: gradient text, glossy candy buttons, glow halos, robot cast |
| **Total** | | **11/20** | **Acceptable (significant work needed)** |

**Implementation integrity verdict: FAIL.** Nothing on screen belongs only to this game. The detector found 11 issues: gradient text on the logo; 5 glow halos (zero-offset `#45f3ff` text-shadows on the score and results, `#ffbe32` / `#ff961e` glows on PLAY and gold buttons); a radial-gradient halo on tiles; a 7px inset "side-tab" stripe on PLAY; and 4 bounce easings. Hard zero-blur offset shadows (`0 4px 0 #a8480a`) are a costume the world never chose. Every character is a robot or a sprite, so the menus have no people in them.

## Findings by severity

### P1 (major)
1. **Generic neon template identity.** Location: `index.html` `.logo` (gradient text + drop-shadow glow), `.btn.gold` and `.play-btn` (glossy gradient, glow), `.hud-score b` (cyan halo). Impact: it reads as an AI starter kit, not a studio game. Fix: solid-ink wordmark, sticker and label material, offset soft shadows. Command: `/impeccable bolder`, then `/impeccable colorize`.
2. **System font as the display voice.** Location: `--font: system-ui...` for every heading, the logo and the HUD score. Impact: no character; Roboto on Android. Fix: bundle an OFL display face locally (Bricolage Grotesque, wdth/wght variable) and use its condensed heavy cuts for display. Command: `/impeccable typeset`.
3. **Toasts cover the page title and top content.** Location: `.toasts { top: calc(var(--pad-t) + 64px) }`. Evidence: `04-characters.png` and `05-missions.png` show "Char..." and "Miss..." cut off by two stacked toasts. Fix: anchor toasts to the bottom above the nav, cap them at 2, and make them shorter. Command: `/impeccable layout`.
4. **The cast contradicts the product.** Six robots and sprites (`characters.js`), robot avatar glyph `ICONS.chars`, "Courier Bot", "Pocket Cube Bot". Fix: a human courier crew with names, bios and perks. Command: `/impeccable delight`.
5. **Reduced motion destroys feedback.** `@media (prefers-reduced-motion) { *{animation-duration:.01ms!important} }` freezes the sheet slide, the revive ring countdown (which then reads as empty), the coin fly and the pop-ins. Fix: stop only the looping and decorative motion (breathe, pulse, nudge) and keep short fades and state changes. Command: `/impeccable animate`.

### P2 (minor)
6. **Small-phone collisions.** At 360x780 the logo overlaps the Daily button column and the subtitle sits on busy buildings (`15-home-360x780.png`). Fix: a dedicated home layout with the logo in its own band. Command: `/impeccable adapt`.
7. **Unicode and text standing in for icons.** `.day.got::after { content: "\2713" }`, the `x2` icon is an SVG `<text>`, the mystery box draws a "?" glyph, and the arrow `&#9654;` sits in stat lines. Fix: drawn SVG glyphs in one stroke style. Command: `/impeccable polish`.
8. **Low-contrast floating chips over the 3D scene.** "Score x 3.4" and the best-score chip sit on 72%-opaque pills over bright windows, and the 10px side-button labels sit on busy backgrounds. Fix: opaque label stock with ink text. Command: `/impeccable layout`.
9. **Naming drift.** The nav says "Heroes", the page says "Characters", the copy says "Courier Bot", and the home side button says "Goals" while its page says "Missions". Fix: one vocabulary (Crew, Jobs, Trophies). Command: `/impeccable clarify`.
10. **Hard-coded colours outside tokens.** About 25 literals in ui.js and main.js toasts. Fix: route them through CSS custom properties and named roles. Command: `/impeccable extract`.
11. **Every red badge pulses forever.** All four nav badges `pulse` at once (`01-home.png`), so nothing stands out. Fix: a static badge, with motion only when a badge first appears. Command: `/impeccable quieter`.

### P3 (polish)
12. Browser surfaces were left at their defaults: the focus ring is plain white, and the selection and scrollbar are untouched. Fix: theme the focus ring from the palette.

## Patterns
- Glow and gloss were used as the depth system across buttons, chips, HUD and logo.
- Robots everywhere: avatar glyph, characters, copy and the currency name ("Cells").
- Toasts, chips and pills float over the live 3D scene without a ground of their own.

## Positive findings (keep)
- Touch targets are 44px or more throughout, safe-area insets are respected, and the Back routing is complete.
- The delegated `data-act` architecture and the save sanitizer are solid foundations.
- The revive countdown ring and the count-up results are good game feel.

## Recommended actions
1. [P1] `/impeccable bolder`: replace the neon template with Volt Dash's own dusk courier world.
2. [P1] `/impeccable typeset`: a bundled display face.
3. [P1] `/impeccable layout`: toast placement and the home composition.
4. [P1] `/impeccable animate`: a reduced-motion alternative that keeps feedback.
5. [P2] `/impeccable clarify`, `/impeccable adapt`, `/impeccable polish`.

---

## After (v3.0 re-audit of the shipped build)

Evidence: `out/screens-v3/*.png` (46 captures at 390x844, 360x780 and 412x915, zero console errors), `impeccable detect --json` over the v3 UI files, and an automated check that every visible button is at least 44px at 360x780 and 412x915. The finish review ran in-thread from `reference/degraded/finish-reviewer.md` because this subagent has no subagent tool.

| # | Dimension | v2 | v3 | What changed |
|---|-----------|----|----|--------------|
| 1 | Accessibility | 2 | 3 | Ink (#26122f) on cream (#fff1dc) is about 14:1; dusk-panel labels (#b59fc6 on #140a22) are about 8:1. Reduced motion now stops only loops, travel and bounces; fades and state changes stay. Focus ring is a dashed cyan outline. Toasts sit in an `aria-live` region. The 3D run itself stays visual-only |
| 2 | Performance | 3 | 3 | People share 9 unit geometries with about 11 materials each, and only one courier renders in a run. Clank renders only while he is within 14 m. Low graphics trims snow, sparks, stars, rain and Clank's steam |
| 3 | Theming | 2 | 3 | One token set (`--night/--dusk/--plum`, `--cream/--ink`, `--pink/--cyan/--amber`) drives every screen; toasts use named tones instead of hex. A few sticker tile colours remain as a JS table |
| 4 | Responsive | 3 | 4 | Home is a dedicated grid (wordmark, Today ticket, name tag, road button), so nothing collides at 360x780. Toasts sit on the nav strip, not on titles. The 44px check passes at both sizes |
| 5 | Implementation integrity | 1 | 3 | The detector went from 11 findings to 1. The one left is the red danger vignette, which the brief asks for: a deliberate warning effect, not decoration |
| **Total** | | **11/20** | **16/20** | **Good** |

### How each top finding was fixed
1. **Neon template identity (P1).** Replaced with a night-shift courier world: cream parcel-label cards and ticket stubs, rubber-stamp counters, tape strips, die-cut sticker buttons with cream edges and soft offset shadows. Gradient text, glow halos, glossy candy buttons and bounce easings are all gone; motion uses one expo-out curve.
2. **System display font (P1).** Bricolage Grotesque (SIL OFL 1.1, `src/fonts/`) is bundled and inlined as a data URI at build time, so the APK never touches the network. Condensed heavy cuts set display type; regular width sets labels.
3. **Toasts over titles (P1).** Toasts are anchored at the bottom over the nav strip, capped at 2, and let taps through.
4. **Robot cast (P1).** Six human couriers, each with a name, a one-line voice and a perk. The avatar is a drawn portrait of the courier on shift. The copy speaks in their language ("Hit the road", "End shift", "Call it a night").
5. **Reduced motion (P1).** A targeted alternative replaces the 0.01ms kill switch (see the Accessibility row).
6. **Small-phone collisions (P2).** Covered by the new home grid (see the Responsive row).
7. **Glyph icons (P2).** A new hand-drawn SVG set (46 icons, one marker-pen stroke voice). There are no Unicode checks, no `<text>` icons and no "?" glyph.
8. **Floating low-contrast chips (P2).** Every chip over the 3D scene sits on an opaque night or cream ground.
9. **Naming drift (P2).** One vocabulary everywhere: Crew, Jobs, Trophies, Supplies, Sparks.
10. **Everything pulsing (P2).** Badges are static dots; the one looping motion is the arrow nudge on the road button.

### Distinct identity (v3 versus the commercial runner the user named)
- **Kept and evolved Volt Dash's own world.** Same name; same dusk-city highway; the same five stages (Neon City, Sunset Canyon, Frost Line, Storm Foundry, Cosmic Skyway) with weather added: night lights, sunset, snow, rain with lightning, stars. The neon pink, cyan and dusk palette is still the signature, now warmed with cream label stock and amber.
- **Cast.** Couriers and messengers with realistic proportions: a small head, about 1/6 of the body height, so no big-head chibi style. A broad mix of looks, including a retired postman and a parkour courier in a sport head wrap. No kid in a cap with spray paint, and nothing graffiti or street-tag anywhere.
- **Wordmark and type.** A cream and pink condensed grotesque with a hand-drawn bolt, set at a slight tilt. No yellow or orange bubble lettering.
- **Layout.** One wallet ticket instead of separate coin and key pills. A "Today" ticket (word hunt, daily drop, jobs) beside a courier name tag. The action is "Hit the road", never "tap to play". No hoverboard slot: the consumable is our own Kick Scooter, and it lives in the loadout sheet.
- **Chaser.** Clank, a rusty municipal street-sweeper mech (gutter brushes, roller broom, headlight eyes, beacon, steam stack, stencilled C-14 plate). No inspector, guard or police, and no dog.

### Remaining (honest)
- The finish review was a degraded in-thread pass, not the shipped reviewer agent. The disposition was `fix` (minor): faces are readable but low-poly and small in the run camera; the outfit swatches are conic-gradient discs rather than drawn garments.
- The screenshots come from desktop Chromium with SwiftShader. No real Android WebView or device was tested, so frame rate on mid-range phones is untested.
