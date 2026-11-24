package com.pulseboard.app.data

import com.pulseboard.app.ui.reports.sortRows
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class DemoAnalyticsRepositoryTest {
    private val repo = DemoAnalyticsRepository(latencyMs = 0, tickMs = 0, today = { LocalDate.of(2026, 3, 1) })
    private val property = repo.properties().first().id

    @Test
    fun overviewIsDeterministicAndShaped() = runTest {
        val a = repo.overview(property, DateRange.LAST_28, emptyMap())
        val b = repo.overview(property, DateRange.LAST_28, emptyMap())
        assertEquals(a, b)
        assertEquals(Metric.entries.size, a.kpis.size)
        a.trends.values.forEach {
            assertEquals(28, it.current.size)
            assertEquals(28, it.previous.size)
            assertEquals(28, it.labels.size)
        }
    }

    @Test
    fun filtersShrinkCounts() = runTest {
        val all = repo.overview(property, DateRange.LAST_7, emptyMap())
        val tablet = repo.overview(property, DateRange.LAST_7, mapOf(FilterDimension.DEVICE to "Tablet"))
        val users = { d: OverviewData -> d.kpis.first { it.metric == Metric.ACTIVE_USERS }.value }
        assertTrue(users(tablet) < users(all))
    }

    @Test
    fun realtimeHasThirtyMinutes() = runTest {
        val snapshot = repo.realtime(property).first()
        assertEquals(30, snapshot.perMinute.size)
        assertTrue(snapshot.activeUsers > 0)
    }

    @Test
    fun reportRowsMatchColumns() = runTest {
        ReportType.entries.forEach { type ->
            val detail = repo.report(property, type, DateRange.LAST_28)
            assertTrue(detail.rows.isNotEmpty())
            detail.rows.forEach { assertEquals(detail.columns.size, it.values.size) }
        }
    }

    @Test
    fun sortRowsByValueAndName() {
        val rows = listOf(ReportRow("b", listOf(2.0)), ReportRow("a", listOf(3.0)), ReportRow("c", listOf(1.0)))
        assertEquals(listOf("a", "b", "c"), sortRows(rows, 1, ascending = false).map { it.dimension })
        assertEquals(listOf("a", "b", "c"), sortRows(rows, 0, ascending = true).map { it.dimension })
    }
}
