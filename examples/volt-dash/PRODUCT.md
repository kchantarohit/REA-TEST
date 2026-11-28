# Product

<!-- impeccable:product-schema 1 -->

> Inferred from the v3 brief by a subagent (no interview round was possible); every fact below comes from that brief or the existing code. Treat as confirmed-by-brief, not confirmed-by-interview.

## Platform

web

(An offline HTML/WebGL game packaged in a fullscreen Android WebView shell, `com.reatest.voltdash`, portrait only. The design language is the game's own, not Material.)

## Users

Casual mobile players on mid-range Android phones (360x780 to 412x915 viewports), playing one-handed in short sessions: a commute, a queue, a couch. They swipe to steer and tap through menus between runs.

## Product Purpose

Volt Dash is an original 3-lane endless runner. Success is "one more run": a run starts in two taps, every crash teaches something, and the meta loop (upgrades, characters, missions, daily rewards, challenges) gives a reason to come back tomorrow.

## Positioning

A street-level city adventure starring a crew of six human runners, chased by Clank, a runaway street-sweeper mech. Generic genre mechanics only; every character, the chaser, the icons, the audio and the stages are original.

## Operating Context

- Fully offline: no network, no fonts or assets fetched at runtime; everything ships inside one index.html.
- Android hardware Back is routed through `window.__onBack` (sheet, pause, results, tab, exit).
- Saves live in localStorage and must migrate v1 -> v2 -> v3 without losing currencies, upgrades, items, owned characters, missions or best score.

## Capabilities and Constraints

- Three.js 0.170 scene; characters and the chaser are built from primitives (no model files).
- Low graphics setting must cut particles and weather.
- Tap targets >= 44px, safe-area insets respected, readable at 360x780.
- Clean-room: no names, characters, art, music, logos, UI trade dress or themes from any commercial runner (no trains/subway, no inspector/guard/police + dog, no graffiti-tag theme, no hoverboards, no "keys").

## Brand Commitments

- Name: "Volt Dash" (kept). Brief-pinned feel: warm, hand-crafted, characterful, a real studio's street-culture/adventure runner; tactile sticker/badge shapes, hand-drawn-feeling SVG icons, bold expressive display type, playful micro-copy, juicy animation, personality on every screen; menus themed around people and the city, not robots or neon cells.
- Explicit anti-reference: generic neon AI-template UI (the v2 look).

## Evidence on Hand

No real players, reviews, store listings or metrics exist. Never fabricate player counts, ratings or testimonials.

## Product Principles

1. Two taps to running; nothing blocks the play button.
2. Every failure names its cause and the fix.
3. Characters are people with a voice; copy sounds like them, not like a system.
4. Progress is never lost across versions.

## Accessibility & Inclusion

Diverse cast (genders, skin tones, styles). Respect prefers-reduced-motion with a calmer alternative, not a dead UI. Contrast AA on all text.
