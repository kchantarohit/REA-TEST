package com.pulseboard.app.ui.reports

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowDownward
import androidx.compose.material.icons.rounded.ArrowUpward
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pulseboard.app.data.ReportDetail
import com.pulseboard.app.data.ReportRow
import com.pulseboard.app.data.ReportType
import com.pulseboard.app.ui.components.ErrorCard
import com.pulseboard.app.ui.components.Gutter
import com.pulseboard.app.ui.components.HorizontalBarList
import com.pulseboard.app.ui.components.PulseCard
import com.pulseboard.app.ui.components.RangeSelector
import com.pulseboard.app.ui.components.ScreenScaffold
import com.pulseboard.app.ui.components.SkeletonBlock
import com.pulseboard.app.ui.components.formatValue
import com.pulseboard.app.ui.theme.tabular

/** Column 0 sorts by the dimension name; column n (n >= 1) sorts by values[n - 1]. */
fun sortRows(rows: List<ReportRow>, column: Int, ascending: Boolean): List<ReportRow> {
    val sorted = if (column == 0) {
        rows.sortedWith(compareBy(String.CASE_INSENSITIVE_ORDER) { it.dimension })
    } else {
        rows.sortedBy { it.values.getOrElse(column - 1) { 0.0 } }
    }
    return if (ascending) sorted else sorted.reversed()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReportDetailScreen(viewModel: ReportDetailViewModel, onBack: () -> Unit) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    ScreenScaffold(title = viewModel.type.title, onBack = onBack) { padding ->
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
                item { RangeSelector(selected = state.range, onSelect = viewModel::setRange) }
                item {
                    Box(Modifier.fillMaxWidth().height(3.dp)) {
                        if (state.isLoading && !state.isRefreshing && state.detail != null) {
                            LinearProgressIndicator(Modifier.fillMaxSize())
                        }
                    }
                }
                state.error?.let { message ->
                    item { ErrorCard(message, onRetry = viewModel::refresh) }
                }
                val detail = state.detail
                if (detail == null) {
                    if (state.error == null) {
                        item {
                            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                SkeletonBlock(Modifier.fillMaxWidth().height(280.dp), RoundedCornerShape(24.dp))
                                SkeletonBlock(Modifier.fillMaxWidth().height(360.dp), RoundedCornerShape(24.dp))
                            }
                        }
                    }
                } else {
                    item {
                        PulseCard(Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(20.dp)) {
                                Text(detail.chartTitle, style = MaterialTheme.typography.titleMedium)
                                Text(
                                    detail.range.longLabel,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                                Spacer(Modifier.height(16.dp))
                                HorizontalBarList(items = detail.chartItems, format = detail.chartFormat)
                            }
                        }
                    }
                    item { ReportTable(detail) }
                }
            }
        }
    }
}

@Composable
private fun ReportTable(detail: ReportDetail) {
    val defaultColumn = if (detail.type == ReportType.RETENTION) 0 else 1
    var sortColumn by rememberSaveable(detail.type) { mutableIntStateOf(defaultColumn) }
    var ascending by rememberSaveable(detail.type) { mutableStateOf(detail.type == ReportType.RETENTION) }
    val rows = remember(detail, sortColumn, ascending) { sortRows(detail.rows, sortColumn, ascending) }
    val headers = listOf(detail.type.dimensionLabel) + detail.columns.map { it.label }

    fun onHeaderClick(column: Int) {
        if (column == sortColumn) {
            ascending = !ascending
        } else {
            sortColumn = column
            ascending = column == 0
        }
    }

    PulseCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(vertical = 8.dp)) {
            Row(
                Modifier.padding(horizontal = 12.dp).heightIn(min = 48.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                headers.forEachIndexed { column, label ->
                    HeaderCell(
                        label = label,
                        isDimension = column == 0,
                        active = column == sortColumn,
                        ascending = ascending,
                        onClick = { onHeaderClick(column) },
                    )
                }
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            rows.forEachIndexed { index, row ->
                Row(
                    Modifier
                        .padding(horizontal = 12.dp)
                        .heightIn(min = 48.dp)
                        .semantics(mergeDescendants = true) {},
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        row.dimension,
                        modifier = Modifier.weight(DIMENSION_WEIGHT).padding(horizontal = 4.dp),
                        style = MaterialTheme.typography.bodyMedium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    row.values.forEachIndexed { i, value ->
                        Text(
                            formatValue(detail.columns[i].format, value),
                            modifier = Modifier.weight(1f).padding(horizontal = 4.dp),
                            style = MaterialTheme.typography.bodyMedium.tabular(),
                            textAlign = TextAlign.End,
                            maxLines = 1,
                        )
                    }
                }
                if (index < rows.lastIndex) {
                    HorizontalDivider(
                        modifier = Modifier.padding(horizontal = 16.dp),
                        color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f),
                    )
                }
            }
        }
    }
}

@Composable
private fun RowScope.HeaderCell(
    label: String,
    isDimension: Boolean,
    active: Boolean,
    ascending: Boolean,
    onClick: () -> Unit,
) {
    val color = if (active) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
    val state = if (active) (if (ascending) ", sorted ascending" else ", sorted descending") else ""
    Row(
        modifier = Modifier
            .weight(if (isDimension) DIMENSION_WEIGHT else 1f)
            .heightIn(min = 48.dp)
            .clickable(role = Role.Button, onClick = onClick)
            .padding(horizontal = 4.dp)
            .clearAndSetSemantics { contentDescription = "Sort by $label$state" },
        horizontalArrangement = if (isDimension) Arrangement.Start else Arrangement.End,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            label,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = if (active) FontWeight.SemiBold else FontWeight.Medium,
            color = color,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f, fill = false),
        )
        if (active) {
            Icon(
                if (ascending) Icons.Rounded.ArrowUpward else Icons.Rounded.ArrowDownward,
                contentDescription = null,
                tint = color,
                modifier = Modifier.size(14.dp),
            )
        }
    }
}

private const val DIMENSION_WEIGHT = 1.5f
