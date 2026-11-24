package com.pulseboard.app.ui.components

import com.pulseboard.app.data.ValueFormat
import java.text.NumberFormat
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToInt
import kotlin.math.roundToLong

fun formatCount(value: Double): String {
    val locale = Locale.getDefault()
    return when {
        abs(value) >= 1_000_000 -> String.format(locale, "%.1fM", value / 1_000_000)
        abs(value) >= 100_000 -> String.format(locale, "%.0fK", value / 1_000)
        abs(value) >= 10_000 -> String.format(locale, "%.1fK", value / 1_000)
        else -> NumberFormat.getIntegerInstance(locale).format(value.roundToLong())
    }
}

fun formatInt(value: Int): String = NumberFormat.getIntegerInstance(Locale.getDefault()).format(value)

fun formatDuration(seconds: Double): String {
    val total = seconds.roundToInt().coerceAtLeast(0)
    val minutes = total / 60
    val secs = total % 60
    return if (minutes > 0) "${minutes}m ${secs.toString().padStart(2, '0')}s" else "${secs}s"
}

fun formatValue(format: ValueFormat, value: Double): String = when (format) {
    ValueFormat.COUNT -> formatCount(value)
    ValueFormat.PERCENT -> String.format(Locale.getDefault(), "%.1f%%", value)
    ValueFormat.DURATION -> formatDuration(value)
}

fun formatDelta(percent: Double): String = String.format(Locale.getDefault(), "%.1f%%", abs(percent))
