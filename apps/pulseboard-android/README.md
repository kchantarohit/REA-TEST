# Pulseboard (Android)

A glanceable web-analytics dashboard for Android, built with Kotlin, Jetpack Compose and Material 3.

- **Realtime** (start screen, built for live launch monitoring): huge mono active-user count with a
  live indicator and change vs the pre-launch baseline (or the 30-minute average before a launch is
  marked); **Mark launch** shows T+mm:ss since launch and survives restarts; users-per-minute bars
  with automatic ▲ spike / ▼ drop markers (more than 2σ from the 10-minute rolling mean); a
  threshold alert that flashes the hero and vibrates once when active users cross it; device split
  as one stacked bar; ruled top-pages and top-countries tables; a live event feed.
- **Overview**: 7 / 28 / 90-day range (tap or swipe), Country / Device / Channel filters, KPI cards with
  change vs the previous period; tap a KPI to chart it and drag across the chart to inspect a day.
- **Reports**: Acquisition, Engagement, Retention, Tech & devices, Geography, each with a chart and a
  sortable table.
- **Settings**: theme (System / Light / Dark), demo property picker, about.

## Design

Swiss, utilitarian system: near-black ink on warm off-white paper (inverted in dark mode), neutral
greys, one signal orange-red accent (`#FF3B1F`; `#C42A10` for accent text on light backgrounds so
it passes 4.5:1). Direction is shown with ▲/▼ glyphs. Realtime uses hairline rules and whitespace
instead of cards. Words are set in Inter Tight; every number is set in JetBrains Mono with tabular
figures so live counters don't jitter.

## Fonts and licenses

Both fonts are licensed under the SIL Open Font License 1.1 and are bundled in `app/src/main/res/font`
(Inter Tight 400/500/600, JetBrains Mono 400/500). The static TTF files were taken unmodified from
the npm packages `@expo-google-fonts/inter-tight@0.4.2` and `@expo-google-fonts/jetbrains-mono@0.4.1`.
License texts: `app/src/main/assets/licenses/InterTight-OFL.txt` and `JetBrainsMono-OFL.txt`.

## Demo data

All numbers come from `DemoAnalyticsRepository`, which generates deterministic sample data on the
device. The app makes no network requests. On the Realtime screen one demo "minute" passes every
3 seconds, and the generator adds occasional surges, spikes and drops so the markers and alerts
can be seen working. A live source can be added by implementing
`data/AnalyticsRepository` and wiring it in `AppContainer`.

## Build

Requires JDK 17 and the Android SDK (compileSdk 35).

```sh
./gradlew assembleDebug
# APK: app/build/outputs/apk/debug/app-debug.apk
./gradlew testDebugUnitTest   # data-layer unit tests
```

CI (`.github/workflows/pulseboard-apk.yml`) builds the debug APK on every push to the working branch
and publishes it as `Pulseboard-debug.apk` on a GitHub prerelease.

Versions: AGP 8.7.3, Gradle 8.10.2, Kotlin 2.0.21, Compose BOM 2024.12.01, minSdk 26, targetSdk 35.

## Clean-room note

Pulseboard is an original implementation. Layout ideas were taken only at the level of common
analytics concepts (realtime counts, KPI comparisons, reports). No third-party code, branding, names,
icons, colours or other assets were copied. The bundled fonts are open-source (OFL), credited above. Charts are drawn with Compose Canvas.
