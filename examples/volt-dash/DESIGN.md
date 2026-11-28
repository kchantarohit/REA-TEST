# Volt Dash design system (v3, "night-shift dispatch board")

Built world, documented after the v3 build. Source of truth: `src/index.html` tokens and components.

## Scene
A courier checks their kit between runs on a phone held in one hand, often at night, on a bus or a couch. So the ground is dark (dusk plum) and the information sits on bright cream labels that read at a glance.

## Colour tokens
| Token | Value | Role |
|---|---|---|
| `--night` | #140a22 | deepest ground, nav strip, chips over 3D |
| `--dusk` | #22113a | list-page ground, sheets |
| `--plum` / `--plum-2` / `--plum-3` | #321a4b / #43235f / #57307a | panels, locked trophies, neutral buttons |
| `--cream` | #fff1dc | label stock (cards, stickers, modals, active tab) |
| `--paper-line` | #ead2b0 | dashed rules, empty bars on cream |
| `--ink` / `--ink-2` / `--ink-3` | #26122f / #5b3c63 / #8a6a86 | text on cream |
| `--text` / `--text-2` / `--text-3` | #fff6ea / #dcc8e8 / #b59fc6 | text on dusk |
| `--pink` (+`--pink-d` #b8274f) | #ff4f7b | the one primary action ("Hit the road", Run again), letter stickers |
| `--cyan` | #3ee6f0 | route accent, focus ring, stage progress |
| `--amber` | #ffc46b | stamps, level badge, multiplier, buy buttons |
| `--green` / `--red` | #5be3a1 / #ff5a5f | ok and claim, danger and Clank warnings |
| `--spark` / `--gem` | #ffd84a / #ff5fc8 | currencies (drawn inside their icons) |

## Type
Bricolage Grotesque (OFL, bundled). Display: weight 800, `font-stretch: 75%`, tracking -0.01 to -0.02em, sizes 30-64px. UI and body: weight 600-700, `font-stretch: 92%`, 12-17px. Numbers use tabular numerals.

## Components
- **Label card**: cream, radius 18px, `--shadow-1` (0 4px 10px -2px). Holds list rows, the crew card, jobs and the logbook.
- **Sticker button**: solid fill plus a 2.5px cream die-cut edge plus a soft shadow; pressing moves it down 2px. Variants: go (pink), ok (green), buy (amber), ghost, poor.
- **Ticket**: cream with punched side notches (radial-gradient mask): the wallet and the Today card (with a tape strip).
- **Stamp**: outlined uppercase condensed label, rotated -4deg, with an amber outline on night (hire count, trophy count) or green on cream ("Earned", "Maxed").
- **Tilt**: stickers, badges and toasts sit 1-3deg off true; list rows stay straight for scanning.
- **Icons**: 24px hand-drawn SVG, 2.3px round strokes in `currentColor`, slightly off-true paths.
- **Motion**: one ease, `cubic-bezier(.16,1,.3,1)`. Combo pops, stage banners, Clank warnings and the "Swept up!" stamp are the authored moments. Reduced motion swaps these for fades.

## Bans kept
No gradient text, no zero-offset glow halos, no glossy bevel buttons, no hard offset shadows, no glyph icons. The red danger vignette is the one intentional coloured inset, and it is functional.
