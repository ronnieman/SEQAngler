package com.seqangler.app.data.models

import com.google.gson.annotations.SerializedName

data class Species(
    val id: String,
    val name: String,
    @SerializedName("scientific_name") val scientificName: String,
    val description: String,
    @SerializedName("min_size") val minSize: Int,
    @SerializedName("bag_limit") val bagLimit: Int,
    @SerializedName("best_bait") val bestBait: List<String>,
    @SerializedName("best_locations") val bestLocations: List<String>,
    @SerializedName("best_time") val bestTime: String,
    @SerializedName("closed_season") val closedSeason: String?,
    val difficulty: String,
    @SerializedName("average_weight") val averageWeight: String,
    @SerializedName("record_weight") val recordWeight: String,
    @SerializedName("eating_quality") val eatingQuality: Int,
    @SerializedName("image_url") val imageUrl: String? = null
)

data class ClosedSeasons(
    val count: Int,
    val species: List<String>
)
