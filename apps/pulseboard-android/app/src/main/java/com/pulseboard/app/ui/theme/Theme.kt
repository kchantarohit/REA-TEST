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

// Pulseboard palette: indigo-violet brand, teal for "up/live", coral for "down".
// Text colours are chosen for >= 4.5:1 contrast on their card/background colours.

private val LightColors = lightColorScheme(
    primary = Color(0xFF4F3FD1),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFE4E0FF),
    onPrimaryContainer = Color(0xFF1A0E6B),
    inversePrimary = Color(0xFFC3BCFF),
    secondary = Color(0xFF5C5A7A),
    onSecondary = Color(0xFFFFFFFF),
    secondaryContainer = Color(0xFFE3E0F7),
    onSecondaryContainer = Color(0xFF1B1A33),
    tertiary = Color(0xFF0B7A67),
    onTertiary = Color(0xFFFFFFFF),
    tertiaryContainer = Color(0xFFC8F1E9),
    onTertiaryContainer = Color(0xFF00382F),
    background = Color(0xFFF7F6FC),
    onBackground = Color(0xFF16151F),
    surface = Color(0xFFF7F6FC),
    onSurface = Color(0xFF16151F),
    surfaceVariant = Color(0xFFE6E4F0),
    onSurfaceVariant = Color(0xFF4A4858),
    surfaceTint = Color(0xFF4F3FD1),
    inverseSurface = Color(0xFF2B2A35),
    inverseOnSurface = Color(0xFFF3F1FA),
    error = Color(0xFFBA1A1A),
    onError = Color(0xFFFFFFFF),
    errorContainer = Color(0xFFFFDAD6),
    onErrorContainer = Color(0xFF410002),
    outline = Color(0xFF7A788A),
    outlineVariant = Color(0xFFD9D6E6),
    surfaceBright = Color(0xFFFFFFFF),
    surfaceDim = Color(0xFFDDDBE6),
    surfaceContainerLowest = Color(0xFFFFFFFF),
    surfaceContainerLow = Color(0xFFF2F0FA),
    surfaceContainer = Color(0xFFEDEBF6),
    surfaceContainerHigh = Color(0xFFE7E5F2),
    surfaceContainerHighest = Color(0xFFE1DEEE),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFFC3BCFF),
    onPrimary = Color(0xFF24168A),
    primaryContainer = Color(0xFF3A2CB5),
    onPrimaryContainer = Color(0xFFE4E0FF),
    inversePrimary = Color(0xFF4F3FD1),
    secondary = Color(0xFFC7C4DE),
    onSecondary = Color(0xFF302F45),
    secondaryContainer = Color(0xFF3A3852),
    onSecondaryContainer = Color(0xFFE3E0F7),
    tertiary = Color(0xFF5ED8C2),
    onTertiary = Color(0xFF00382F),
    tertiaryContainer = Color(0xFF005246),
    onTertiaryContainer = Color(0xFFC8F1E9),
    background = Color(0xFF0E0D15),
    onBackground = Color(0xFFE7E5F0),
    surface = Color(0xFF0E0D15),
    onSurface = Color(0xFFE7E5F0),
    surfaceVariant = Color(0xFF2A2838),
    onSurfaceVariant = Color(0xFFC9C6D8),
    surfaceTint = Color(0xFFC3BCFF),
    inverseSurface = Color(0xFFE7E5F0),
    inverseOnSurface = Color(0xFF2B2A35),
    error = Color(0xFFFFB4AB),
    onError = Color(0xFF690005),
    errorContainer = Color(0xFF93000A),
    onErrorContainer = Color(0xFFFFDAD6),
    outline = Color(0xFF928FA3),
    outlineVariant = Color(0xFF34324A),
    surfaceBright = Color(0xFF2E2D3B),
    surfaceDim = Color(0xFF0E0D15),
    surfaceContainerLowest = Color(0xFF0A0910),
    surfaceContainerLow = Color(0xFF17161F),
    surfaceContainer = Color(0xFF1B1A25),
    surfaceContainerHigh = Color(0xFF242331),
    surfaceContainerHighest = Color(0xFF2E2D3B),
)

/** Colours outside the Material scheme: semantic deltas, card fill and chart series. */
@Immutable
data class PulseColors(
    val up: Color,
    val down: Color,
    val live: Color,
    val card: Color,
    val series: List<Color>,
)

private val LightPulse = PulseColors(
    up = Color(0xFF0B7A67),
    down = Color(0xFFC23B22),
    live = Color(0xFF14A38B),
    card = Color(0xFFFFFFFF),
    series = listOf(Color(0xFF4F3FD1), Color(0xFF14A38B), Color(0xFFF07158), Color(0xFFE0A100), Color(0xFF8A7CF0)),
)

private val DarkPulse = PulseColors(
    up = Color(0xFF5ED8C2),
    down = Color(0xFFFF8F7A),
    live = Color(0xFF5ED8C2),
    card = Color(0xFF17161F),
    series = listOf(Color(0xFFA99CFF), Color(0xFF4FD1B5), Color(0xFFFF8A73), Color(0xFFF2C14E), Color(0xFF7D70D9)),
)

private val LocalPulseColors = staticCompositionLocalOf { LightPulse }

object PulseTheme {
    val colors: PulseColors
        @Composable
        @ReadOnlyComposable
        get() = LocalPulseColors.current
}

private val BaseType = Typography()

private val PulseTypography = BaseType.copy(
    displayMedium = BaseType.displayMedium.copy(fontWeight = FontWeight.SemiBold, letterSpacing = (-0.5).sp),
    displaySmall = BaseType.displaySmall.copy(fontWeight = FontWeight.SemiBold, letterSpacing = (-0.25).sp),
    headlineSmall = BaseType.headlineSmall.copy(fontWeight = FontWeight.SemiBold),
    titleLarge = BaseType.titleLarge.copy(fontWeight = FontWeight.SemiBold),
    titleMedium = BaseType.titleMedium.copy(fontWeight = FontWeight.SemiBold),
    labelLarge = BaseType.labelLarge.copy(fontWeight = FontWeight.Medium),
)

private val PulseShapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(16.dp),
    large = RoundedCornerShape(24.dp),
    extraLarge = RoundedCornerShape(28.dp),
)

/** Monospaced digits so live numbers do not jitter as they change. */
fun TextStyle.tabular(): TextStyle = copy(fontFeatureSettings = "tnum")

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
