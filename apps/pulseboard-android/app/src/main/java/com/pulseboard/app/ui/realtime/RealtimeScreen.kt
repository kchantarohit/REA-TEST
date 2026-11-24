package com.pulseboard.app.ui.realtime

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateIntAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.VerticalDivider
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pulseboard.app.data.AnomalyKind
import com.pulseboard.app.data.LabeledValue
import com.pulseboard.app.data.LaunchMark
import com.pulseboard.app.data.LiveEvent
import com.pulseboard.app.data.RealtimeSnapshot
import com.pulseboard.app.data.detectAnomalies
import com.pulseboard.app.ui.components.DeltaBadge
import com.pulseboard.app.ui.components.DemoDataChip
import com.pulseboard.app.ui.components.ErrorCard
import com.pulseboard.app.ui.components.Eyebrow
import com.pulseboard.app.ui.components.Gutter
import com.pulseboard.app.ui.components.Hairline
import com.pulseboard.app.ui.components.LivePulseDot
import com.pulseboard.app.ui.components.SkeletonBlock
import com.pulseboard.app.ui.components.formatCount
import com.pulseboard.app.ui.components.formatInt
import com.pulseboard.app.ui.components.formatShare
import com.pulseboard.app.ui.theme.HeroNumberStyle
import com.pulseboard.app.ui.theme.PulseTheme
import com.pulseboard.app.ui.theme.tabular
import kotlinx.coroutines.delay
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.abs

private const val VISIBLE_EVENTS = 15

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RealtimeScreen(viewModel: RealtimeViewModel) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var editingThreshold by rememberSaveable { mutableStateOf(false) }

    // Threshold alert: one vibration and three accent flashes at 2 per second (below the 3/s limit).
    val haptics = rememberAlertHaptics()
    val flash = remember { Animatable(0f) }
    LaunchedEffect(viewModel) {
        viewModel.alerts.collect {
            haptics()
            repeat(3) {
                flash.animateTo(1f, tween(150))
                flash.animateTo(0f, tween(350))
            }
        }
    }

    PullToRefreshBox(
        isRefreshing = state.isRefreshing,
        onRefresh = viewModel::refresh,
        modifier = Modifier.fillMaxSize().statusBarsPadding(),
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 32.dp),
        ) {
            item { Header(state.propertyName) }
            state.error?.let { message ->
                item { ErrorCard(message, onRetry = viewModel::refresh, modifier = Modifier.padding(horizontal = Gutter)) }
            }
            val snapshot = state.snapshot
            if (snapshot == null) {
                if (state.error == null) item { RealtimeSkeleton() }
            } else {
                item {
                    Hero(
                        snapshot = snapshot,
                        launch = state.launch,
                        above = state.isAboveThreshold,
                        flash = flash.value,
                    )
                }
                item {
                    LaunchAlertRow(
                        launch = state.launch,
                        threshold = state.threshold,
                        onMark = viewModel::markLaunch,
                        onReset = viewModel::resetLaunch,
                        onEditThreshold = { editingThreshold = true },
                    )
                }
                item { MinuteSection(snapshot.perMinute) }
                item {
                    Section("Device") { DeviceSplit(snapshot.devices) }
                }
                item {
                    Section("Top pages") { RuledTable(snapshot.topPages, "Page", snapshot.activeUsers) }
                }
                item {
                    Section("Top countries") { RuledTable(snapshot.topCountries, "Country", snapshot.activeUsers) }
                }
                item {
                    Section("Live events", trailing = "newest first") {
                        Row(Modifier.fillMaxWidth()) {
                            Eyebrow("Time", Modifier.width(TIME_COLUMN))
                            Eyebrow("Event", Modifier.weight(1f))
                            Eyebrow("Where")
                        }
                        Spacer(Modifier.height(6.dp))
                        Hairline(color = PulseTheme.colors.ink)
                    }
                }
                if (state.events.isEmpty()) {
                    item {
                        Text(
                            "Waiting for events…",
                            modifier = Modifier.padding(horizontal = Gutter, vertical = 12.dp),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                items(state.events.take(VISIBLE_EVENTS), key = { it.id }) { event ->
                    EventRow(event, Modifier.animateItem())
                }
            }
        }
    }

    if (editingThreshold) {
        ThresholdDialog(
            current = state.threshold,
            onSave = {
                viewModel.setThreshold(it)
                editingThreshold = false
            },
            onDismiss = { editingThreshold = false },
        )
    }
}

private val TIME_COLUMN: Dp = 76.dp

@Composable
private fun Header(propertyName: String) {
    Row(
        Modifier.fillMaxWidth().padding(start = Gutter, end = Gutter, top = 16.dp, bottom = 8.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Column(Modifier.weight(1f)) {
            Text("Realtime", style = MaterialTheme.typography.headlineMedium)
            if (propertyName.isNotEmpty()) {
                Text(
                    propertyName,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        DemoDataChip(Modifier.padding(top = 6.dp))
    }
}

@Composable
private fun Section(title: String, trailing: String? = null, content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxWidth().padding(horizontal = Gutter).padding(top = 28.dp)) {
        Hairline()
        Spacer(Modifier.height(12.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Eyebrow(title, Modifier.weight(1f), color = MaterialTheme.colorScheme.onSurface)
            if (trailing != null) {
                Text(
                    trailing,
                    style = MaterialTheme.typography.labelMedium.tabular(),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        Spacer(Modifier.height(12.dp))
        content()
    }
}

@Composable
private fun Hero(snapshot: RealtimeSnapshot, launch: LaunchMark?, above: Boolean, flash: Float) {
    val colors = PulseTheme.colors
    val animatedUsers by animateIntAsState(snapshot.activeUsers, tween(700), label = "activeUsers")
    val baseline = launch?.baseline ?: snapshot.baselineActive
    val delta = if (baseline > 0) (snapshot.activeUsers - baseline) * 100.0 / baseline else 0.0
    val numberColor = lerp(if (above) colors.accentText else colors.ink, colors.onAccent, flash)
    val labelColor = lerp(colors.muted, colors.onAccent, flash)

    Column(
        Modifier
            .fillMaxWidth()
            .background(colors.accent.copy(alpha = flash))
            .padding(horizontal = Gutter, vertical = 12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            LivePulseDot(Modifier.size(16.dp))
            Spacer(Modifier.width(4.dp))
            Eyebrow("Active users · last 30 min", color = labelColor)
            if (above) {
                Spacer(Modifier.width(8.dp))
                Eyebrow("Above alert", color = lerp(colors.accentText, colors.onAccent, flash))
            }
        }
        Text(
            formatInt(animatedUsers),
            modifier = Modifier.semantics {
                contentDescription = "${snapshot.activeUsers} active users in the last 30 minutes" +
                    if (above) ", above alert threshold" else ""
            },
            style = HeroNumberStyle,
            color = numberColor,
            maxLines = 1,
        )
        DeltaBadge(
            deltaPercent = delta,
            accentWhenUp = true,
            suffix = (if (launch != null) "vs pre-launch " else "vs 30-min avg ") + formatInt(baseline),
        )
    }
}

@Composable
private fun LaunchAlertRow(
    launch: LaunchMark?,
    threshold: Int?,
    onMark: () -> Unit,
    onReset: () -> Unit,
    onEditThreshold: () -> Unit,
) {
    Column(Modifier.padding(horizontal = Gutter).padding(top = 20.dp)) {
        Hairline()
        Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
            Column(Modifier.weight(1.5f).padding(top = 12.dp, bottom = 4.dp, end = 16.dp)) {
                Eyebrow("Launch")
                Spacer(Modifier.height(4.dp))
                if (launch == null) {
                    Text(
                        "Not marked",
                        style = MaterialTheme.typography.titleLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(8.dp))
                    SwissButton("Mark launch", onMark)
                } else {
                    LaunchClock(launch.atMillis)
                    Spacer(Modifier.height(8.dp))
                    SwissButton("Reset", onReset)
                }
            }
            VerticalDivider(Modifier.fillMaxHeight(), thickness = Dp.Hairline, color = PulseTheme.colors.hairline)
            Column(Modifier.weight(1f).padding(start = 16.dp, top = 12.dp, bottom = 4.dp)) {
                Eyebrow("Alert at")
                Spacer(Modifier.height(4.dp))
                if (threshold == null) {
                    Text(
                        "Off",
                        style = MaterialTheme.typography.titleLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                } else {
                    Text(formatInt(threshold), style = MaterialTheme.typography.titleLarge.tabular())
                }
                Spacer(Modifier.height(8.dp))
                SwissButton(if (threshold == null) "Set" else "Edit", onEditThreshold)
            }
        }
    }
}

@Composable
private fun LaunchClock(atMillis: Long) {
    val now by produceState(System.currentTimeMillis(), atMillis) {
        while (true) {
            value = System.currentTimeMillis()
            delay(1_000L - value % 1_000L)
        }
    }
    val text = formatElapsed(now - atMillis)
    Text(
        text,
        modifier = Modifier.semantics { contentDescription = "Time since launch $text" },
        style = MaterialTheme.typography.titleLarge.tabular(),
    )
}

fun formatElapsed(ms: Long): String {
    val s = (ms / 1_000L).coerceAtLeast(0L)
    val h = s / 3_600
    val m = (s % 3_600) / 60
    val sec = s % 60
    return if (h > 0) {
        String.format(Locale.US, "T+%d:%02d:%02d", h, m, sec)
    } else {
        String.format(Locale.US, "T+%02d:%02d", m, sec)
    }
}

@Composable
private fun SwissButton(label: String, onClick: () -> Unit) {
    OutlinedButton(
        onClick = onClick,
        shape = RoundedCornerShape(2.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.onSurface),
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
        modifier = Modifier.heightIn(min = 36.dp),
    ) {
        Text(label.uppercase(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurface)
    }
}

@Composable
private fun MinuteSection(values: List<Int>) {
    var selected by remember { mutableStateOf<Int?>(null) }
    val anomalies = remember(values) { detectAnomalies(values, window = ROLLING_WINDOW) }
    val byIndex = anomalies.associateBy { it.index }
    val n = values.size
    fun ago(i: Int) = n - 1 - i

    val readout = selected?.takeIf { it in values.indices }?.let { i ->
        buildString {
            append(if (ago(i) == 0) "now" else "-${ago(i)}m")
            append("  ").append(values[i])
            byIndex[i]?.let { a ->
                append(if (a.kind == AnomalyKind.SPIKE) "  ▲ " else "  ▼ ")
                append(String.format(Locale.US, "%.1fσ", abs(a.sigmas)))
            }
        }
    } ?: "${values.lastOrNull() ?: 0} now"

    val description = buildString {
        append("Users per minute, last $n minutes. This minute ${values.lastOrNull() ?: 0}, peak ${values.maxOrNull() ?: 0}.")
        anomalies.forEach { a ->
            val kind = if (a.kind == AnomalyKind.SPIKE) "Spike" else "Drop"
            val whenText = if (ago(a.index) == 0) "this minute" else "${ago(a.index)} minutes ago"
            append(" $kind $whenText: ${values[a.index]} against a mean of ${a.mean.toInt()}.")
        }
    }

    Section("Users / min", trailing = readout) {
        MinuteChart(
            values = values,
            anomalies = anomalies,
            selectedIndex = selected,
            onSelectedIndexChange = { selected = it },
            description = description,
            modifier = Modifier.fillMaxWidth().height(132.dp),
        )
        Spacer(Modifier.height(6.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            listOf("-30m", "-20m", "-10m", "now").forEach {
                Text(it, style = MaterialTheme.typography.labelSmall.tabular(), color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        Spacer(Modifier.height(8.dp))
        Text(
            "▲ spike  ▼ drop  ·  >2σ from $ROLLING_WINDOW-min rolling mean (dashed)  ·  peak ${values.maxOrNull() ?: 0}",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun DeviceSplit(devices: List<LabeledValue>) {
    val neutrals = PulseTheme.colors.neutrals
    val total = devices.sumOf { it.value }
    if (total <= 0.0) return
    val description = "Users by device: " + devices.joinToString { "${it.label} ${formatShare(it.value, total)}" }

    Column(Modifier.semantics(mergeDescendants = true) { contentDescription = description }) {
        Row(Modifier.fillMaxWidth().height(12.dp)) {
            devices.forEachIndexed { i, device ->
                Box(
                    Modifier
                        .weight((device.value / total).toFloat().coerceAtLeast(0.001f))
                        .fillMaxHeight()
                        .background(neutrals[i % neutrals.size]),
                )
                if (i < devices.lastIndex) Spacer(Modifier.width(2.dp))
            }
        }
        Spacer(Modifier.height(10.dp))
        Row(Modifier.fillMaxWidth()) {
            devices.forEachIndexed { i, device ->
                Column(Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(8.dp).background(neutrals[i % neutrals.size]))
                        Spacer(Modifier.width(6.dp))
                        Eyebrow(device.label)
                    }
                    Text(formatShare(device.value, total), style = MaterialTheme.typography.titleLarge.tabular())
                }
            }
        }
    }
}

@Composable
private fun RuledTable(items: List<LabeledValue>, dimension: String, activeUsers: Int) {
    val total = activeUsers.toDouble().coerceAtLeast(1.0)
    Column {
        Row(Modifier.fillMaxWidth()) {
            Eyebrow("#", Modifier.width(28.dp))
            Eyebrow(dimension, Modifier.weight(1f))
            EndCell(Modifier.width(64.dp)) { Eyebrow("Users") }
            EndCell(Modifier.width(56.dp)) { Eyebrow("Share") }
        }
        Spacer(Modifier.height(6.dp))
        Hairline(color = PulseTheme.colors.ink)
        items.forEachIndexed { index, item ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 40.dp)
                    .semantics(mergeDescendants = true) {},
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    String.format(Locale.US, "%02d", index + 1),
                    modifier = Modifier.width(28.dp),
                    style = MaterialTheme.typography.labelMedium.tabular(),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    item.label,
                    modifier = Modifier.weight(1f),
                    style = MaterialTheme.typography.bodyMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    formatCount(item.value),
                    modifier = Modifier.width(64.dp),
                    style = MaterialTheme.typography.bodyMedium.tabular(),
                    textAlign = TextAlign.End,
                )
                Text(
                    formatShare(item.value, total),
                    modifier = Modifier.width(56.dp),
                    style = MaterialTheme.typography.bodyMedium.tabular(),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.End,
                )
            }
            Hairline()
        }
    }
}

@Composable
private fun EndCell(modifier: Modifier, content: @Composable () -> Unit) {
    Box(modifier, contentAlignment = Alignment.CenterEnd) { content() }
}

private val ClockFormat: DateTimeFormatter = DateTimeFormatter.ofPattern("HH:mm:ss", Locale.US)

@Composable
private fun EventRow(event: LiveEvent, modifier: Modifier = Modifier) {
    val notable = event.name == "purchase" || event.name == "sign_up"
    val time = Instant.ofEpochMilli(event.timeMillis).atZone(ZoneId.systemDefault()).format(ClockFormat)
    Column(modifier.fillMaxWidth().padding(horizontal = Gutter)) {
        Row(
            Modifier
                .fillMaxWidth()
                .heightIn(min = 36.dp)
                .semantics(mergeDescendants = true) {},
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                time,
                modifier = Modifier.width(TIME_COLUMN),
                style = MaterialTheme.typography.labelMedium.tabular(),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                event.name,
                modifier = Modifier.weight(1f),
                style = MaterialTheme.typography.bodyMedium.tabular(),
                color = if (notable) PulseTheme.colors.accentText else MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
            )
            Text(
                event.detail,
                modifier = Modifier.padding(start = 8.dp),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Hairline()
    }
}

@Composable
private fun ThresholdDialog(current: Int?, onSave: (Int?) -> Unit, onDismiss: () -> Unit) {
    var text by rememberSaveable { mutableStateOf(current?.toString() ?: "500") }
    val value = text.toIntOrNull()
    val valid = value != null && value in 1..10_000_000
    AlertDialog(
        onDismissRequest = onDismiss,
        shape = RoundedCornerShape(4.dp),
        title = { Text("Alert threshold") },
        text = {
            Column {
                Text(
                    "Vibrate once and flash when active users rise to this number.",
                    style = MaterialTheme.typography.bodyMedium,
                )
                Spacer(Modifier.height(16.dp))
                OutlinedTextField(
                    value = text,
                    onValueChange = { input -> text = input.filter(Char::isDigit).take(8) },
                    singleLine = true,
                    label = { Text("Active users") },
                    isError = !valid,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    textStyle = MaterialTheme.typography.bodyLarge.tabular(),
                    shape = RoundedCornerShape(2.dp),
                )
            }
        },
        confirmButton = {
            TextButton(onClick = { onSave(value) }, enabled = valid) { Text("Save") }
        },
        dismissButton = {
            Row {
                if (current != null) TextButton(onClick = { onSave(null) }) { Text("Turn off") }
                TextButton(onClick = onDismiss) { Text("Cancel") }
            }
        },
    )
}

@Composable
private fun RealtimeSkeleton() {
    val shape = RoundedCornerShape(2.dp)
    Column(Modifier.padding(horizontal = Gutter, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        SkeletonBlock(Modifier.width(220.dp).height(88.dp), shape)
        SkeletonBlock(Modifier.fillMaxWidth().height(72.dp), shape)
        SkeletonBlock(Modifier.fillMaxWidth().height(150.dp), shape)
        SkeletonBlock(Modifier.fillMaxWidth().height(200.dp), shape)
    }
}
