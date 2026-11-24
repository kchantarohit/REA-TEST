package com.pulseboard.app.ui.realtime

import androidx.compose.animation.core.animateIntAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pulseboard.app.data.RealtimeSnapshot
import com.pulseboard.app.data.ValueFormat
import com.pulseboard.app.ui.components.DonutChart
import com.pulseboard.app.ui.components.ErrorCard
import com.pulseboard.app.ui.components.Gutter
import com.pulseboard.app.ui.components.HorizontalBarList
import com.pulseboard.app.ui.components.LivePulseDot
import com.pulseboard.app.ui.components.MinuteBarChart
import com.pulseboard.app.ui.components.PulseCard
import com.pulseboard.app.ui.components.ScreenScaffold
import com.pulseboard.app.ui.components.SkeletonBlock
import com.pulseboard.app.ui.components.formatInt
import com.pulseboard.app.ui.components.formatShare
import com.pulseboard.app.ui.theme.PulseTheme
import com.pulseboard.app.ui.theme.tabular

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RealtimeScreen(viewModel: RealtimeViewModel) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    ScreenScaffold(title = "Realtime") { padding ->
        PullToRefreshBox(
            isRefreshing = state.isRefreshing,
            onRefresh = viewModel::refresh,
            modifier = Modifier.fillMaxSize().padding(padding),
        ) {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = Gutter, end = Gutter, top = 4.dp, bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                state.error?.let { message ->
                    item { ErrorCard(message, onRetry = viewModel::refresh) }
                }
                val snapshot = state.snapshot
                if (snapshot == null) {
                    if (state.error == null) item { RealtimeSkeleton() }
                } else {
                    item { HeroCard(snapshot) }
                    item { DevicesCard(snapshot) }
                    item { TopListCard(snapshot) }
                    item {
                        PulseCard(Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(20.dp)) {
                                Text("Top events", style = MaterialTheme.typography.titleMedium)
                                Text(
                                    "Event count · last 30 min",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                                Spacer(Modifier.height(16.dp))
                                HorizontalBarList(
                                    items = snapshot.topEvents,
                                    format = ValueFormat.COUNT,
                                    color = PulseTheme.colors.series[1],
                                )
                            }
                        }
                    }
                    item {
                        Text(
                            "Updates every few seconds",
                            modifier = Modifier.fillMaxWidth(),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun HeroCard(snapshot: RealtimeSnapshot) {
    var selectedMinute by remember { mutableStateOf<Int?>(null) }
    val animatedUsers by animateIntAsState(snapshot.activeUsers, tween(800), label = "activeUsers")
    val minutes = snapshot.perMinute

    PulseCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                LivePulseDot()
                Spacer(Modifier.width(8.dp))
                Text(
                    "Active users · last 30 min",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(
                formatInt(animatedUsers),
                modifier = Modifier.semantics {
                    contentDescription = "${snapshot.activeUsers} active users in the last 30 minutes"
                },
                style = MaterialTheme.typography.displayMedium.tabular(),
            )
            Spacer(Modifier.height(12.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "Users per minute",
                    modifier = Modifier.weight(1f),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                val readout = selectedMinute?.takeIf { it in minutes.indices }?.let { i ->
                    val ago = minutes.lastIndex - i
                    "${minutes[i]} · ${if (ago == 0) "this minute" else "$ago min ago"}"
                } ?: "${minutes.lastOrNull() ?: 0} this minute"
                Text(readout, style = MaterialTheme.typography.labelMedium.tabular())
            }
            Spacer(Modifier.height(8.dp))
            MinuteBarChart(
                values = minutes,
                selectedIndex = selectedMinute,
                onSelectedIndexChange = { selectedMinute = it },
                modifier = Modifier.fillMaxWidth().height(112.dp),
            )
            Spacer(Modifier.height(6.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("−30 min", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("Now", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun DevicesCard(snapshot: RealtimeSnapshot) {
    val colors = PulseTheme.colors.series
    val total = snapshot.devices.sumOf { it.value }
    val description = "Users by device: " +
        snapshot.devices.joinToString { "${it.label} ${formatShare(it.value, total)}" }

    PulseCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(20.dp)) {
            Text("Users by device", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(16.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                DonutChart(
                    items = snapshot.devices,
                    colors = colors,
                    centerValue = formatInt(total.toInt()),
                    centerLabel = "users",
                    description = description,
                    modifier = Modifier.size(132.dp),
                )
                Spacer(Modifier.width(24.dp))
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    snapshot.devices.forEachIndexed { i, device ->
                        Row(
                            modifier = Modifier.clearAndSetSemantics { },
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(Modifier.size(10.dp).background(colors[i % colors.size], CircleShape))
                            Spacer(Modifier.width(8.dp))
                            Text(device.label, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                            Text(
                                formatShare(device.value, total),
                                style = MaterialTheme.typography.titleSmall.tabular(),
                            )
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TopListCard(snapshot: RealtimeSnapshot) {
    var tab by rememberSaveable { mutableIntStateOf(0) }
    val tabs = listOf("Pages", "Countries")
    PulseCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(20.dp)) {
            Text(
                if (tab == 0) "Top pages" else "Top countries",
                style = MaterialTheme.typography.titleMedium,
            )
            Text(
                "Active users · last 30 min",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(12.dp))
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                tabs.forEachIndexed { index, label ->
                    SegmentedButton(
                        selected = tab == index,
                        onClick = { tab = index },
                        shape = SegmentedButtonDefaults.itemShape(index = index, count = tabs.size),
                        label = { Text(label) },
                    )
                }
            }
            Spacer(Modifier.height(16.dp))
            HorizontalBarList(
                items = if (tab == 0) snapshot.topPages else snapshot.topCountries,
                format = ValueFormat.COUNT,
            )
        }
    }
}

@Composable
private fun RealtimeSkeleton() {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        SkeletonBlock(Modifier.fillMaxWidth().height(260.dp), RoundedCornerShape(24.dp))
        SkeletonBlock(Modifier.fillMaxWidth().height(190.dp), RoundedCornerShape(24.dp))
        SkeletonBlock(Modifier.fillMaxWidth().height(240.dp), RoundedCornerShape(24.dp))
    }
}
