package com.pulseboard.app.data

import kotlinx.coroutines.flow.Flow

/**
 * Source of analytics data for the UI.
 *
 * [DemoAnalyticsRepository] generates sample data on-device. A live implementation
 * (for example one backed by a reporting API) only needs to implement this interface
 * and be wired in [com.pulseboard.app.AppContainer].
 */
interface AnalyticsRepository {
    fun properties(): List<Property>

    /** Emits a fresh snapshot every few seconds until the collector is cancelled. */
    fun realtime(propertyId: String): Flow<RealtimeSnapshot>

    /** Emits individual incoming events as they happen, until cancelled. */
    fun events(propertyId: String): Flow<LiveEvent>

    suspend fun overview(propertyId: String, range: DateRange, filters: Filters): OverviewData

    suspend fun report(propertyId: String, type: ReportType, range: DateRange): ReportDetail
}
