package com.chess99.data.repository

import com.chess99.data.api.AuthApi
import com.chess99.data.dto.MessageResponse
import com.chess99.data.local.TokenManager
import com.chess99.data.websocket.PusherManager
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.delay
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Response

class AuthRepositoryImplTest {
    private lateinit var authApi: AuthApi
    private lateinit var tokenManager: TokenManager
    private lateinit var pusherManager: PusherManager
    private lateinit var repository: AuthRepositoryImpl

    @Before
    fun setUp() {
        authApi = mockk()
        tokenManager = mockk(relaxed = true)
        pusherManager = mockk(relaxed = true)
        repository = AuthRepositoryImpl(authApi, tokenManager, pusherManager)
    }

    @Test
    fun `logout clears local account before attempting server revoke`() = runTest {
        coEvery { authApi.logout("Bearer token-123") } coAnswers {
            verify(exactly = 1) { tokenManager.clearAll() }
            verify(exactly = 1) { pusherManager.disconnect() }
            Response.success(MessageResponse("success", "Logged out"))
        }

        val result = repository.logout("token-123")

        assertTrue(result.isSuccess)
        coVerify(exactly = 1) { authApi.logout("Bearer token-123") }
    }

    @Test
    fun `offline logout remains successful with local account cleared`() = runTest {
        coEvery { authApi.logout(any()) } throws java.io.IOException("offline")

        val result = repository.logout("offline-token")

        assertTrue(result.isSuccess)
        verify(exactly = 1) { tokenManager.clearAll() }
        verify(exactly = 1) { pusherManager.disconnect() }
    }

    @Test
    fun `missing session token skips server and still clears local state`() = runTest {
        val result = repository.logout(null)

        assertTrue(result.isSuccess)
        verify(exactly = 1) { tokenManager.clearAll() }
        verify(exactly = 1) { pusherManager.disconnect() }
        coVerify(exactly = 0) { authApi.logout(any()) }
    }

    @Test
    fun `slow server revoke is bounded and cannot fail local logout`() = runTest {
        coEvery { authApi.logout(any()) } coAnswers {
            delay(10_000)
            Response.success(MessageResponse("success", "Logged out"))
        }

        val result = repository.logout("slow-token")

        assertTrue(result.isSuccess)
        verify(exactly = 1) { tokenManager.clearAll() }
    }
}
