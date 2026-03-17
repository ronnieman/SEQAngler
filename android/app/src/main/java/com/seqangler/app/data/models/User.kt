package com.seqangler.app.data.models

import com.google.gson.annotations.SerializedName

data class User(
    val id: String,
    val email: String,
    @SerializedName("full_name") val fullName: String,
    @SerializedName("created_at") val createdAt: String,
    @SerializedName("subscription_status") val subscriptionStatus: String,
    @SerializedName("trial_end_date") val trialEndDate: String?
)

data class LoginRequest(
    val email: String,
    val password: String
)

data class RegisterRequest(
    val email: String,
    val password: String,
    @SerializedName("full_name") val fullName: String
)

data class AuthResponse(
    @SerializedName("access_token") val accessToken: String,
    @SerializedName("token_type") val tokenType: String,
    val user: User
)

data class Catch(
    val id: String? = null,
    @SerializedName("user_id") val userId: String? = null,
    val species: String,
    val length: Double? = null,
    val weight: Double? = null,
    val latitude: Double,
    val longitude: Double,
    @SerializedName("image_base64") val imageBase64: String? = null,
    val notes: String? = null,
    @SerializedName("caught_at") val caughtAt: String? = null
)
