package com.pulseboard.app.data

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** When the launch was marked and the active-user baseline at that moment. */
data class LaunchMark(val atMillis: Long, val baseline: Int)

enum class ThemeMode(val label: String) { SYSTEM("System"), LIGHT("Light"), DARK("Dark") }

/** Small persisted user preferences backed by SharedPreferences. */
class SettingsStore(context: Context, validPropertyIds: List<String>) {
    private val prefs = context.getSharedPreferences("pulseboard_settings", Context.MODE_PRIVATE)

    private val _themeMode = MutableStateFlow(
        prefs.getString(KEY_THEME, null)
            ?.let { stored -> ThemeMode.entries.firstOrNull { it.name == stored } }
            ?: ThemeMode.SYSTEM,
    )
    val themeMode: StateFlow<ThemeMode> = _themeMode.asStateFlow()

    private val _propertyId = MutableStateFlow(
        prefs.getString(KEY_PROPERTY, null)?.takeIf { it in validPropertyIds } ?: validPropertyIds.first(),
    )
    val propertyId: StateFlow<String> = _propertyId.asStateFlow()

    private val _launch = MutableStateFlow(
        if (prefs.contains(KEY_LAUNCH_AT)) {
            LaunchMark(prefs.getLong(KEY_LAUNCH_AT, 0L), prefs.getInt(KEY_LAUNCH_BASELINE, 0))
        } else {
            null
        },
    )
    val launch: StateFlow<LaunchMark?> = _launch.asStateFlow()

    private val _alertThreshold = MutableStateFlow(
        prefs.getInt(KEY_THRESHOLD, 0).takeIf { it > 0 },
    )
    /** Active-user count that triggers the alert, or null when the alert is off. */
    val alertThreshold: StateFlow<Int?> = _alertThreshold.asStateFlow()

    fun markLaunch(mark: LaunchMark) {
        _launch.value = mark
        prefs.edit().putLong(KEY_LAUNCH_AT, mark.atMillis).putInt(KEY_LAUNCH_BASELINE, mark.baseline).apply()
    }

    fun clearLaunch() {
        _launch.value = null
        prefs.edit().remove(KEY_LAUNCH_AT).remove(KEY_LAUNCH_BASELINE).apply()
    }

    fun setAlertThreshold(value: Int?) {
        val clean = value?.takeIf { it > 0 }
        _alertThreshold.value = clean
        prefs.edit().putInt(KEY_THRESHOLD, clean ?: 0).apply()
    }

    fun setThemeMode(mode: ThemeMode) {
        _themeMode.value = mode
        prefs.edit().putString(KEY_THEME, mode.name).apply()
    }

    fun setPropertyId(id: String) {
        _propertyId.value = id
        prefs.edit().putString(KEY_PROPERTY, id).apply()
    }

    private companion object {
        const val KEY_THEME = "theme_mode"
        const val KEY_PROPERTY = "property_id"
        const val KEY_LAUNCH_AT = "launch_at"
        const val KEY_LAUNCH_BASELINE = "launch_baseline"
        const val KEY_THRESHOLD = "alert_threshold"
    }
}
