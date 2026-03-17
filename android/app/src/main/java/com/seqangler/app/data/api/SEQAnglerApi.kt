package com.seqangler.app.data.api

import com.seqangler.app.data.models.*
import retrofit2.http.*

interface SEQAnglerApi {
    
    // Auth endpoints
    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): AuthResponse
    
    @POST("api/auth/register")
    suspend fun register(@Body request: RegisterRequest): AuthResponse
    
    // Weather endpoints
    @GET("api/weather")
    suspend fun getWeather(): Weather
    
    @GET("api/marine-weather")
    suspend fun getMarineWeather(): MarineWeather
    
    @GET("api/forecast/7day")
    suspend fun getSevenDayForecast(): SevenDayForecast
    
    // Tides endpoints
    @GET("api/tides")
    suspend fun getTides(): Map<String, Any>
    
    @GET("api/tides/7day")
    suspend fun getSevenDayTides(): SevenDayTides
    
    @GET("api/moon-phase")
    suspend fun getMoonPhase(): MoonPhase
    
    @GET("api/tidal-flow")
    suspend fun getTidalFlow(): TidalFlow
    
    // Fishing conditions
    @GET("api/fishing-conditions/preview")
    suspend fun getFishingConditions(): FishingConditions
    
    // Map data endpoints
    @GET("api/spots/depths")
    suspend fun getFishingSpots(): List<FishingSpot>
    
    @GET("api/boat-ramps")
    suspend fun getBoatRamps(): List<BoatRamp>
    
    @GET("api/reefs")
    suspend fun getReefs(): List<Reef>
    
    @GET("api/green-zones")
    suspend fun getGreenZones(): List<GreenZone>
    
    @GET("api/channel-markers")
    suspend fun getChannelMarkers(): List<ChannelMarker>
    
    // Species endpoints
    @GET("api/species")
    suspend fun getSpecies(): List<Species>
    
    @GET("api/species/{id}")
    suspend fun getSpeciesById(@Path("id") id: String): Species
    
    @GET("api/species/closed-seasons")
    suspend fun getClosedSeasons(): ClosedSeasons
    
    // Catches endpoints
    @GET("api/catches")
    suspend fun getCatches(@Header("Authorization") token: String): List<Catch>
    
    @POST("api/catches")
    suspend fun createCatch(
        @Header("Authorization") token: String,
        @Body catch: Catch
    ): Catch
}
