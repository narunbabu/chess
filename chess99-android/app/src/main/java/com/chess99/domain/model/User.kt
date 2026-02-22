package com.chess99.domain.model

data class User(
    val id: Int,
    val name: String,
    val email: String,
    val avatarUrl: String? = null,
    val rating: Int = 1200,
    val isProvisional: Boolean = true,
    val gamesPlayed: Int = 0,
    val peakRating: Int = 1200,
    val tutorialXp: Int = 0,
    val tutorialLevel: Int = 1,
    val createdAt: String? = null,
    val updatedAt: String? = null,
)
