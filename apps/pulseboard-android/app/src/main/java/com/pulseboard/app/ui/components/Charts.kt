package com.pulseboard.app.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.pulseboard.app.data.LabeledValue
import com.pulseboard.app.data.ValueFormat
import com.pulseboard.app.ui.theme.PulseTheme
import com.pulseboard.app.ui.theme.tabular
import java.util.Locale
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/** Smooth curve through [points] using horizontal-midpoint cubic segments (no overshoot in x). */
private fun smoothPath(points: List<Offset>): Path = Path().apply {
    if (points.isEmpty()) return@apply
    moveTo(points[0].x, points[0].y)
    for (i in 1 until points.size) {
        val p0 = points[i - 1]
        val p1 = points[i]
        val midX = (p0.x + p1.x) / 2f
        cubicTo(midX, p0.y, midX, p1.y, p1.x, p1.y)
    }
}

fun formatShare(value: Double, total: Double): String =
    String.format(Locale.getDefault(), "%.0f%%", if (total <= 0.0) 0.0 else value / total * 100.0)

/** Tiny decorative trend line; callers describe the data in text, so it is hidden from accessibility. */
@Composable
fun Sparkline(values: List<Float>, color: Color, modifier: Modifier = Modifier) {
    Canvas(modifier.clearAndSetSemantics { }) {
        if (values.size < 2) return@Canvas
        val lo = values.min()
        val span = (values.max() - lo).takeIf { it > 0f } ?: 1f
        val pad = 2.dp.toPx()
        val points = values.mapIndexed { i, v ->
            Offset(size.width * i / (values.size - 1), pad + (size.height - 2 * pad) * (1f - (v - lo) / span))
        }
        val fill = smoothPath(points).apply {
            lineTo(points.last().x, size.height)
            lineTo(points.first().x, size.height)
            close()
        }
        drawPath(fill, Brush.verticalGradient(listOf(color.copy(alpha = 0.18f), Color.Transparent)))
        drawPath(
            smoothPath(points),
            color,
            style = Stroke(width = 1.75.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round),
        )
    }
}

/**
 * Current period (solid, filled) against the previous period (dashed).
 * Tap or drag horizontally to move the scrubber; tapping the selected point clears it.
 */
@Composable
fun TrendLineChart(
    current: List<Float>,
    previous: List<Float>,
    selectedIndex: Int?,
    onSelectedIndexChange: (Int?) -> Unit,
    description: String,
    modifier: Modifier = Modifier,
) {
    val lineColor = MaterialTheme.colorScheme.primary
    val prevColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
    val gridColor = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.7f)
    val markerRing = PulseTheme.colors.card
    val reveal = remember { Animatable(0f) }
    LaunchedEffect(current) {
        reveal.snapTo(0f)
        reveal.animateTo(1f, tween(750, easing = FastOutSlowInEasing))
    }
    val n = current.size
    val selected by rememberUpdatedState(selectedIndex)
    val onChange by rememberUpdatedState(onSelectedIndexChange)
    fun indexAt(x: Float, width: Int): Int =
        if (n <= 1 || width <= 0) 0 else (x / width * (n - 1)).roundToInt().coerceIn(0, n - 1)

    Canvas(
        modifier
            .semantics { contentDescription = description }
            .pointerInput(n) {
                detectTapGestures { pos ->
                    val i = indexAt(pos.x, size.width)
                    onChange(if (i == selected) null else i)
                }
            }
            .pointerInput(n) {
                detectHorizontalDragGestures(
                    onDragStart = { onChange(indexAt(it.x, size.width)) },
                ) { change, _ ->
                    change.consume()
                    onChange(indexAt(change.position.x, size.width))
                }
            },
    ) {
        if (n == 0) return@Canvas
        val maxValue = max(current.max(), previous.maxOrNull() ?: 0f).coerceAtLeast(1f) * 1.12f
        val top = 4.dp.toPx()
        val chartHeight = size.height - top
        fun xAt(i: Int): Float = if (n <= 1) size.width / 2f else size.width * i / (n - 1)
        fun yAt(v: Float): Float = top + chartHeight * (1f - v / maxValue)

        for (k in 0..3) {
            val y = top + chartHeight * k / 3f
            drawLine(gridColor, Offset(0f, y), Offset(size.width, y), strokeWidth = 1.dp.toPx())
        }

        val prevPoints = previous.take(n).mapIndexed { i, v -> Offset(xAt(i), yAt(v)) }
        if (prevPoints.size > 1) {
            drawPath(
                smoothPath(prevPoints),
                prevColor,
                style = Stroke(
                    width = 1.5.dp.toPx(),
                    cap = StrokeCap.Round,
                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(6.dp.toPx(), 6.dp.toPx())),
                ),
            )
        }

        val points = current.mapIndexed { i, v -> Offset(xAt(i), yAt(v)) }
        clipRect(right = size.width * reveal.value) {
            val fill = smoothPath(points).apply {
                lineTo(points.last().x, size.height)
                lineTo(points.first().x, size.height)
                close()
            }
            drawPath(
                fill,
                Brush.verticalGradient(
                    colors = listOf(lineColor.copy(alpha = 0.22f), Color.Transparent),
                    startY = top,
                    endY = size.height,
                ),
            )
            drawPath(
                smoothPath(points),
                lineColor,
                style = Stroke(width = 2.5.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round),
            )
        }

        selectedIndex?.takeIf { it in 0 until n }?.let { i ->
            val x = xAt(i)
            drawLine(lineColor.copy(alpha = 0.45f), Offset(x, 0f), Offset(x, size.height), strokeWidth = 1.dp.toPx())
            previous.getOrNull(i)?.let { drawCircle(prevColor, 3.5.dp.toPx(), Offset(x, yAt(it))) }
            val center = Offset(x, yAt(current[i]))
            drawCircle(markerRing, 7.dp.toPx(), center)
            drawCircle(lineColor, 4.5.dp.toPx(), center)
        }
    }
}

/** Users-per-minute bars; the newest minute is emphasised, a tapped bar is highlighted. */
@Composable
fun MinuteBarChart(
    values: List<Int>,
    selectedIndex: Int?,
    onSelectedIndexChange: (Int?) -> Unit,
    modifier: Modifier = Modifier,
) {
    val primary = MaterialTheme.colorScheme.primary
    val highlight = PulseTheme.colors.live
    val animated = values.mapIndexed { i, v ->
        animateFloatAsState(v.toFloat(), tween(600, easing = FastOutSlowInEasing), label = "bar$i").value
    }
    val maxValue by animateFloatAsState(
        (values.maxOrNull() ?: 1).toFloat().coerceAtLeast(1f),
        tween(600),
        label = "barMax",
    )
    val n = values.size
    val selected by rememberUpdatedState(selectedIndex)
    val onChange by rememberUpdatedState(onSelectedIndexChange)
    val description = "Users per minute over the last $n minutes. " +
        "This minute ${values.lastOrNull() ?: 0}, peak ${values.maxOrNull() ?: 0}."

    Canvas(
        modifier
            .semantics { contentDescription = description }
            .pointerInput(n) {
                detectTapGestures { pos ->
                    if (n > 0) {
                        val i = (pos.x / (size.width.toFloat() / n)).toInt().coerceIn(0, n - 1)
                        onChange(if (i == selected) null else i)
                    }
                }
            },
    ) {
        if (n == 0) return@Canvas
        val slot = size.width / n
        val barWidth = slot * 0.64f
        val radius = CornerRadius(barWidth / 2.4f, barWidth / 2.4f)
        animated.forEachIndexed { i, v ->
            val h = min(size.height, max(2.dp.toPx(), v / maxValue * size.height))
            val color = when (i) {
                selectedIndex -> highlight
                n - 1 -> primary
                else -> primary.copy(alpha = 0.3f)
            }
            drawRoundRect(
                color = color,
                topLeft = Offset(i * slot + (slot - barWidth) / 2f, size.height - h),
                size = Size(barWidth, h),
                cornerRadius = radius,
            )
        }
    }
}

@Composable
fun DonutChart(
    items: List<LabeledValue>,
    colors: List<Color>,
    centerValue: String,
    centerLabel: String,
    description: String,
    modifier: Modifier = Modifier,
) {
    val intro = remember { Animatable(0f) }
    LaunchedEffect(Unit) { intro.animateTo(1f, tween(900, easing = FastOutSlowInEasing)) }
    val animated = items.mapIndexed { i, item ->
        animateFloatAsState(item.value.toFloat(), tween(600), label = "slice$i").value
    }
    val track = MaterialTheme.colorScheme.surfaceVariant

    Box(modifier.clearAndSetSemantics { contentDescription = description }, contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            val stroke = 14.dp.toPx()
            val d = size.minDimension - stroke
            val topLeft = Offset((size.width - d) / 2f, (size.height - d) / 2f)
            val arcSize = Size(d, d)
            drawArc(track, 0f, 360f, false, topLeft, arcSize, style = Stroke(stroke))
            val sum = animated.sum().coerceAtLeast(1f)
            val gap = if (animated.count { it > 0f } > 1) 3f else 0f
            var start = -90f
            animated.forEachIndexed { i, v ->
                val sweep = v / sum * 360f
                if (sweep > gap) {
                    drawArc(
                        colors[i % colors.size],
                        start + gap / 2f,
                        (sweep - gap) * intro.value,
                        false,
                        topLeft,
                        arcSize,
                        style = Stroke(stroke, cap = StrokeCap.Butt),
                    )
                }
                start += sweep
            }
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(centerValue, style = MaterialTheme.typography.titleLarge.tabular())
            Text(
                centerLabel,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/** Ranked rows with a proportional bar under each label; grows in on first display. */
@Composable
fun HorizontalBarList(
    items: List<LabeledValue>,
    format: ValueFormat,
    modifier: Modifier = Modifier,
    color: Color = MaterialTheme.colorScheme.primary,
) {
    val maxValue = (items.maxOfOrNull { it.value } ?: 1.0).coerceAtLeast(1e-9)
    val track = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.7f)
    Column(modifier, verticalArrangement = Arrangement.spacedBy(14.dp)) {
        items.forEach { item ->
            key(item.label) {
                val target = (item.value / maxValue).toFloat().coerceIn(0f, 1f)
                val fraction = remember { Animatable(0f) }
                LaunchedEffect(target) { fraction.animateTo(target, tween(650, easing = FastOutSlowInEasing)) }
                Column(Modifier.semantics(mergeDescendants = true) {}) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            item.label,
                            modifier = Modifier.weight(1f),
                            style = MaterialTheme.typography.bodyMedium,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Spacer(Modifier.width(12.dp))
                        Text(formatValue(format, item.value), style = MaterialTheme.typography.labelLarge.tabular())
                    }
                    Spacer(Modifier.height(6.dp))
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(6.dp)
                            .clip(CircleShape)
                            .background(track),
                    ) {
                        Box(
                            Modifier
                                .fillMaxWidth(fraction.value)
                                .fillMaxHeight()
                                .clip(CircleShape)
                                .background(color),
                        )
                    }
                }
            }
        }
    }
}
