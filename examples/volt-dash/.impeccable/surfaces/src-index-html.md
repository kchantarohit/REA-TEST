---
version: 1
slug: "src-index-html"
primary_target: "src/index.html"
related_targets: ["src/ui.js"]
---

# Surface: Volt Dash game shell (menus, HUD, overlays)

Mode: Experience (the game leads; menus are a quick stop between runs).
Audience: casual one-handed phone players, short sessions. Job: get back on the road fast, feel progress.
Constraints: offline single file, 360x780 to 412x915, targets >= 44px, safe areas, clean-room.

## Direction contract
THESIS: The night-shift courier's dispatch board. Menus are parcel labels, route tickets and rubber stamps stuck over the dusk highway; refuses the glossy neon mobile-game template and the commercial-runner layout (coin pill + key counter, tap-to-play over a character on tracks).
OWN-WORLD: Warm dusk plum ground (#160b24/#2a1540), cream label stock (#fff1dc) with ink (#26122f) text, signature neon kept as accents: courier pink #ff4f7b, route cyan #3ee6f0, sodium amber #ffc46b. Die-cut sticker borders, tape strips, ticket notches, stamps. Bricolage Grotesque condensed heavy for display, regular width for labels. Soft offset shadows, no glow halos, no gradient text.
STORY: The player sees their courier, who they are, today's route (stage, word hunt, best), and hits the road in two taps; between runs they kit up the crew and check jobs and trophies.
FIRST VIEWPORT: Wordmark band top-left as a sticker; a wallet stub (sparks + gems) and level badge top-right; the courier stands on the dusk highway centre-stage with a name tag plus a one-line quote; a "Today's route" ticket on the left edge; a full-width pink "Hit the road" button above a five-tab label nav.
FORM: pinned evolution of the incumbent world. seed: none (pinned) "Keep our core identity: the Volt Dash name, the dusk-city highway world and the stage themes... The neon/dusk palette stays as our signature, made warmer and more hand-crafted"; "tactile sticker/badge shapes, hand-drawn-feeling SVG icons, bold expressive display type, playful micro-copy". Roll ran degraded (seed:fbb31d75e889ecc2) and was overridden by the pin.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
