package com.pulseboard.app.ui.realtime

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext

/** Returns a function that vibrates the device once (no-op when there is no vibrator). */
@Composable
fun rememberAlertHaptics(): () -> Unit {
    val context = LocalContext.current.applicationContext
    return remember(context) { { vibrateOnce(context) } }
}

private fun vibrateOnce(context: Context) {
    val vibrator = defaultVibrator(context) ?: return
    if (!vibrator.hasVibrator()) return
    runCatching { vibrator.vibrate(VibrationEffect.createOneShot(200L, VibrationEffect.DEFAULT_AMPLITUDE)) }
}

@Suppress("DEPRECATION")
private fun defaultVibrator(context: Context): Vibrator? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
    } else {
        context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    }
