package com.pulseboard.app.data

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

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
    }
}
