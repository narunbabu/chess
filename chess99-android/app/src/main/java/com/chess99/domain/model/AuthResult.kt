package com.chess99.domain.model

data class AuthResult(
    val token: String,
    val user: User,
)
