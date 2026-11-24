package com.pulseboard.app

import android.app.Application
import android.content.Context
import com.pulseboard.app.data.AnalyticsRepository
import com.pulseboard.app.data.DemoAnalyticsRepository
import com.pulseboard.app.data.SettingsStore

class PulseboardApplication : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}

/** Manual dependency wiring. Swap [repository] for a live implementation later. */
class AppContainer(context: Context) {
    val repository: AnalyticsRepository = DemoAnalyticsRepository()
    val settings = SettingsStore(context, repository.properties().map { it.id })
}
