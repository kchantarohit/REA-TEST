package com.pulseboard.app.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.withContext
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.PI
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.random.Random

/**
 * Generates realistic, deterministic sample analytics. The same property, range and
 * filters always produce the same numbers; realtime data evolves as a seeded random walk.
 */
class DemoAnalyticsRepository(
    private val latencyMs: Long = 450,
    private val tickMs: Long = 3_000,
    private val today: () -> LocalDate = { LocalDate.now() },
) : AnalyticsRepository {

    private val demoProperties = listOf(
        Property("northwind", "Northwind Outfitters", "shop.northwind.example"),
        Property("fieldnotes", "Field Notes Journal", "fieldnotes.example"),
        Property("orbit", "Orbit Docs", "docs.orbit.example"),
    )

    private val scales = mapOf("northwind" to 1.0, "fieldnotes" to 0.38, "orbit" to 2.6)

    override fun properties(): List<Property> = demoProperties

    override fun realtime(propertyId: String): Flow<RealtimeSnapshot> = flow {
        val rnd = Random(seed(propertyId, "realtime"))
        val base = 44.0 * scaleOf(propertyId)
        var level = base
        val minutes = MutableList(MINUTES) {
            level = nextLevel(rnd, level, base)
            level.roundToInt()
        }
        delay(latencyMs)
        while (true) {
            emit(realtimeSnapshot(rnd, minutes.toList()))
            delay(tickMs)
            level = nextLevel(rnd, level, base)
            minutes.removeAt(0)
            minutes.add(level.roundToInt())
        }
    }.flowOn(Dispatchers.Default)

    override suspend fun overview(
        propertyId: String,
        range: DateRange,
        filters: Filters,
    ): OverviewData = withContext(Dispatchers.Default) {
        delay(latencyMs)
        val filterKey = filters.entries
            .sortedBy { it.key.ordinal }
            .joinToString(";") { "${it.key.name}=${it.value}" }
        val rnd = Random(seed(propertyId, range.name, filterKey))
        val scale = scaleOf(propertyId) * filterFactor(filters)
        val labels = dayLabels(range.days)

        val trends = Metric.entries.associateWith { metric ->
            TrendSeries(
                current = dailySeries(rnd, metric, range.days, scale, growth = rnd.nextDouble(-0.06, 0.24)),
                previous = dailySeries(rnd, metric, range.days, scale, growth = rnd.nextDouble(-0.08, 0.12)),
                labels = labels,
            )
        }
        val kpis = Metric.entries.map { metric ->
            val t = trends.getValue(metric)
            KpiSummary(
                metric = metric,
                value = aggregate(metric, t.current),
                previous = aggregate(metric, t.previous),
                sparkline = t.current,
            )
        }
        OverviewData(range, kpis, trends)
    }

    override suspend fun report(
        propertyId: String,
        type: ReportType,
        range: DateRange,
    ): ReportDetail = withContext(Dispatchers.Default) {
        delay(latencyMs)
        val rnd = Random(seed(propertyId, type.name, range.name))
        val volume = 3_200.0 * scaleOf(propertyId) * range.days * 0.55

        when (type) {
            ReportType.RETENTION -> {
                var rate = 100.0
                val rows = (1..8).map { week ->
                    rate *= if (week == 1) rnd.nextDouble(0.28, 0.36) else rnd.nextDouble(0.78, 0.9)
                    ReportRow("Week $week", listOf(volume * 0.4 * rate / 100.0, rate))
                }
                ReportDetail(
                    type = type,
                    range = range,
                    chartTitle = "Users returning, by week",
                    chartFormat = ValueFormat.PERCENT,
                    chartItems = rows.map { LabeledValue(it.dimension, it.values[1]) },
                    columns = listOf(
                        ReportColumn("Returning", ValueFormat.COUNT),
                        ReportColumn("Retained", ValueFormat.PERCENT),
                    ),
                    rows = rows,
                )
            }

            else -> {
                val dims = dimensionsFor(type)
                val weights = weights(rnd, dims.size)
                val rows = dims.mapIndexed { i, dim ->
                    val users = volume * weights[i]
                    val values = when (type) {
                        ReportType.ACQUISITION -> listOf(
                            users,
                            users * rnd.nextDouble(1.3, 1.7),
                            rnd.nextDouble(48.0, 74.0),
                            users * rnd.nextDouble(0.012, 0.04),
                        )
                        ReportType.ENGAGEMENT -> listOf(
                            users * rnd.nextDouble(1.8, 3.2),
                            users,
                            rnd.nextDouble(35.0, 260.0),
                        )
                        ReportType.TECH -> listOf(
                            users,
                            users * rnd.nextDouble(1.3, 1.6),
                            rnd.nextDouble(45.0, 72.0),
                        )
                        else -> listOf(
                            users,
                            users * rnd.nextDouble(0.25, 0.45),
                            users * rnd.nextDouble(1.3, 1.6),
                        )
                    }
                    ReportRow(dim, values)
                }
                ReportDetail(
                    type = type,
                    range = range,
                    chartTitle = if (type == ReportType.ENGAGEMENT) "Views by page" else "Users by ${type.dimensionLabel.lowercase()}",
                    chartFormat = ValueFormat.COUNT,
                    chartItems = rows.take(6).map { LabeledValue(it.dimension, it.values[0]) },
                    columns = columnsFor(type),
                    rows = rows,
                )
            }
        }
    }

    // ---- generation helpers -------------------------------------------------

    private fun realtimeSnapshot(rnd: Random, minutes: List<Int>): RealtimeSnapshot {
        val active = (minutes.sum() * 0.31).roundToInt().coerceAtLeast(1)
        fun split(labels: List<String>, weights: List<Double>, multiplier: Double = 1.0): List<LabeledValue> {
            val jittered = weights.map { it * rnd.nextDouble(0.9, 1.1) }
            val total = jittered.sum()
            return labels.indices
                .map { LabeledValue(labels[it], (active * multiplier * jittered[it] / total).roundToInt().toDouble()) }
                .sortedByDescending { it.value }
        }
        return RealtimeSnapshot(
            activeUsers = active,
            perMinute = minutes,
            devices = split(listOf("Mobile", "Desktop", "Tablet"), listOf(0.6, 0.34, 0.06)),
            topPages = split(PAGES, listOf(0.3, 0.2, 0.16, 0.13, 0.11, 0.1)).take(5),
            topCountries = split(COUNTRIES, listOf(0.34, 0.18, 0.13, 0.12, 0.12, 0.11)).take(5),
            topEvents = split(EVENTS, listOf(0.38, 0.24, 0.18, 0.12, 0.05, 0.03), multiplier = 6.0).take(5),
        )
    }

    private fun nextLevel(rnd: Random, level: Double, base: Double): Double =
        (level + (base - level) * 0.18 + rnd.nextDouble(-0.14, 0.14) * base).coerceAtLeast(base * 0.3)

    private fun dailySeries(rnd: Random, metric: Metric, days: Int, scale: Double, growth: Double): List<Float> {
        val base = baseDaily(metric) * if (metric.format == ValueFormat.DURATION) 1.0 else scale
        val phase = rnd.nextInt(7)
        return List(days) { i ->
            val weekly = 1.0 + 0.16 * sin(2 * PI * (i + phase) / 7.0)
            val trend = 1.0 + growth * i / days
            val noise = 1.0 + rnd.nextDouble(-0.07, 0.07)
            (base * weekly * trend * noise).toFloat().coerceAtLeast(0f)
        }
    }

    private fun baseDaily(metric: Metric): Double = when (metric) {
        Metric.ACTIVE_USERS -> 3_200.0
        Metric.NEW_USERS -> 1_150.0
        Metric.ENGAGEMENT_TIME -> 148.0
        Metric.SESSIONS -> 4_700.0
        Metric.CONVERSIONS -> 96.0
    }

    private fun aggregate(metric: Metric, daily: List<Float>): Double = when (metric) {
        Metric.ENGAGEMENT_TIME -> daily.average()
        // Users overlap across days, so period actives are less than the sum of dailies.
        Metric.ACTIVE_USERS -> daily.sum() * 0.55
        else -> daily.sum().toDouble()
    }

    private fun filterFactor(filters: Filters): Double = filters.entries.fold(1.0) { acc, (dim, value) ->
        acc * when (dim) {
            FilterDimension.DEVICE -> mapOf("Mobile" to 0.6, "Desktop" to 0.34, "Tablet" to 0.06)[value] ?: 0.3
            else -> 0.06 + value.hashCode().mod(28) / 100.0
        }
    }

    private fun weights(rnd: Random, count: Int): List<Double> {
        val raw = List(count) { i -> rnd.nextDouble(0.55, 1.0) * 0.7.pow(i) }
        val total = raw.sum()
        return raw.map { it / total }
    }

    private fun dimensionsFor(type: ReportType): List<String> = when (type) {
        ReportType.ACQUISITION -> FilterDimension.CHANNEL.options
        ReportType.ENGAGEMENT -> PAGES + listOf("/about", "/search")
        ReportType.TECH -> listOf("Android", "iOS", "Windows", "macOS", "Linux", "Other")
        else -> COUNTRIES + listOf("Canada", "Australia")
    }

    private fun columnsFor(type: ReportType): List<ReportColumn> = when (type) {
        ReportType.ACQUISITION -> listOf(
            ReportColumn("Users", ValueFormat.COUNT),
            ReportColumn("Sessions", ValueFormat.COUNT),
            ReportColumn("Engaged", ValueFormat.PERCENT),
            ReportColumn("Conv.", ValueFormat.COUNT),
        )
        ReportType.ENGAGEMENT -> listOf(
            ReportColumn("Views", ValueFormat.COUNT),
            ReportColumn("Users", ValueFormat.COUNT),
            ReportColumn("Avg time", ValueFormat.DURATION),
        )
        ReportType.TECH -> listOf(
            ReportColumn("Users", ValueFormat.COUNT),
            ReportColumn("Sessions", ValueFormat.COUNT),
            ReportColumn("Engaged", ValueFormat.PERCENT),
        )
        else -> listOf(
            ReportColumn("Users", ValueFormat.COUNT),
            ReportColumn("New", ValueFormat.COUNT),
            ReportColumn("Sessions", ValueFormat.COUNT),
        )
    }

    private fun dayLabels(days: Int): List<String> {
        val formatter = DateTimeFormatter.ofPattern("MMM d", Locale.getDefault())
        val end = today()
        return (days - 1 downTo 0).map { end.minusDays(it.toLong()).format(formatter) }
    }

    private fun scaleOf(propertyId: String): Double = scales[propertyId] ?: 1.0

    private fun seed(vararg parts: String): Int = parts.joinToString("|").hashCode()

    private companion object {
        const val MINUTES = 30
        val PAGES = listOf("/", "/collections/new", "/journal/field-guide", "/pricing", "/checkout", "/account")
        val COUNTRIES = listOf("United States", "India", "Germany", "Brazil", "United Kingdom", "Japan")
        val EVENTS = listOf("page_view", "scroll", "click", "session_start", "sign_up", "purchase")
    }
}
