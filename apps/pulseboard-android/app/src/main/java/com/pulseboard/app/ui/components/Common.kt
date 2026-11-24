package com.pulseboard.app.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.ErrorOutline
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.pulseboard.app.data.DateRange
import com.pulseboard.app.ui.theme.PulseTheme
import com.pulseboard.app.ui.theme.tabular
import kotlin.math.abs

/** Side gutter used by every screen. */
val Gutter: Dp = 16.dp

@Composable
fun PulseCard(
    modifier: Modifier = Modifier,
    shape: Shape = RoundedCornerShape(4.dp),
    selected: Boolean = false,
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val scheme = MaterialTheme.colorScheme
    val card = PulseTheme.colors.card
    val color by animateColorAsState(
        targetValue = if (selected) scheme.primaryContainer.copy(alpha = 0.45f).compositeOver(card) else card,
        label = "cardColor",
    )
    val border = if (selected) {
        BorderStroke(2.dp, scheme.primary)
    } else {
        BorderStroke(1.dp, scheme.outlineVariant.copy(alpha = 0.7f))
    }
    if (onClick != null) {
        Surface(onClick = onClick, modifier = modifier, shape = shape, color = color, border = border) {
            Column(content = content)
        }
    } else {
        Surface(modifier = modifier, shape = shape, color = color, border = border) {
            Column(content = content)
        }
    }
}

/**
 * Change vs the previous period as a glyph + mono percentage. Neutral ink by default; the
 * notable direction (down unless [accentWhenUp]) uses the accent so it stands out.
 */
@Composable
fun DeltaBadge(deltaPercent: Double, modifier: Modifier = Modifier, accentWhenUp: Boolean = false, suffix: String = "") {
    val flat = abs(deltaPercent) < 0.05
    val up = deltaPercent > 0
    val notable = !flat && up == accentWhenUp
    val color = if (notable) PulseTheme.colors.accentText else MaterialTheme.colorScheme.onSurface
    val glyph = when {
        flat -> "\u2013"
        up -> "\u25B2"
        else -> "\u25BC"
    }
    val description = when {
        flat -> "No change"
        up -> "Up ${formatDelta(deltaPercent)}"
        else -> "Down ${formatDelta(deltaPercent)}"
    } + (if (suffix.isBlank()) " versus previous period" else " $suffix")
    Text(
        "$glyph ${formatDelta(deltaPercent)}" + (if (suffix.isBlank()) "" else " $suffix"),
        modifier = modifier.clearAndSetSemantics { contentDescription = description },
        style = MaterialTheme.typography.labelMedium.tabular(),
        color = color,
    )
}

/** Small uppercase, tracked section label. */
@Composable
fun Eyebrow(text: String, modifier: Modifier = Modifier, color: Color = MaterialTheme.colorScheme.onSurfaceVariant) {
    Text(text.uppercase(), modifier = modifier, style = MaterialTheme.typography.labelSmall, color = color, maxLines = 1)
}

/** 1px rule used to separate sections instead of boxes. */
@Composable
fun Hairline(modifier: Modifier = Modifier, color: Color = PulseTheme.colors.hairline) {
    HorizontalDivider(modifier = modifier, thickness = Dp.Hairline, color = color)
}

@Composable
fun DemoDataChip(modifier: Modifier = Modifier) {
    Text(
        "DEMO DATA",
        modifier = modifier
            .border(Dp.Hairline, MaterialTheme.colorScheme.outline, RoundedCornerShape(2.dp))
            .padding(horizontal = 6.dp, vertical = 3.dp)
            .clearAndSetSemantics { contentDescription = "Showing demo data" },
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScreenScaffold(
    title: String,
    onBack: (() -> Unit)? = null,
    actions: @Composable RowScope.() -> Unit = { DemoDataChip(Modifier.padding(end = 12.dp)) },
    content: @Composable (PaddingValues) -> Unit,
) {
    val scrollBehavior = TopAppBarDefaults.pinnedScrollBehavior()
    val scheme = MaterialTheme.colorScheme
    Scaffold(
        modifier = Modifier.nestedScroll(scrollBehavior.nestedScrollConnection),
        containerColor = scheme.background,
        // The app-level scaffold already accounts for the bottom bar and system insets.
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        topBar = {
            TopAppBar(
                title = { Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                navigationIcon = {
                    if (onBack != null) {
                        IconButton(onClick = onBack) {
                            Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Back")
                        }
                    }
                },
                actions = actions,
                scrollBehavior = scrollBehavior,
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = scheme.background,
                    scrolledContainerColor = scheme.surfaceContainer,
                ),
            )
        },
        content = content,
    )
}

@Composable
fun SectionLabel(text: String, modifier: Modifier = Modifier) {
    Text(
        text,
        modifier = modifier.padding(top = 8.dp, bottom = 0.dp),
        style = MaterialTheme.typography.titleSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

@Composable
fun ErrorCard(message: String, onRetry: () -> Unit, modifier: Modifier = Modifier) {
    PulseCard(modifier.fillMaxWidth()) {
        Row(Modifier.padding(start = 16.dp, end = 8.dp, top = 8.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Rounded.ErrorOutline, contentDescription = null, tint = MaterialTheme.colorScheme.error)
            Spacer(Modifier.width(12.dp))
            Text(message, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
            TextButton(onClick = onRetry) { Text("Retry") }
        }
    }
}

@Composable
fun SkeletonBlock(modifier: Modifier = Modifier, shape: Shape = RoundedCornerShape(12.dp)) {
    val transition = rememberInfiniteTransition(label = "shimmer")
    val x by transition.animateFloat(
        initialValue = -400f,
        targetValue = 1400f,
        animationSpec = infiniteRepeatable(tween(1300, easing = LinearEasing)),
        label = "shimmerX",
    )
    val base = MaterialTheme.colorScheme.surfaceVariant
    val brush = Brush.linearGradient(
        colors = listOf(base.copy(alpha = 0.55f), base.copy(alpha = 0.95f), base.copy(alpha = 0.55f)),
        start = Offset(x, 0f),
        end = Offset(x + 400f, 0f),
    )
    Box(modifier.clip(shape).background(brush).clearAndSetSemantics { contentDescription = "Loading" })
}

@Composable
fun LivePulseDot(modifier: Modifier = Modifier, color: Color = PulseTheme.colors.accent) {
    val transition = rememberInfiniteTransition(label = "pulse")
    val scale by transition.animateFloat(
        initialValue = 1f,
        targetValue = 2.6f,
        animationSpec = infiniteRepeatable(tween(1400, easing = FastOutSlowInEasing), RepeatMode.Restart),
        label = "pulseScale",
    )
    val alpha by transition.animateFloat(
        initialValue = 0.55f,
        targetValue = 0f,
        animationSpec = infiniteRepeatable(tween(1400, easing = LinearEasing), RepeatMode.Restart),
        label = "pulseAlpha",
    )
    Box(modifier.size(22.dp), contentAlignment = Alignment.Center) {
        Box(
            Modifier
                .size(9.dp)
                .graphicsLayer {
                    scaleX = scale
                    scaleY = scale
                    this.alpha = alpha
                }
                .background(color, CircleShape),
        )
        Box(Modifier.size(9.dp).background(color, CircleShape))
    }
}

/** 7 / 28 / 90 day segmented control. Tap a segment, or swipe sideways to step through ranges. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RangeSelector(selected: DateRange, onSelect: (DateRange) -> Unit, modifier: Modifier = Modifier) {
    val ranges = DateRange.entries
    val current by rememberUpdatedState(selected)
    val select by rememberUpdatedState(onSelect)
    var dragTotal by remember { mutableFloatStateOf(0f) }
    SingleChoiceSegmentedButtonRow(
        modifier = modifier
            .fillMaxWidth()
            .semantics { contentDescription = "Date range. Swipe left or right to change." }
            .pointerInput(Unit) {
                detectHorizontalDragGestures(
                    onDragStart = { dragTotal = 0f },
                    onDragEnd = {
                        val threshold = 48.dp.toPx()
                        val step = when {
                            dragTotal < -threshold -> 1
                            dragTotal > threshold -> -1
                            else -> 0
                        }
                        ranges.getOrNull(current.ordinal + step)?.let { if (it != current) select(it) }
                    },
                ) { change, dragAmount ->
                    change.consume()
                    dragTotal += dragAmount
                }
            },
    ) {
        ranges.forEachIndexed { index, range ->
            SegmentedButton(
                selected = range == selected,
                onClick = { onSelect(range) },
                shape = SegmentedButtonDefaults.itemShape(index = index, count = ranges.size),
                label = { Text(range.shortLabel) },
            )
        }
    }
}
