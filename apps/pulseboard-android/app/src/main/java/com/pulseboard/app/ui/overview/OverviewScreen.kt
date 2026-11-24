package com.pulseboard.app.ui.overview

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowDropDown
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material3.AssistChip
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pulseboard.app.data.DateRange
import com.pulseboard.app.data.FilterDimension
import com.pulseboard.app.data.Filters
import com.pulseboard.app.data.KpiSummary
import com.pulseboard.app.data.TrendSeries
import com.pulseboard.app.ui.components.DeltaBadge
import com.pulseboard.app.ui.components.ErrorCard
import com.pulseboard.app.ui.components.Gutter
import com.pulseboard.app.ui.components.PulseCard
import com.pulseboard.app.ui.components.RangeSelector
import com.pulseboard.app.ui.components.ScreenScaffold
import com.pulseboard.app.ui.components.SkeletonBlock
import com.pulseboard.app.ui.components.Sparkline
import com.pulseboard.app.ui.components.TrendLineChart
import com.pulseboard.app.ui.components.formatDelta
import com.pulseboard.app.ui.components.formatValue
import com.pulseboard.app.ui.theme.tabular

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OverviewScreen(viewModel: OverviewViewModel) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var sheetFor by rememberSaveable { mutableStateOf<FilterDimension?>(null) }

    ScreenScaffold(title = "Overview") { padding ->
        PullToRefreshBox(
            isRefreshing = state.isRefreshing,
            onRefresh = viewModel::refresh,
            modifier = Modifier.fillMaxSize().padding(padding),
        ) {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(top = 4.dp, bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                item {
                    RangeSelector(
                        selected = state.range,
                        onSelect = viewModel::setRange,
                        modifier = Modifier.padding(horizontal = Gutter),
                    )
                }
                item {
                    FilterRow(
                        filters = state.filters,
                        onOpen = { sheetFor = it },
                        onClear = viewModel::clearFilters,
                    )
                }
                item {
                    // Fixed-height slot so the progress bar never shifts content.
                    Box(Modifier.fillMaxWidth().padding(horizontal = Gutter).height(3.dp)) {
                        if (state.isLoading && !state.isRefreshing && state.data != null) {
                            LinearProgressIndicator(Modifier.fillMaxSize())
                        }
                    }
                }
                state.error?.let { message ->
                    item { ErrorCard(message, onRetry = viewModel::refresh, modifier = Modifier.padding(horizontal = Gutter)) }
                }
                val data = state.data
                if (data == null) {
                    if (state.error == null) item { OverviewSkeleton() }
                } else {
                    item {
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = Gutter),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            items(data.kpis, key = { it.metric.name }) { kpi ->
                                KpiCard(
                                    kpi = kpi,
                                    selected = kpi.metric == state.selectedMetric,
                                    onClick = { viewModel.selectMetric(kpi.metric) },
                                )
                            }
                        }
                    }
                    val kpi = data.kpis.first { it.metric == state.selectedMetric }
                    val series = data.trends.getValue(state.selectedMetric)
                    item {
                        TrendCard(
                            kpi = kpi,
                            series = series,
                            range = data.range,
                            modifier = Modifier.padding(horizontal = Gutter),
                        )
                    }
                }
            }
        }
    }

    sheetFor?.let { dimension ->
        FilterSheet(
            dimension = dimension,
            current = state.filters[dimension],
            onSelect = { value ->
                viewModel.setFilter(dimension, value)
                sheetFor = null
            },
            onDismiss = { sheetFor = null },
        )
    }
}

@Composable
private fun FilterRow(filters: Filters, onOpen: (FilterDimension) -> Unit, onClear: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = Gutter),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        FilterDimension.entries.forEach { dimension ->
            val value = filters[dimension]
            FilterChip(
                selected = value != null,
                onClick = { onOpen(dimension) },
                label = { Text(if (value == null) dimension.label else "${dimension.label}: $value") },
                leadingIcon = if (value != null) {
                    { Icon(Icons.Rounded.Check, contentDescription = null, modifier = Modifier.size(18.dp)) }
                } else {
                    null
                },
                trailingIcon = {
                    Icon(Icons.Rounded.ArrowDropDown, contentDescription = null, modifier = Modifier.size(18.dp))
                },
            )
        }
        if (filters.isNotEmpty()) {
            AssistChip(
                onClick = onClear,
                label = { Text("Clear") },
                leadingIcon = { Icon(Icons.Rounded.Close, contentDescription = null, modifier = Modifier.size(18.dp)) },
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FilterSheet(
    dimension: FilterDimension,
    current: String?,
    onSelect: (String?) -> Unit,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        Text(
            "Filter by ${dimension.label.lowercase()}",
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp),
        )
        val options: List<String?> = listOf<String?>(null) + dimension.options
        options.forEach { option ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 52.dp)
                    .selectable(selected = option == current, onClick = { onSelect(option) }, role = Role.RadioButton)
                    .padding(horizontal = 24.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                RadioButton(selected = option == current, onClick = null)
                Spacer(Modifier.width(16.dp))
                Text(option ?: "All", style = MaterialTheme.typography.bodyLarge)
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun KpiCard(kpi: KpiSummary, selected: Boolean, onClick: () -> Unit) {
    val scheme = MaterialTheme.colorScheme
    PulseCard(
        modifier = Modifier
            .width(172.dp)
            .semantics { this.selected = selected },
        shape = RoundedCornerShape(20.dp),
        selected = selected,
        onClick = onClick,
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(
                kpi.metric.label,
                style = MaterialTheme.typography.labelLarge,
                color = scheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.height(6.dp))
            Text(
                formatValue(kpi.metric.format, kpi.value),
                style = MaterialTheme.typography.headlineSmall.tabular(),
                maxLines = 1,
            )
            Spacer(Modifier.height(6.dp))
            DeltaBadge(kpi.deltaPercent)
            Spacer(Modifier.height(12.dp))
            Sparkline(
                values = kpi.sparkline,
                color = if (selected) scheme.primary else scheme.onSurfaceVariant.copy(alpha = 0.7f),
                modifier = Modifier.fillMaxWidth().height(32.dp),
            )
        }
    }
}

@Composable
private fun TrendCard(kpi: KpiSummary, series: TrendSeries, range: DateRange, modifier: Modifier = Modifier) {
    var selectedIndex by remember(series) { mutableStateOf<Int?>(null) }
    val format = kpi.metric.format
    val index = (selectedIndex ?: series.current.lastIndex).coerceAtLeast(0)
    val direction = if (kpi.deltaPercent >= 0) "up" else "down"
    val description = "${kpi.metric.label} trend, ${range.longLabel.lowercase()}. " +
        "Total ${formatValue(format, kpi.value)}, $direction ${formatDelta(kpi.deltaPercent)} " +
        "from ${formatValue(format, kpi.previous)} in the previous period. Drag to inspect days."

    PulseCard(modifier.fillMaxWidth()) {
        Column(Modifier.padding(20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(kpi.metric.label, style = MaterialTheme.typography.titleMedium)
                    Text(
                        if (selectedIndex == null) "Latest day · vs previous period" else series.labels.getOrElse(index) { "" },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                DeltaBadge(kpi.deltaPercent)
            }
            Spacer(Modifier.height(16.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                LegendValue(
                    label = "This period",
                    value = series.current.getOrNull(index)?.let { formatValue(format, it.toDouble()) } ?: "–",
                    color = MaterialTheme.colorScheme.primary,
                    dashed = false,
                )
                LegendValue(
                    label = "Previous",
                    value = series.previous.getOrNull(index)?.let { formatValue(format, it.toDouble()) } ?: "–",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    dashed = true,
                )
            }
            Spacer(Modifier.height(16.dp))
            TrendLineChart(
                current = series.current,
                previous = series.previous,
                selectedIndex = selectedIndex,
                onSelectedIndexChange = { selectedIndex = it },
                description = description,
                modifier = Modifier.fillMaxWidth().height(190.dp),
            )
            Spacer(Modifier.height(8.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                val labels = series.labels
                listOf(labels.firstOrNull(), labels.getOrNull(labels.size / 2), labels.lastOrNull()).forEach {
                    Text(
                        it ?: "",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun LegendValue(label: String, value: String, color: Color, dashed: Boolean) {
    Column(Modifier.semantics(mergeDescendants = true) {}) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Canvas(Modifier.size(width = 16.dp, height = 8.dp)) {
                drawLine(
                    color = color,
                    start = Offset(0f, size.height / 2),
                    end = Offset(size.width, size.height / 2),
                    strokeWidth = 2.5.dp.toPx(),
                    pathEffect = if (dashed) PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 3.dp.toPx())) else null,
                )
            }
            Spacer(Modifier.width(6.dp))
            Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Text(value, style = MaterialTheme.typography.titleLarge.tabular())
    }
}

@Composable
private fun OverviewSkeleton() {
    Column(Modifier.padding(horizontal = Gutter), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            repeat(2) { SkeletonBlock(Modifier.width(172.dp).height(150.dp), RoundedCornerShape(20.dp)) }
        }
        SkeletonBlock(Modifier.fillMaxWidth().height(320.dp), RoundedCornerShape(24.dp))
    }
}
