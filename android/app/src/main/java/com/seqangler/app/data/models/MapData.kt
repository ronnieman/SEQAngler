package com.seqangler.app.data.models

import com.google.gson.annotations.SerializedName

data class FishingSpot(
    val id: String,
    val name: String,
    val latitude: Double,
    val longitude: Double,
    val type: String,
    val description: String,
    @SerializedName("target_species") val targetSpecies: List<String>,
    @SerializedName("best_tide") val bestTide: String,
    @SerializedName("best_time") val bestTime: String,
    val difficulty: String,
    val depth: Double? = null
)

data class BoatRamp(
    val id: String,
    val name: String,
    val latitude: Double,
    val longitude: Double,
    val facilities: List<String>,
    @SerializedName("parking_spaces") val parkingSpaces: Int,
    @SerializedName("tidal_access") val tidalAccess: String,
    @SerializedName("fee_required") val feeRequired: Boolean
)

data class Reef(
    val id: String,
    val name: String,
    val latitude: Double,
    val longitude: Double,
    @SerializedName("reef_type") val reefType: String,
    @SerializedName("depth_min") val depthMin: Double,
    @SerializedName("depth_max") val depthMax: Double,
    @SerializedName("size_hectares") val sizeHectares: Double? = null,
    @SerializedName("fish_species") val fishSpecies: List<String>,
    val description: String,
    @SerializedName("best_fishing") val bestFishing: String,
    val accessibility: String
)

data class GreenZone(
    val id: String,
    val name: String,
    val coordinates: List<List<Double>>,
    val restrictions: String,
    val description: String
)

data class ChannelMarker(
    val id: String? = null,
    val name: String,
    @SerializedName("marker_type") val markerType: String,
    val latitude: Double,
    val longitude: Double,
    val description: String? = null,
    @SerializedName("light_characteristics") val lightCharacteristics: String? = null,
    val color: String,
    val shape: String
)
