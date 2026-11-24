# Pulseboard (Android)

A glanceable web-analytics dashboard for Android, built with Kotlin, Jetpack Compose and Material 3.

- **Overview**: 7 / 28 / 90-day range (tap or swipe), Country / Device / Channel filters, KPI cards with
  change vs the previous period and sparklines; tap a KPI to chart it (solid = this period,
  dashed = previous) and drag across the chart to inspect a day.
- **Realtime**: active users in the last 30 minutes, users-per-minute bars, device split, top pages,
  countries and events. Values update every few seconds.
- **Reports**: Acquisition, Engagement, Retention, Tech & devices, Geography, each with a chart and a
  sortable table.
- **Settings**: theme (System / Light / Dark), demo property picker, about.

## Demo data

All numbers come from `DemoAnalyticsRepository`, which generates deterministic sample data on the
device. The app makes no network requests. A live source can be added by implementing
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
icons, colours or other assets were copied. Charts are drawn with Compose Canvas.
