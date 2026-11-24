package com.pulseboard.app.ui.realtime

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pulseboard.app.data.AnalyticsRepository
import com.pulseboard.app.data.RealtimeSnapshot
import com.pulseboard.app.data.SettingsStore
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class RealtimeUiState(
    val snapshot: RealtimeSnapshot? = null,
    val isRefreshing: Boolean = false,
    val error: String? = null,
)

class RealtimeViewModel(
    private val repository: AnalyticsRepository,
    private val settings: SettingsStore,
) : ViewModel() {

    private val _state = MutableStateFlow(RealtimeUiState())
    val state: StateFlow<RealtimeUiState> = _state.asStateFlow()
    private var streamJob: Job? = null

    init {
        viewModelScope.launch {
            settings.propertyId.collect { id ->
                _state.value = RealtimeUiState()
                connect(id)
            }
        }
    }

    /** Reconnects the live stream (pull-to-refresh and retry). */
    fun refresh() {
        _state.update { it.copy(isRefreshing = it.snapshot != null, error = null) }
        connect(settings.propertyId.value)
    }

    private fun connect(propertyId: String) {
        streamJob?.cancel()
        streamJob = viewModelScope.launch {
            repository.realtime(propertyId)
                .catch { e ->
                    _state.update {
                        it.copy(isRefreshing = false, error = e.message ?: "Live updates stopped")
                    }
                }
                .collect { snapshot ->
                    _state.update { it.copy(snapshot = snapshot, isRefreshing = false, error = null) }
                }
        }
    }
}
