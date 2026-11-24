package com.pulseboard.app.data

/** How a numeric value should be rendered. */
enum class ValueFormat { COUNT, PERCENT, DURATION }

enum class DateRange(val days: Int, val shortLabel: String, val longLabel: String) {
    LAST_7(7, "7 days", "Last 7 days"),
    LAST_28(28, "28 days", "Last 28 days"),
    LAST_90(90, "90 days", "Last 90 days"),
}

enum class Metric(val label: String, val format: ValueFormat = ValueFormat.COUNT) {
    ACTIVE_USERS("Active users"),
    NEW_USERS("New users"),
    ENGAGEMENT_TIME("Avg engagement", ValueFormat.DURATION),
    SESSIONS("Sessions"),
    CONVERSIONS("Conversions"),
}

enum class FilterDimension(val label: String, val options: List<String>) {
    COUNTRY("Country", listOf("United States", "India", "Germany", "Brazil", "Japan", "United Kingdom")),
    DEVICE("Device", listOf("Mobile", "Desktop", "Tablet")),
    CHANNEL("Channel", listOf("Organic search", "Direct", "Social", "Referral", "Email", "Paid search")),
}

typealias Filters = Map<FilterDimension, String>

data class LabeledValue(val label: String, val value: Double)

data class KpiSummary(
    val metric: Metric,
    val value: Double,
    val previous: Double,
    val sparkline: List<Float>,
) {
    val deltaPercent: Double
        get() = if (previous == 0.0) 0.0 else (value - previous) / previous * 100.0
}

/** Daily points for the selected period and the equally long period before it. */
data class TrendSeries(
    val current: List<Float>,
    val previous: List<Float>,
    val labels: List<String>,
)

data class OverviewData(
    val range: DateRange,
    val kpis: List<KpiSummary>,
    val trends: Map<Metric, TrendSeries>,
)

data class RealtimeSnapshot(
    val activeUsers: Int,
    /** Typical active users implied by the whole 30-minute window (used as the rolling baseline). */
    val baselineActive: Int,
    /** Users per minute, oldest first; the last entry is the current minute. */
    val perMinute: List<Int>,
    val devices: List<LabeledValue>,
    val topPages: List<LabeledValue>,
    val topCountries: List<LabeledValue>,
    val topEvents: List<LabeledValue>,
)

/** One incoming event for the live feed. */
data class LiveEvent(val id: Long, val timeMillis: Long, val name: String, val detail: String)

enum class ReportType(val title: String, val subtitle: String, val dimensionLabel: String) {
    ACQUISITION("Acquisition", "Which channels bring users in", "Channel"),
    ENGAGEMENT("Engagement", "Pages people view and stay on", "Page"),
    RETENTION("Retention", "How many users come back each week", "Cohort week"),
    TECH("Tech & devices", "Platforms your audience uses", "Platform"),
    GEOGRAPHY("Geography", "Where your users are", "Country"),
}

data class ReportColumn(val label: String, val format: ValueFormat)

data class ReportRow(val dimension: String, val values: List<Double>)

data class ReportDetail(
    val type: ReportType,
    val range: DateRange,
    val chartTitle: String,
    val chartFormat: ValueFormat,
    val chartItems: List<LabeledValue>,
    val columns: List<ReportColumn>,
    val rows: List<ReportRow>,
)

data class Property(val id: String, val name: String, val domain: String)
