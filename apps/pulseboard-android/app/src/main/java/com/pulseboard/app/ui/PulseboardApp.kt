package com.pulseboard.app.ui

import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Assessment
import androidx.compose.material.icons.rounded.Dashboard
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material.icons.rounded.Speed
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.pulseboard.app.AppContainer
import com.pulseboard.app.data.ReportType
import com.pulseboard.app.ui.overview.OverviewScreen
import com.pulseboard.app.ui.overview.OverviewViewModel
import com.pulseboard.app.ui.realtime.RealtimeScreen
import com.pulseboard.app.ui.realtime.RealtimeViewModel
import com.pulseboard.app.ui.reports.ReportDetailScreen
import com.pulseboard.app.ui.reports.ReportDetailViewModel
import com.pulseboard.app.ui.reports.ReportsScreen
import com.pulseboard.app.ui.settings.SettingsScreen

private enum class TopDestination(val route: String, val label: String, val icon: ImageVector) {
    REALTIME("realtime", "Realtime", Icons.Rounded.Speed),
    OVERVIEW("overview", "Overview", Icons.Rounded.Dashboard),
    REPORTS("reports", "Reports", Icons.Rounded.Assessment),
    SETTINGS("settings", "Settings", Icons.Rounded.Settings),
}

private const val REPORT_ROUTE = "report/{type}"

@Composable
fun PulseboardApp(container: AppContainer) {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val route = backStackEntry?.destination?.route
    val selectedRoute = if (route == REPORT_ROUTE) TopDestination.REPORTS.route else route

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        bottomBar = {
            NavigationBar(containerColor = MaterialTheme.colorScheme.surfaceContainer) {
                TopDestination.entries.forEach { destination ->
                    NavigationBarItem(
                        selected = selectedRoute == destination.route,
                        onClick = {
                            navController.navigate(destination.route) {
                                popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(destination.icon, contentDescription = null) },
                        label = { Text(destination.label) },
                    )
                }
            }
        },
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = TopDestination.REALTIME.route,
            modifier = Modifier.padding(innerPadding),
            enterTransition = { fadeIn(tween(220)) },
            exitTransition = { fadeOut(tween(160)) },
        ) {
            composable(TopDestination.OVERVIEW.route) {
                val vm = viewModel { OverviewViewModel(container.repository, container.settings) }
                OverviewScreen(vm)
            }
            composable(TopDestination.REALTIME.route) {
                val vm = viewModel { RealtimeViewModel(container.repository, container.settings) }
                RealtimeScreen(vm)
            }
            composable(TopDestination.REPORTS.route) {
                ReportsScreen(onOpen = { type -> navController.navigate("report/${type.name}") })
            }
            composable(
                REPORT_ROUTE,
                arguments = listOf(navArgument("type") { type = NavType.StringType }),
            ) { entry ->
                val typeName = entry.arguments?.getString("type")
                val type = ReportType.entries.firstOrNull { it.name == typeName } ?: ReportType.ACQUISITION
                val vm = viewModel(key = type.name) {
                    ReportDetailViewModel(type, container.repository, container.settings)
                }
                ReportDetailScreen(vm, onBack = { navController.popBackStack() })
            }
            composable(TopDestination.SETTINGS.route) {
                SettingsScreen(container.settings, container.repository.properties())
            }
        }
    }
}
