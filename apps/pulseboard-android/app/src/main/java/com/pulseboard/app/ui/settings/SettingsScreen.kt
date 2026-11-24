package com.pulseboard.app.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pulseboard.app.BuildConfig
import com.pulseboard.app.data.Property
import com.pulseboard.app.data.SettingsStore
import com.pulseboard.app.data.ThemeMode
import com.pulseboard.app.ui.components.Gutter
import com.pulseboard.app.ui.components.PulseCard
import com.pulseboard.app.ui.components.ScreenScaffold
import com.pulseboard.app.ui.components.SectionLabel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(settings: SettingsStore, properties: List<Property>) {
    val themeMode by settings.themeMode.collectAsStateWithLifecycle()
    val propertyId by settings.propertyId.collectAsStateWithLifecycle()

    ScreenScaffold(title = "Settings") { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(start = Gutter, end = Gutter, top = 4.dp, bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item { SectionLabel("Appearance") }
            item {
                PulseCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(20.dp)) {
                        Text("Theme", style = MaterialTheme.typography.titleMedium)
                        Text(
                            "System follows your device setting",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(16.dp))
                        val modes = ThemeMode.entries
                        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                            modes.forEachIndexed { index, mode ->
                                SegmentedButton(
                                    selected = mode == themeMode,
                                    onClick = { settings.setThemeMode(mode) },
                                    shape = SegmentedButtonDefaults.itemShape(index = index, count = modes.size),
                                    label = { Text(mode.label) },
                                )
                            }
                        }
                    }
                }
            }

            item { SectionLabel("Property") }
            item {
                PulseCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(vertical = 8.dp).selectableGroup()) {
                        properties.forEach { property ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .heightIn(min = 64.dp)
                                    .selectable(
                                        selected = property.id == propertyId,
                                        onClick = { settings.setPropertyId(property.id) },
                                        role = Role.RadioButton,
                                    )
                                    .padding(horizontal = 20.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                RadioButton(selected = property.id == propertyId, onClick = null)
                                Spacer(Modifier.width(16.dp))
                                Column {
                                    Text(property.name, style = MaterialTheme.typography.bodyLarge)
                                    Text(
                                        property.domain,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }
                        }
                    }
                }
            }

            item { SectionLabel("About") }
            item {
                PulseCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Pulseboard", style = MaterialTheme.typography.titleMedium)
                        Text(
                            "Version ${BuildConfig.VERSION_NAME}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            "All numbers are demo data generated on this device. Pulseboard has no account, " +
                                "makes no network requests and collects nothing. A live analytics source can be " +
                                "connected later without changing the screens.",
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
            }
        }
    }
}
