package com.pulseboard.app.ui.realtime

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.pulseboard.app.data.Anomaly
import com.pulseboard.app.data.AnomalyKind
import com.pulseboard.app.ui.theme.PulseTheme
import kotlin.math.max
import kotlin.math.min

/** Rolling window (minutes) used for the dashed mean line and the anomaly detector. */
const val ROLLING_WINDOW = 10

/**
 * Thin users-per-minute bars on a hairline axis. Spikes are filled with the accent and carry a
 * small up-triangle; drops carry a down-triangle in ink. Tap a bar to inspect it.
 */
@Composable
fun MinuteChart(
    values: List<Int>,
    anomalies: List<Anomaly>,
    selectedIndex: Int?,
    onSelectedIndexChange: (Int?) -> Unit,
    description: String,
    modifier: Modifier = Modifier,
) {
    val colors = PulseTheme.colors
    val animated = values.mapIndexed { i, v ->
        animateFloatAsState(v.toFloat(), tween(500), label = "minute$i").value
    }
    val maxValue by animateFloatAsState(
        (values.maxOrNull() ?: 1).toFloat().coerceAtLeast(1f),
        tween(500),
        label = "minuteMax",
    )
    val rollingMean = values.takeLast(ROLLING_WINDOW).takeIf { it.isNotEmpty() }?.average()?.toFloat()
    val byIndex = anomalies.associateBy { it.index }
    val n = values.size
    val selected by rememberUpdatedState(selectedIndex)
    val onChange by rememberUpdatedState(onSelectedIndexChange)

    Canvas(
        modifier
            .semantics { contentDescription = description }
            .pointerInput(n) {
                detectTapGestures { pos ->
                    if (n > 0 && size.width > 0) {
                        val i = (pos.x / (size.width.toFloat() / n)).toInt().coerceIn(0, n - 1)
                        onChange(if (i == selected) null else i)
                    }
                }
            },
    ) {
        if (n == 0) return@Canvas
        val markerZone = 14.dp.toPx()
        val chartHeight = size.height - markerZone
        val slot = size.width / n
        val barWidth = max(2.dp.toPx(), slot * 0.38f)
        val tri = 4.dp.toPx()
        fun heightOf(v: Float) = min(chartHeight, max(1.dp.toPx(), v / maxValue * chartHeight))

        animated.forEachIndexed { i, v ->
            val h = heightOf(v)
            val anomaly = byIndex[i]
            val color = when {
                anomaly?.kind == AnomalyKind.SPIKE -> colors.accent
                i == n - 1 || i == selectedIndex -> colors.ink
                else -> colors.muted.copy(alpha = 0.55f)
            }
            val left = i * slot + (slot - barWidth) / 2f
            drawRect(color, Offset(left, size.height - h), Size(barWidth, h))

            if (anomaly != null) {
                val cx = left + barWidth / 2f
                val y = size.height - h - 3.dp.toPx()
                val path = Path().apply {
                    if (anomaly.kind == AnomalyKind.SPIKE) {
                        moveTo(cx, y - tri * 1.5f)
                        lineTo(cx - tri, y)
                        lineTo(cx + tri, y)
                    } else {
                        moveTo(cx, y)
                        lineTo(cx - tri, y - tri * 1.5f)
                        lineTo(cx + tri, y - tri * 1.5f)
                    }
                    close()
                }
                drawPath(path, if (anomaly.kind == AnomalyKind.SPIKE) colors.accent else colors.ink)
            }
        }

        rollingMean?.let { mean ->
            val y = size.height - heightOf(mean)
            drawLine(
                colors.muted,
                Offset(0f, y),
                Offset(size.width, y),
                strokeWidth = 1f,
                pathEffect = PathEffect.dashPathEffect(floatArrayOf(3.dp.toPx(), 3.dp.toPx())),
            )
        }
        // Hairline axis.
        drawLine(colors.ink, Offset(0f, size.height - 0.5f), Offset(size.width, size.height - 0.5f), strokeWidth = 1f)
    }
}
