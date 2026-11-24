package com.pulseboard.app.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// Swiss utilitarian system: neutral ink on warm paper, one signal accent.
// Contrast (text on background): light ink 18:1, muted #595955 6.4:1, accent text #C42A10 5.2:1;
// dark ink 16:1, muted #A3A29D 7.6:1, accent #FF3B1F 5.4:1. Ink on accent fill 5.4:1.

private val Paper = Color(0xFFF4F3EF)
private val Ink = Color(0xFF0B0B0B)
private val Signal = Color(0xFFFF3B1F)
private val SignalDeep = Color(0xFFC42A10)

private val LightColors = lightColorScheme(
    primary = SignalDeep,
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFFCE3DC),
    onPrimaryContainer = Color(0xFF5A1406),
    inversePrimary = Signal,
    secondary = Color(0xFF3A3A37),
    onSecondary = Color(0xFFFFFFFF),
    secondaryContainer = Color(0xFFE3E2DC),
    onSecondaryContainer = Color(0xFF1A1A18),
    tertiary = Color(0xFF3A3A37),
    onTertiary = Color(0xFFFFFFFF),
    tertiaryContainer = Color(0xFFE3E2DC),
    onTertiaryContainer = Color(0xFF1A1A18),
    background = Paper,
    onBackground = Ink,
    surface = Paper,
    onSurface = Ink,
    surfaceVariant = Color(0xFFE6E5E0),
    onSurfaceVariant = Color(0xFF595955),
    surfaceTint = Color(0xFF595955),
    inverseSurface = Color(0xFF1C1C1A),
    inverseOnSurface = Paper,
    error = Color(0xFFB3261E),
    onError = Color(0xFFFFFFFF),
    errorContainer = Color(0xFFF9DEDC),
    onErrorContainer = Color(0xFF410E0B),
    outline = Color(0xFF8A8984),
    outlineVariant = Color(0xFFD6D5CF),
    scrim = Color(0xFF000000),
    surfaceBright = Color(0xFFFAF9F6),
    surfaceDim = Color(0xFFDCDBD6),
    surfaceContainerLowest = Color(0xFFFFFFFF),
    surfaceContainerLow = Color(0xFFEFEEE9),
    surfaceContainer = Color(0xFFEAE9E4),
    surfaceContainerHigh = Color(0xFFE4E3DE),
    surfaceContainerHighest = Color(0xFFDEDDD8),
)

private val DarkColors = darkColorScheme(
    primary = Signal,
    onPrimary = Ink,
    primaryContainer = Color(0xFF4A1408),
    onPrimaryContainer = Color(0xFFFFD9CF),
    inversePrimary = SignalDeep,
    secondary = Color(0xFFC9C8C3),
    onSecondary = Color(0xFF1A1A18),
    secondaryContainer = Color(0xFF2E2E2B),
    onSecondaryContainer = Color(0xFFEDECE8),
    tertiary = Color(0xFFC9C8C3),
    onTertiary = Color(0xFF1A1A18),
    tertiaryContainer = Color(0xFF2E2E2B),
    onTertiaryContainer = Color(0xFFEDECE8),
    background = Ink,
    onBackground = Color(0xFFEDECE8),
    surface = Ink,
    onSurface = Color(0xFFEDECE8),
    surfaceVariant = Color(0xFF222220),
    onSurfaceVariant = Color(0xFFA3A29D),
    surfaceTint = Color(0xFFA3A29D),
    inverseSurface = Color(0xFFEDECE8),
    inverseOnSurface = Color(0xFF1A1A18),
    error = Color(0xFFF2B8B5),
    onError = Color(0xFF601410),
    errorContainer = Color(0xFF8C1D18),
    onErrorContainer = Color(0xFFF9DEDC),
    outline = Color(0xFF6E6D69),
    outlineVariant = Color(0xFF2A2A28),
    scrim = Color(0xFF000000),
    surfaceBright = Color(0xFF2A2A28),
    surfaceDim = Ink,
    surfaceContainerLowest = Color(0xFF070707),
    surfaceContainerLow = Color(0xFF141413),
    surfaceContainer = Color(0xFF181817),
    surfaceContainerHigh = Color(0xFF1F1F1D),
    surfaceContainerHighest = Color(0xFF262624),
)

/** Colours outside the Material scheme. */
@Immutable
data class PulseColors(
    /** Signal fill for bars, markers, flashes (not for small text on paper). */
    val accent: Color,
    /** Accent safe for text on the background (>= 4.5:1). */
    val accentText: Color,
    /** Text colour on top of an [accent] fill. */
    val onAccent: Color,
    val ink: Color,
    val muted: Color,
    val hairline: Color,
    val card: Color,
    /** Three neutral steps for categorical splits (strong, mid, light). */
    val neutrals: List<Color>,
)

private val LightPulse = PulseColors(
    accent = Signal,
    accentText = SignalDeep,
    onAccent = Ink,
    ink = Ink,
    muted = Color(0xFF595955),
    hairline = Color(0xFFD6D5CF),
    card = Color(0xFFFBFAF7),
    neutrals = listOf(Ink, Color(0xFF6F6E69), Color(0xFFA8A7A1)),
)

private val DarkPulse = PulseColors(
    accent = Signal,
    accentText = Signal,
    onAccent = Ink,
    ink = Color(0xFFEDECE8),
    muted = Color(0xFFA3A29D),
    hairline = Color(0xFF2A2A28),
    card = Color(0xFF141413),
    neutrals = listOf(Color(0xFFEDECE8), Color(0xFF8C8B86), Color(0xFF4F4E4A)),
)

private val LocalPulseColors = staticCompositionLocalOf { LightPulse }

object PulseTheme {
    val colors: PulseColors
        @Composable
        @ReadOnlyComposable
        get() = LocalPulseColors.current
}

private fun inter(weight: FontWeight, size: Int, line: Int, tracking: Double = 0.0) = TextStyle(
    fontFamily = InterTight,
    fontWeight = weight,
    fontSize = size.sp,
    lineHeight = line.sp,
    letterSpacing = tracking.sp,
)

// Few weights (400/500/600), tight tracking on large sizes, wide tracking on the small caps labels.
private val PulseTypography = Typography(
    displayLarge = inter(FontWeight.Medium, 57, 60, -1.5),
    displayMedium = inter(FontWeight.Medium, 45, 48, -1.0),
    displaySmall = inter(FontWeight.Medium, 36, 40, -0.75),
    headlineLarge = inter(FontWeight.SemiBold, 32, 36, -0.75),
    headlineMedium = inter(FontWeight.SemiBold, 28, 32, -0.5),
    headlineSmall = inter(FontWeight.SemiBold, 24, 28, -0.4),
    titleLarge = inter(FontWeight.SemiBold, 20, 24, -0.2),
    titleMedium = inter(FontWeight.Medium, 16, 22),
    titleSmall = inter(FontWeight.Medium, 14, 20),
    bodyLarge = inter(FontWeight.Normal, 16, 24),
    bodyMedium = inter(FontWeight.Normal, 14, 20),
    bodySmall = inter(FontWeight.Normal, 12, 16, 0.1),
    labelLarge = inter(FontWeight.Medium, 14, 20, 0.1),
    labelMedium = inter(FontWeight.Medium, 12, 16, 0.4),
    labelSmall = inter(FontWeight.Medium, 11, 14, 1.2),
)

/** Huge monospaced hero number. */
val HeroNumberStyle = TextStyle(
    fontFamily = JetBrainsMono,
    fontWeight = FontWeight.Medium,
    fontSize = 84.sp,
    lineHeight = 88.sp,
    letterSpacing = (-3).sp,
    fontFeatureSettings = "tnum",
)

private val PulseShapes = Shapes(
    extraSmall = RoundedCornerShape(2.dp),
    small = RoundedCornerShape(2.dp),
    medium = RoundedCornerShape(4.dp),
    large = RoundedCornerShape(4.dp),
    extraLarge = RoundedCornerShape(8.dp),
)

/** All numbers render in JetBrains Mono with tabular figures so live values do not jitter. */
fun TextStyle.tabular(): TextStyle = copy(fontFamily = JetBrainsMono, fontFeatureSettings = "tnum")

@Composable
fun PulseboardTheme(darkTheme: Boolean, content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalPulseColors provides if (darkTheme) DarkPulse else LightPulse) {
        MaterialTheme(
            colorScheme = if (darkTheme) DarkColors else LightColors,
            typography = PulseTypography,
            shapes = PulseShapes,
            content = content,
        )
    }
}
