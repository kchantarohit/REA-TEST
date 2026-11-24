package com.pulseboard.app.ui.overview

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pulseboard.app.data.AnalyticsRepository
import com.pulseboard.app.data.DateRange
import com.pulseboard.app.data.FilterDimension
import com.pulseboard.app.data.Filters
import com.pulseboard.app.data.Metric
import com.pulseboard.app.data.OverviewData
import com.pulseboard.app.data.SettingsStore
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class OverviewUiState(
    val range: DateRange = DateRange.LAST_28,
    val filters: Filters = emptyMap(),
    val selectedMetric: Metric = Metric.ACTIVE_USERS,
    val data: OverviewData? = null,
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val error: String? = null,
)

class OverviewViewModel(
    private val repository: AnalyticsRepository,
    private val settings: SettingsStore,
) : ViewModel() {

    private val _state = MutableStateFlow(OverviewUiState())
    val state: StateFlow<OverviewUiState> = _state.asStateFlow()
    private var loadJob: Job? = null

    init {
        viewModelScope.launch {
            settings.propertyId.collect {
                _state.update { it.copy(data = null) }
                load()
            }
        }
    }

    fun setRange(range: DateRange) {
        if (range == _state.value.range) return
        _state.update { it.copy(range = range) }
        load()
    }

    fun setFilter(dimension: FilterDimension, value: String?) {
        _state.update {
            it.copy(filters = if (value == null) it.filters - dimension else it.filters + (dimension to value))
        }
        load()
    }

    fun clearFilters() {
        if (_state.value.filters.isEmpty()) return
        _state.update { it.copy(filters = emptyMap()) }
        load()
    }

    fun selectMetric(metric: Metric) = _state.update { it.copy(selectedMetric = metric) }

    fun refresh() = load(refreshing = true)

    private fun load(refreshing: Boolean = false) {
        loadJob?.cancel()
        _state.update { it.copy(isLoading = true, isRefreshing = refreshing, error = null) }
        loadJob = viewModelScope.launch {
            val request = _state.value
            try {
                val data = repository.overview(settings.propertyId.value, request.range, request.filters)
                _state.update { it.copy(data = data, isLoading = false, isRefreshing = false) }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                _state.update {
                    it.copy(isLoading = false, isRefreshing = false, error = e.message ?: "Couldn't load overview")
                }
            }
        }
    }
}
