package com.chess99.data.dto

import com.chess99.domain.model.AuthResult
import com.chess99.domain.model.User

fun UserDto.toDomain(): User = User(
    id = id,
    name = name,
    email = email,
    avatarUrl = avatarUrl,
    rating = rating ?: 1200,
    isProvisional = isProvisional ?: true,
    gamesPlayed = gamesPlayed ?: 0,
    peakRating = peakRating ?: 1200,
    tutorialXp = tutorialXp ?: 0,
    tutorialLevel = tutorialLevel ?: 1,
    createdAt = createdAt,
    updatedAt = updatedAt,
)

fun AuthResponse.toAuthResult(): AuthResult? {
    val token = this.token ?: return null
    val user = this.user?.toDomain() ?: return null
    return AuthResult(token = token, user = user)
}
