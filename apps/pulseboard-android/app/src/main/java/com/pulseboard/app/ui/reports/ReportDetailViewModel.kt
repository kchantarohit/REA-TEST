package com.pulseboard.app.ui.reports

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pulseboard.app.data.AnalyticsRepository
import com.pulseboard.app.data.DateRange
import com.pulseboard.app.data.ReportDetail
import com.pulseboard.app.data.ReportType
import com.pulseboard.app.data.SettingsStore
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ReportUiState(
    val range: DateRange = DateRange.LAST_28,
    val detail: ReportDetail? = null,
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val error: String? = null,
)

class ReportDetailViewModel(
    val type: ReportType,
    private val repository: AnalyticsRepository,
    private val settings: SettingsStore,
) : ViewModel() {

    private val _state = MutableStateFlow(ReportUiState())
    val state: StateFlow<ReportUiState> = _state.asStateFlow()
    private var loadJob: Job? = null

    init {
        viewModelScope.launch {
            settings.propertyId.collect {
                _state.update { it.copy(detail = null) }
                load()
            }
        }
    }

    fun setRange(range: DateRange) {
        if (range == _state.value.range) return
        _state.update { it.copy(range = range) }
        load()
    }

    fun refresh() = load(refreshing = true)

    private fun load(refreshing: Boolean = false) {
        loadJob?.cancel()
        _state.update { it.copy(isLoading = true, isRefreshing = refreshing, error = null) }
        loadJob = viewModelScope.launch {
            val range = _state.value.range
            try {
                val detail = repository.report(settings.propertyId.value, type, range)
                _state.update { it.copy(detail = detail, isLoading = false, isRefreshing = false) }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                _state.update {
                    it.copy(isLoading = false, isRefreshing = false, error = e.message ?: "Couldn't load report")
                }
            }
        }
    }
}
