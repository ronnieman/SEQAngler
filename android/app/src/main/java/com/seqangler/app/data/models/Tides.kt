package com.seqangler.app.data.models

import com.google.gson.annotations.SerializedName

data class TideEvent(
    val time: String,
    val height: Double,
    val type: String
)

data class DailyTides(
    val date: String,
    @SerializedName("day_name") val dayName: String,
    val tides: List<TideEvent>,
    val sunrise: String,
    val sunset: String,
    @SerializedName("moon_phase") val moonPhase: String,
    @SerializedName("fishing_rating") val fishingRating: String
)

data class SevenDayTides(
    val days: List<DailyTides>,
    @SerializedName("updated_at") val updatedAt: String
)

data class MoonPhase(
    val phase: String,
    val illumination: Int,
    @SerializedName("phase_icon") val phaseIcon: String,
    @SerializedName("days_until_full") val daysUntilFull: Int,
    @SerializedName("days_until_new") val daysUntilNew: Int,
    @SerializedName("fishing_rating") val fishingRating: String,
    @SerializedName("fishing_tip") val fishingTip: String,
    @SerializedName("updated_at") val updatedAt: String
)

data class TidalFlow(
    @SerializedName("current_speed") val currentSpeed: Double,
    @SerializedName("current_direction") val currentDirection: String,
    @SerializedName("flow_state") val flowState: String,
    @SerializedName("water_temp") val waterTemp: Double,
    @SerializedName("next_slack") val nextSlack: String,
    @SerializedName("updated_at") val updatedAt: String
)
