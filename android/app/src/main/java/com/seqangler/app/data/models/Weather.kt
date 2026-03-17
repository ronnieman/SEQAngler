package com.seqangler.app.data.models

import com.google.gson.annotations.SerializedName

data class Weather(
    val temperature: Double,
    @SerializedName("wind_speed") val windSpeed: Double,
    @SerializedName("wind_direction") val windDirection: String,
    val humidity: Int,
    val conditions: String,
    @SerializedName("uv_index") val uvIndex: Int,
    @SerializedName("updated_at") val updatedAt: String
)

data class MarineWeather(
    @SerializedName("wave_height") val waveHeight: Double,
    @SerializedName("wave_direction") val waveDirection: String,
    @SerializedName("wave_period") val wavePeriod: Double,
    @SerializedName("swell_height") val swellHeight: Double,
    @SerializedName("swell_direction") val swellDirection: String,
    @SerializedName("swell_period") val swellPeriod: Double,
    @SerializedName("sea_state") val seaState: String,
    @SerializedName("boating_advisory") val boatingAdvisory: String,
    @SerializedName("updated_at") val updatedAt: String
)

data class FishingConditions(
    @SerializedName("overall_score") val overallScore: Int,
    @SerializedName("weather_score") val weatherScore: Int,
    @SerializedName("tide_score") val tideScore: Int,
    @SerializedName("moon_score") val moonScore: Int,
    @SerializedName("solunar_score") val solunarScore: Int,
    @SerializedName("conditions_summary") val conditionsSummary: String,
    @SerializedName("best_time_today") val bestTimeToday: String
)

data class DailyForecast(
    val date: String,
    @SerializedName("day_name") val dayName: String,
    @SerializedName("temp_max") val tempMax: Double,
    @SerializedName("temp_min") val tempMin: Double,
    val conditions: String,
    @SerializedName("weather_icon") val weatherIcon: String,
    @SerializedName("wind_speed") val windSpeed: Double,
    @SerializedName("wind_direction") val windDirection: String,
    @SerializedName("precipitation_chance") val precipitationChance: Int,
    @SerializedName("uv_index") val uvIndex: Int,
    @SerializedName("fishing_rating") val fishingRating: String
)

data class SevenDayForecast(
    val days: List<DailyForecast>,
    @SerializedName("updated_at") val updatedAt: String
)
