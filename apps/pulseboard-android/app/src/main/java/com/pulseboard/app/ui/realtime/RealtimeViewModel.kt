package com.pulseboard.app.ui.realtime

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pulseboard.app.data.AnalyticsRepository
import com.pulseboard.app.data.LaunchMark
import com.pulseboard.app.data.LiveEvent
import com.pulseboard.app.data.RealtimeSnapshot
import com.pulseboard.app.data.SettingsStore
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class RealtimeUiState(
    val propertyName: String = "",
    val snapshot: RealtimeSnapshot? = null,
    val events: List<LiveEvent> = emptyList(),
    val launch: LaunchMark? = null,
    val threshold: Int? = null,
    val isRefreshing: Boolean = false,
    val error: String? = null,
) {
    val isAboveThreshold: Boolean
        get() = threshold != null && snapshot != null && snapshot.activeUsers >= threshold
}

class RealtimeViewModel(
    private val repository: AnalyticsRepository,
    private val settings: SettingsStore,
    private val now: () -> Long = { System.currentTimeMillis() },
) : ViewModel() {

    private val _state = MutableStateFlow(RealtimeUiState())
    val state: StateFlow<RealtimeUiState> = _state.asStateFlow()

    private val _alerts = MutableSharedFlow<Int>(extraBufferCapacity = 1)
    /** Emits the active-user count each time it rises across the alert threshold. */
    val alerts: SharedFlow<Int> = _alerts.asSharedFlow()

    private var streamJob: Job? = null
    private var eventsJob: Job? = null

    init {
        viewModelScope.launch {
            settings.propertyId.collect { id ->
                _state.update {
                    RealtimeUiState(
                        propertyName = repository.properties().firstOrNull { p -> p.id == id }?.name.orEmpty(),
                        launch = it.launch,
                        threshold = it.threshold,
                    )
                }
                connect(id)
            }
        }
        viewModelScope.launch { settings.launch.collect { l -> _state.update { it.copy(launch = l) } } }
        viewModelScope.launch { settings.alertThreshold.collect { t -> _state.update { it.copy(threshold = t) } } }
    }

    /** Reconnects the live streams (pull-to-refresh and retry). */
    fun refresh() {
        _state.update { it.copy(isRefreshing = it.snapshot != null, error = null) }
        connect(settings.propertyId.value)
    }

    fun markLaunch() {
        val snapshot = _state.value.snapshot ?: return
        settings.markLaunch(LaunchMark(atMillis = now(), baseline = snapshot.baselineActive))
    }

    fun resetLaunch() = settings.clearLaunch()

    fun setThreshold(value: Int?) = settings.setAlertThreshold(value)

    private fun connect(propertyId: String) {
        streamJob?.cancel()
        eventsJob?.cancel()
        streamJob = viewModelScope.launch {
            repository.realtime(propertyId)
                .catch { e ->
                    _state.update { it.copy(isRefreshing = false, error = e.message ?: "Live updates stopped") }
                }
                .collect { snapshot ->
                    val previous = _state.value.snapshot?.activeUsers
                    val threshold = settings.alertThreshold.value
                    if (threshold != null && previous != null && previous < threshold && snapshot.activeUsers >= threshold) {
                        _alerts.tryEmit(snapshot.activeUsers)
                    }
                    _state.update { it.copy(snapshot = snapshot, isRefreshing = false, error = null) }
                }
        }
        eventsJob = viewModelScope.launch {
            repository.events(propertyId)
                .catch { /* The feed is secondary; the main stream reports errors. */ }
                .collect { event ->
                    _state.update { it.copy(events = (listOf(event) + it.events).take(MAX_EVENTS)) }
                }
        }
    }

    private companion object {
        const val MAX_EVENTS = 40
    }
}
