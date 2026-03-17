package com.seqangler.app.data.repository

import com.seqangler.app.data.api.SEQAnglerApi
import com.seqangler.app.data.models.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SEQAnglerRepository @Inject constructor(
    private val api: SEQAnglerApi
) {
    // Auth
    suspend fun login(email: String, password: String): Result<AuthResponse> = runCatching {
        api.login(LoginRequest(email, password))
    }
    
    suspend fun register(email: String, password: String, fullName: String): Result<AuthResponse> = runCatching {
        api.register(RegisterRequest(email, password, fullName))
    }
    
    // Weather
    fun getWeather(): Flow<Result<Weather>> = flow {
        emit(runCatching { api.getWeather() })
    }
    
    fun getMarineWeather(): Flow<Result<MarineWeather>> = flow {
        emit(runCatching { api.getMarineWeather() })
    }
    
    fun getSevenDayForecast(): Flow<Result<SevenDayForecast>> = flow {
        emit(runCatching { api.getSevenDayForecast() })
    }
    
    // Tides
    fun getSevenDayTides(): Flow<Result<SevenDayTides>> = flow {
        emit(runCatching { api.getSevenDayTides() })
    }
    
    fun getMoonPhase(): Flow<Result<MoonPhase>> = flow {
        emit(runCatching { api.getMoonPhase() })
    }
    
    fun getTidalFlow(): Flow<Result<TidalFlow>> = flow {
        emit(runCatching { api.getTidalFlow() })
    }
    
    // Fishing
    fun getFishingConditions(): Flow<Result<FishingConditions>> = flow {
        emit(runCatching { api.getFishingConditions() })
    }
    
    // Map Data
    fun getFishingSpots(): Flow<Result<List<FishingSpot>>> = flow {
        emit(runCatching { api.getFishingSpots() })
    }
    
    fun getBoatRamps(): Flow<Result<List<BoatRamp>>> = flow {
        emit(runCatching { api.getBoatRamps() })
    }
    
    fun getReefs(): Flow<Result<List<Reef>>> = flow {
        emit(runCatching { api.getReefs() })
    }
    
    fun getGreenZones(): Flow<Result<List<GreenZone>>> = flow {
        emit(runCatching { api.getGreenZones() })
    }
    
    fun getChannelMarkers(): Flow<Result<List<ChannelMarker>>> = flow {
        emit(runCatching { api.getChannelMarkers() })
    }
    
    // Species
    fun getSpecies(): Flow<Result<List<Species>>> = flow {
        emit(runCatching { api.getSpecies() })
    }
    
    suspend fun getSpeciesById(id: String): Result<Species> = runCatching {
        api.getSpeciesById(id)
    }
    
    fun getClosedSeasons(): Flow<Result<ClosedSeasons>> = flow {
        emit(runCatching { api.getClosedSeasons() })
    }
    
    // Catches
    fun getCatches(token: String): Flow<Result<List<Catch>>> = flow {
        emit(runCatching { api.getCatches("Bearer $token") })
    }
    
    suspend fun createCatch(token: String, catch: Catch): Result<Catch> = runCatching {
        api.createCatch("Bearer $token", catch)
    }
}
