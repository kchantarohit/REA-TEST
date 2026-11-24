package com.pulseboard.app.data

import kotlin.math.max
import kotlin.math.sqrt

enum class AnomalyKind { SPIKE, DROP }

/** A minute whose value deviates from the rolling mean of the minutes before it. */
data class Anomaly(val index: Int, val kind: AnomalyKind, val mean: Double, val sigmas: Double)

/**
 * Flags values more than [threshold] standard deviations from the mean of the previous
 * [window] values. The deviation floor (5% of the mean) keeps near-flat series from
 * flagging ordinary noise.
 */
fun detectAnomalies(values: List<Int>, window: Int = 10, threshold: Double = 2.0): List<Anomaly> {
    val out = mutableListOf<Anomaly>()
    for (i in window until values.size) {
        val ref = values.subList(i - window, i)
        val mean = ref.average()
        val sd = sqrt(ref.sumOf { (it - mean) * (it - mean) } / ref.size)
        val z = (values[i] - mean) / max(sd, max(mean * 0.05, 1.0))
        when {
            z > threshold -> out += Anomaly(i, AnomalyKind.SPIKE, mean, z)
            z < -threshold -> out += Anomaly(i, AnomalyKind.DROP, mean, z)
        }
    }
    return out
}
