# Android App Requirements for Chess-Web Platform

**Document Version**: 1.0
**Date**: 2025-11-23
**Project**: Chess-Web Mobile Application
**Target Platform**: Android 8.0+ (API Level 26+)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Technology Stack](#technology-stack)
3. [Architecture Overview](#architecture-overview)
4. [Feature Requirements](#feature-requirements)
5. [API Integration](#api-integration)
6. [Real-time Communication](#real-time-communication)
7. [State Management](#state-management)
8. [UI/UX Requirements](#uiux-requirements)
9. [Local Storage & Caching](#local-storage--caching)
10. [Media & Assets](#media--assets)
11. [Security & Authentication](#security--authentication)
12. [Performance Requirements](#performance-requirements)
13. [Third-Party Libraries](#third-party-libraries)
14. [Development Phases](#development-phases)
15. [Testing Strategy](#testing-strategy)
16. [Deployment Considerations](#deployment-considerations)

---

## Executive Summary

### Project Overview
Build a native Android application that replicates the full functionality of the Chess-Web React frontend, providing a seamless mobile chess experience with real-time multiplayer, tutorials, tournaments, and social features.

### Core Objectives
- **Full Feature Parity**: All web features available on Android
- **Real-time Experience**: WebSocket-based multiplayer with polling fallback
- **Offline Capability**: Play against AI without internet connection
- **Native Performance**: Smooth 60fps animations and instant response
- **Material Design**: Modern Android UI following Material Design 3 guidelines

### Key Metrics
- **Minimum Android Version**: Android 8.0 (API 26) - covers 95%+ of devices
- **Target Users**: Chess players seeking mobile multiplayer experience
- **Network Resilience**: <1% data loss in multiplayer games
- **Response Time**: <100ms for local moves, <500ms for multiplayer sync

---

## Technology Stack

### Core Languages & Frameworks
```kotlin
// Primary Language
Language: Kotlin 1.9+
JVM Target: 17

// UI Framework (Choose One)
Option A: Jetpack Compose (Recommended)
  - Modern, reactive UI like React
  - Less code, easier to maintain
  - Better suited for complex state

Option B: XML Layouts (Traditional)
  - More mature ecosystem
  - Easier to find developers
  - Better tooling support
```

### Architecture Pattern
```
Pattern: MVVM (Model-View-ViewModel)
Components:
  - ViewModel: State management + business logic
  - Repository: Data layer abstraction
  - UseCase: Domain-specific operations
  - DataSource: API and local storage
```

### Dependency Injection
```kotlin
Framework: Hilt (Dagger wrapper)
Rationale: Official Google recommendation, compile-time safety
```

### Build System
```gradle
Build Tool: Gradle with Kotlin DSL
Min SDK: 26 (Android 8.0)
Target SDK: 34 (Android 14)
Compile SDK: 34
```

---

## Architecture Overview

### Project Structure
```
app/
├── src/main/
│   ├── java/com/chess99/android/
│   │   ├── di/              # Dependency injection modules
│   │   ├── data/            # Data layer
│   │   │   ├── api/         # Retrofit API interfaces
│   │   │   ├── local/       # Room database, DataStore
│   │   │   ├── repository/  # Repository implementations
│   │   │   └── websocket/   # WebSocket clients
│   │   ├── domain/          # Domain layer
│   │   │   ├── model/       # Domain models
│   │   │   ├── usecase/     # Business logic use cases
│   │   │   └── repository/  # Repository interfaces
│   │   ├── presentation/    # UI layer
│   │   │   ├── game/        # Game screens
│   │   │   ├── lobby/       # Lobby screens
│   │   │   ├── tutorial/    # Tutorial screens
│   │   │   ├── championship/# Tournament screens
│   │   │   ├── profile/     # Profile screens
│   │   │   └── common/      # Shared UI components
│   │   ├── chess/           # Chess engine wrapper
│   │   │   ├── ChessEngine.kt
│   │   │   ├── StockfishInterface.kt
│   │   │   └── FenParser.kt
│   │   └── util/            # Utilities
│   └── res/                 # Resources (layouts, drawables, strings)
└── build.gradle.kts
```

### Data Flow Architecture
```
UI (Compose/View)
    ↓ user actions
ViewModel
    ↓ business logic
UseCase
    ↓ data operations
Repository
    ↓ network/local
DataSource (API/Database/WebSocket)
```

---

## Feature Requirements

### 1. Authentication & User Management

#### Login/Registration
- [ ] Email/password authentication
- [ ] OAuth integration (Google, Facebook)
- [ ] JWT token management with refresh logic
- [ ] Biometric authentication (fingerprint/face)
- [ ] "Remember Me" functionality
- [ ] Password reset flow
- [ ] First-time skill assessment modal

#### User Profile
- [ ] View and edit profile information
- [ ] Avatar upload with cropping (square aspect ratio)
- [ ] Rating display with history graph
- [ ] Statistics dashboard (wins/losses/draws)
- [ ] Friend management (add/remove/pending)
- [ ] Tutorial progress overview
- [ ] Account settings

### 2. Core Game Modes

#### Play vs Computer (Offline)
- [ ] Single-player mode with Stockfish AI
- [ ] Adjustable difficulty (1-16 depth levels)
- [ ] Board orientation selection (white/black)
- [ ] Move history with navigation (forward/back)
- [ ] Takeback move functionality
- [ ] Game pause/resume
- [ ] Save/load games locally
- [ ] Export PGN notation
- [ ] No authentication required

#### Play Multiplayer (Online)
- [ ] Real-time 2-player chess via WebSocket
- [ ] Game creation and invitation system
- [ ] Accept/decline invitations
- [ ] Automatic color assignment
- [ ] Live move synchronization (<500ms latency)
- [ ] Chess clock with time increments
- [ ] Move validation with instant feedback
- [ ] Pause game (requires opponent confirmation)
- [ ] Resume requests with approval flow
- [ ] Draw offers (offer/accept/decline)
- [ ] Resign functionality
- [ ] Forfeit on timeout (auto-flag)
- [ ] Rematch option
- [ ] Opponent presence indicator (online/offline)
- [ ] Ping opponent reminder
- [ ] Inactivity auto-pause (configurable timeout)

### 3. Lobby & Matchmaking

#### Player Discovery
- [ ] Online players list with real-time updates
- [ ] Player search by username/rating
- [ ] Filter by rating range
- [ ] Sort by rating/online status
- [ ] Friend status indicators
- [ ] Send game invitations
- [ ] View active games count

#### Invitation Management
- [ ] Pending invitations inbox (received)
- [ ] Sent invitations tracking
- [ ] Accepted invitations (ready to join)
- [ ] Push notifications for new invitations
- [ ] Quick accept/decline actions
- [ ] Invitation expiry (15 minutes)
- [ ] Auto-decline on game start elsewhere

### 4. Tutorial System

#### Module Structure
- [ ] Tiered modules (Beginner/Intermediate/Advanced)
- [ ] Module progress tracking (%)
- [ ] Lesson list with completion status
- [ ] XP system with achievements
- [ ] Daily challenges
- [ ] Leaderboard for tutorial progress

#### Interactive Lessons
- [ ] Step-by-step guided tutorials
- [ ] Interactive chessboard with move validation
- [ ] Hint system (max 3 hints per lesson)
- [ ] Visual feedback for correct/incorrect moves
- [ ] Lesson completion rewards (XP, badges)
- [ ] Reset lesson to start over
- [ ] Progress synchronization with backend
- [ ] Offline lesson caching

### 5. Championship System

#### Tournament Browsing
- [ ] List championships (upcoming/active/completed)
- [ ] Filter by format (Swiss/Elimination/Hybrid)
- [ ] Filter by status (registering/active/completed)
- [ ] Search by name
- [ ] View tournament details
- [ ] Participant count and max limit
- [ ] Entry fee and prize pool display
- [ ] Registration status

#### Tournament Registration
- [ ] Register with entry fee payment
- [ ] Payment integration (Razorpay/Stripe)
- [ ] Confirmation dialog
- [ ] Payment receipt display
- [ ] Withdrawal before tournament start
- [ ] Refund processing

#### Tournament Participation
- [ ] View current round and pairings
- [ ] My matches list with status
- [ ] Schedule proposal system
  - Propose match time
  - Accept/decline opponent proposals
  - Finalize agreed schedule
- [ ] Match game creation
- [ ] Result reporting with validation
- [ ] Standings/leaderboard view
- [ ] Round-by-round results
- [ ] Tournament bracket visualization (Elimination)
- [ ] Push notifications for:
  - New round pairings
  - Match schedule confirmations
  - Opponent ready
  - Tournament status changes

#### Tournament Administration (for creators)
- [ ] Create tournament with parameters
  - Name, description
  - Format (Swiss/Elimination/Hybrid)
  - Max participants
  - Rounds count
  - Time control
  - Entry fee and prize distribution
- [ ] Edit tournament before start
- [ ] Start tournament (auto-generate round 1)
- [ ] Pause tournament
- [ ] Resume tournament
- [ ] Complete tournament (finalize prizes)
- [ ] Generate next round
- [ ] Manual pairing adjustments
- [ ] Result verification and override
- [ ] Participant permissions management
- [ ] Delete tournament (soft/hard)

### 6. Social Features

#### Friends System
- [ ] Friend list with online status
- [ ] Send friend requests
- [ ] Accept/decline requests
- [ ] Pending requests inbox
- [ ] Remove friends
- [ ] Quick invite to game
- [ ] View friend's profile and stats

#### Game Sharing
- [ ] Generate shareable game result card
- [ ] Branded result image with:
  - Player names and avatars
  - Final position diagram
  - Game outcome
  - Key stats (moves, time)
  - Chess99 branding
- [ ] Share via Android Share Sheet
  - WhatsApp, Twitter, Facebook, etc.
  - Copy link to clipboard
- [ ] Public game viewer (web link)
- [ ] Share replay with move list

### 7. Game History & Review

#### History Browsing
- [ ] List past games (all modes)
- [ ] Filter by:
  - Opponent
  - Result (win/loss/draw)
  - Game type (computer/multiplayer/tournament)
  - Date range
- [ ] Search by opponent name
- [ ] Pagination with infinite scroll

#### Game Replay
- [ ] Move-by-move replay
- [ ] Navigation controls (first/prev/next/last)
- [ ] Auto-play with adjustable speed
- [ ] Jump to specific move
- [ ] Board flip to see from opponent's view
- [ ] Export PGN
- [ ] Share game link
- [ ] Delete game from history

### 8. Settings & Preferences

#### Game Settings
- [ ] Default board theme selection
- [ ] Piece set selection
- [ ] Move animation speed
- [ ] Sound effects toggle (move/check/end)
- [ ] Show legal moves toggle
- [ ] Show coordinates toggle
- [ ] Auto-queen promotion vs. promotion dialog
- [ ] Confirm moves toggle

#### App Settings
- [ ] Push notifications toggle
  - Game invitations
  - Match updates
  - Tournament notifications
  - Friend requests
- [ ] Language selection (i18n support)
- [ ] Dark/light theme
- [ ] Data usage settings
  - Download images on WiFi only
  - Polling vs. WebSocket preference
- [ ] Clear cache
- [ ] Logout

---

## API Integration

### Backend Configuration
```kotlin
// Base URL Configuration
const val BASE_URL_DEV = "http://10.0.2.2:8000/api/" // Android emulator localhost
const val BASE_URL_PROD = "https://api.chess99.com/api/"

// WebSocket Configuration
const val REVERB_DEV = "ws://10.0.2.2:8080"
const val REVERB_PROD = "wss://reverb.chess99.com"
```

### REST API Endpoints (Retrofit)

#### Authentication Service
```kotlin
interface AuthApi {
    @POST("auth/login")
    suspend fun login(@Body credentials: LoginRequest): AuthResponse

    @POST("auth/register")
    suspend fun register(@Body data: RegisterRequest): AuthResponse

    @GET("user")
    suspend fun getCurrentUser(): User

    @GET("auth/callback")
    suspend fun oauthCallback(@Query("token") token: String): AuthResponse
}
```

#### Game Service
```kotlin
interface GameApi {
    @GET("games")
    suspend fun getGames(
        @Query("filter") filter: String? = null,
        @Query("page") page: Int = 1
    ): PaginatedResponse<Game>

    @GET("games/active")
    suspend fun getActiveGames(): List<Game>

    @GET("games/{id}")
    suspend fun getGame(@Path("id") gameId: String): Game

    @POST("games")
    suspend fun createGame(@Body request: CreateGameRequest): Game
}
```

#### WebSocket Game Service
```kotlin
interface WebSocketGameApi {
    @POST("websocket/handshake")
    suspend fun handshake(): HandshakeResponse

    @POST("websocket/games/{id}/move")
    suspend fun makeMove(
        @Path("id") gameId: String,
        @Body move: MoveRequest
    ): MoveResponse

    @POST("websocket/games/{id}/pause")
    suspend fun pauseGame(@Path("id") gameId: String): GameStatusResponse

    @POST("websocket/games/{id}/resume")
    suspend fun resumeGame(@Path("id") gameId: String): GameStatusResponse

    @POST("websocket/games/{id}/resign")
    suspend fun resignGame(@Path("id") gameId: String): GameEndResponse

    @POST("websocket/games/{id}/draw/offer")
    suspend fun offerDraw(@Path("id") gameId: String): DrawOfferResponse

    @POST("websocket/games/{id}/draw/accept")
    suspend fun acceptDraw(@Path("id") gameId: String): GameEndResponse

    @POST("websocket/games/{id}/draw/decline")
    suspend fun declineDraw(@Path("id") gameId: String): DrawDeclineResponse

    @GET("websocket/room-state")
    suspend fun pollRoomState(
        @Query("game_id") gameId: String,
        @Query("compact") compact: Int = 1,
        @Header("If-None-Match") etag: String? = null
    ): Response<RoomStateResponse>
}
```

#### Invitation Service
```kotlin
interface InvitationApi {
    @GET("invitations/pending")
    suspend fun getPendingInvitations(): List<Invitation>

    @GET("invitations/sent")
    suspend fun getSentInvitations(): List<Invitation>

    @GET("invitations/accepted")
    suspend fun getAcceptedInvitations(): List<Invitation>

    @POST("invitations/send")
    suspend fun sendInvitation(@Body request: SendInvitationRequest): Invitation

    @POST("invitations/{id}/respond")
    suspend fun respondToInvitation(
        @Path("id") invitationId: String,
        @Body response: InvitationResponse
    ): Invitation
}
```

#### Tutorial Service
```kotlin
interface TutorialApi {
    @GET("tutorial/modules")
    suspend fun getModules(): List<TutorialModule>

    @GET("tutorial/modules/{slug}")
    suspend fun getModule(@Path("slug") slug: String): TutorialModule

    @GET("tutorial/lessons/{id}")
    suspend fun getLesson(@Path("id") lessonId: String): Lesson

    @POST("tutorial/lessons/{id}/start")
    suspend fun startLesson(@Path("id") lessonId: String): LessonProgress

    @POST("tutorial/lessons/{id}/complete")
    suspend fun completeLesson(@Path("id") lessonId: String): LessonCompletionResponse

    @POST("tutorial/lessons/{id}/validate-move")
    suspend fun validateMove(
        @Path("id") lessonId: String,
        @Body move: ValidateMoveRequest
    ): MoveValidationResponse

    @POST("tutorial/lessons/{id}/hint")
    suspend fun getHint(@Path("id") lessonId: String): HintResponse

    @GET("tutorial/progress")
    suspend fun getTutorialProgress(): TutorialProgress

    @GET("tutorial/daily-challenge")
    suspend fun getDailyChallenge(): DailyChallenge
}
```

#### Championship Service
```kotlin
interface ChampionshipApi {
    @GET("championships")
    suspend fun getChampionships(
        @Query("filter") filter: String? = null,
        @Query("status") status: String? = null
    ): List<Championship>

    @GET("championships/{id}")
    suspend fun getChampionship(@Path("id") id: String): Championship

    @POST("championships")
    suspend fun createChampionship(@Body request: CreateChampionshipRequest): Championship

    @POST("championships/{id}/register-with-payment")
    suspend fun registerWithPayment(
        @Path("id") id: String,
        @Body payment: PaymentRequest
    ): RegistrationResponse

    @POST("championships/{id}/start")
    suspend fun startTournament(@Path("id") id: String): Championship

    @POST("championships/{id}/generate-next-round")
    suspend fun generateNextRound(@Path("id") id: String): RoundResponse

    @GET("championships/{id}/participants")
    suspend fun getParticipants(@Path("id") id: String): List<Participant>

    @GET("championships/{id}/standings")
    suspend fun getStandings(@Path("id") id: String): List<Standing>

    @GET("championships/{id}/matches")
    suspend fun getMatches(@Path("id") id: String): List<ChampionshipMatch>

    @GET("championships/{id}/my-matches")
    suspend fun getMyMatches(@Path("id") id: String): List<ChampionshipMatch>

    @POST("championship-matches/{id}/report-result")
    suspend fun reportResult(
        @Path("id") matchId: String,
        @Body result: MatchResultRequest
    ): ChampionshipMatch
}
```

#### User & Social Service
```kotlin
interface UserApi {
    @GET("users")
    suspend fun searchUsers(@Query("q") query: String): List<User>

    @GET("friends")
    suspend fun getFriends(): List<Friend>

    @GET("friends/pending")
    suspend fun getPendingFriendRequests(): List<FriendRequest>

    @POST("friends/{id}")
    suspend fun sendFriendRequest(@Path("id") userId: String): FriendRequest

    @POST("friends/{id}/accept")
    suspend fun acceptFriendRequest(@Path("id") requestId: String): Friend

    @DELETE("friends/{id}")
    suspend fun removeFriend(@Path("id") friendId: String): Unit

    @Multipart
    @POST("profile")
    suspend fun updateProfile(
        @Part avatar: MultipartBody.Part?,
        @Part("name") name: RequestBody?,
        @Part("bio") bio: RequestBody?
    ): User

    @GET("rating")
    suspend fun getCurrentRating(): Rating

    @GET("rating/history")
    suspend fun getRatingHistory(): List<RatingHistoryEntry>
}
```

#### Presence Service
```kotlin
interface PresenceApi {
    @POST("status/heartbeat")
    suspend fun sendHeartbeat(): Unit

    @GET("status/check/{userId}")
    suspend fun checkUserStatus(@Path("userId") userId: String): UserStatus

    @POST("status/batch-check")
    suspend fun batchCheckStatus(@Body userIds: List<String>): Map<String, UserStatus>

    @GET("status/online-users")
    suspend fun getOnlineUsers(): List<User>

    @GET("presence/friends")
    suspend fun getOnlineFriends(): List<User>

    @GET("presence/lobby")
    suspend fun getLobbyPresence(): LobbyPresence
}
```

### HTTP Client Configuration

#### Retrofit Setup
```kotlin
@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideOkHttpClient(
        authInterceptor: AuthInterceptor,
        loggingInterceptor: HttpLoggingInterceptor
    ): OkHttpClient {
        return OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(loggingInterceptor)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient): Retrofit {
        return Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }
}
```

#### Authentication Interceptor
```kotlin
class AuthInterceptor @Inject constructor(
    private val tokenManager: TokenManager
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val token = tokenManager.getToken()

        val authenticatedRequest = if (token != null) {
            request.newBuilder()
                .addHeader("Authorization", "Bearer $token")
                .addHeader("Accept", "application/json")
                .build()
        } else {
            request.newBuilder()
                .addHeader("Accept", "application/json")
                .build()
        }

        val response = chain.proceed(authenticatedRequest)

        // Handle 401 Unauthorized
        if (response.code == 401) {
            tokenManager.clearToken()
            // Trigger logout and redirect to login screen
        }

        return response
    }
}
```

---

## Real-time Communication

### WebSocket Architecture

#### Pusher Protocol Client
```kotlin
// Using Pusher Java Client for Reverb compatibility
dependencies {
    implementation("com.pusher:pusher-java-client:2.4.4")
}

class ReverbClient @Inject constructor(
    private val tokenManager: TokenManager,
    @ApplicationContext private val context: Context
) {
    private var pusher: Pusher? = null
    private val channels = mutableMapOf<String, Channel>()

    fun connect() {
        val options = PusherOptions().apply {
            setCluster(BuildConfig.REVERB_CLUSTER)
            setHost(BuildConfig.REVERB_HOST)
            setWsPort(BuildConfig.REVERB_PORT)
            setWssPort(BuildConfig.REVERB_WSS_PORT)
            isEncrypted = BuildConfig.REVERB_ENCRYPTED

            authorizer = HttpAuthorizer(
                "${BuildConfig.API_BASE_URL}/broadcasting/auth"
            ).apply {
                setHeaders(mapOf(
                    "Authorization" to "Bearer ${tokenManager.getToken()}"
                ))
            }
        }

        pusher = Pusher(BuildConfig.REVERB_APP_KEY, options).apply {
            connect(object : ConnectionEventListener {
                override fun onConnectionStateChange(change: ConnectionStateChange) {
                    Log.d("Pusher", "State changed from ${change.previousState} to ${change.currentState}")
                }

                override fun onError(message: String, code: String?, e: Exception?) {
                    Log.e("Pusher", "Error: $message", e)
                }
            }, ConnectionState.ALL)
        }
    }

    fun subscribeToGameChannel(gameId: String, listener: GameEventListener): Channel {
        val channelName = "game.$gameId"
        return channels.getOrPut(channelName) {
            pusher!!.subscribe(channelName).apply {
                bind("game.move") { event ->
                    val move = Gson().fromJson(event.data, MoveEvent::class.java)
                    listener.onMove(move)
                }
                bind("game.paused") { event ->
                    listener.onGamePaused()
                }
                bind("game.resumed") { event ->
                    listener.onGameResumed()
                }
                bind("game.ended") { event ->
                    val endData = Gson().fromJson(event.data, GameEndEvent::class.java)
                    listener.onGameEnded(endData)
                }
            }
        }
    }

    fun subscribeToUserChannel(userId: String, listener: UserEventListener): Channel {
        val channelName = "App.Models.User.$userId"
        return channels.getOrPut(channelName) {
            pusher!!.subscribePrivate(channelName).apply {
                bind("invitation.sent") { event ->
                    val invitation = Gson().fromJson(event.data, Invitation::class.java)
                    listener.onInvitationReceived(invitation)
                }
                bind("invitation.accepted") { event ->
                    val invitation = Gson().fromJson(event.data, Invitation::class.java)
                    listener.onInvitationAccepted(invitation)
                }
            }
        }
    }

    fun unsubscribe(channelName: String) {
        channels.remove(channelName)
        pusher?.unsubscribe(channelName)
    }

    fun disconnect() {
        pusher?.disconnect()
        channels.clear()
    }
}
```

### Polling Fallback Strategy

#### Smart Polling Manager
```kotlin
class PollingManager @Inject constructor(
    private val webSocketGameApi: WebSocketGameApi,
    private val lifecycleOwner: LifecycleOwner
) {
    private var pollingJob: Job? = null
    private var currentEtag: String? = null
    private var pollingInterval = 1000L // Start with 1s

    fun startPolling(
        gameId: String,
        isMyTurn: Boolean,
        isAppInBackground: Boolean,
        onStateChange: (RoomStateResponse) -> Unit
    ) {
        pollingJob?.cancel()

        // Adaptive polling cadence
        pollingInterval = when {
            isAppInBackground -> 8000L  // 8s when backgrounded
            isMyTurn -> 1000L          // 1s when my turn
            else -> 3000L              // 3s when opponent's turn
        }

        pollingJob = lifecycleOwner.lifecycleScope.launch {
            while (isActive) {
                try {
                    val response = webSocketGameApi.pollRoomState(
                        gameId = gameId,
                        compact = 1,
                        etag = currentEtag
                    )

                    if (response.isSuccessful) {
                        response.body()?.let { state ->
                            // Only emit if state actually changed
                            if (response.headers()["ETag"] != currentEtag) {
                                currentEtag = response.headers()["ETag"]
                                onStateChange(state)
                            }
                        }
                    } else if (response.code() == 304) {
                        // Not modified, no action needed
                    }
                } catch (e: Exception) {
                    Log.e("Polling", "Error polling room state", e)
                }

                delay(pollingInterval)
            }
        }
    }

    fun stopPolling() {
        pollingJob?.cancel()
        pollingJob = null
    }

    fun updatePollingCadence(isMyTurn: Boolean, isAppInBackground: Boolean) {
        // Restart polling with new cadence
        pollingJob?.let {
            // Will be restarted by caller with new parameters
        }
    }
}
```

### Presence System

#### Heartbeat Service
```kotlin
class PresenceService @Inject constructor(
    private val presenceApi: PresenceApi,
    private val workManager: WorkManager
) {
    fun startHeartbeat() {
        val heartbeatRequest = PeriodicWorkRequestBuilder<HeartbeatWorker>(
            repeatInterval = 60,
            repeatIntervalTimeUnit = TimeUnit.SECONDS
        ).setConstraints(
            Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
        ).build()

        workManager.enqueueUniquePeriodicWork(
            "user_heartbeat",
            ExistingPeriodicWorkPolicy.KEEP,
            heartbeatRequest
        )
    }

    fun stopHeartbeat() {
        workManager.cancelUniqueWork("user_heartbeat")
    }
}

class HeartbeatWorker @Inject constructor(
    context: Context,
    params: WorkerParameters,
    private val presenceApi: PresenceApi
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        return try {
            presenceApi.sendHeartbeat()
            Result.success()
        } catch (e: Exception) {
            Log.e("Heartbeat", "Failed to send heartbeat", e)
            Result.retry()
        }
    }
}
```

---

## State Management

### ViewModel Architecture

#### Game ViewModel Example
```kotlin
@HiltViewModel
class GameViewModel @Inject constructor(
    private val gameRepository: GameRepository,
    private val reverbClient: ReverbClient,
    private val chessEngine: ChessEngine,
    private val savedStateHandle: SavedStateHandle
) : ViewModel(), GameEventListener {

    private val gameId: String = savedStateHandle.get<String>("gameId")!!

    private val _gameState = MutableStateFlow<GameState>(GameState.Loading)
    val gameState: StateFlow<GameState> = _gameState.asStateFlow()

    private val _position = MutableStateFlow<String>(STARTING_FEN)
    val position: StateFlow<String> = _position.asStateFlow()

    private val _currentTurn = MutableStateFlow<String>("w")
    val currentTurn: StateFlow<String> = _currentTurn.asStateFlow()

    private val _moveHistory = MutableStateFlow<List<Move>>(emptyList())
    val moveHistory: StateFlow<List<Move>> = _moveHistory.asStateFlow()

    private val _isMyTurn = MutableStateFlow(false)
    val isMyTurn: StateFlow<Boolean> = _isMyTurn.asStateFlow()

    private val _opponentOnline = MutableStateFlow(false)
    val opponentOnline: StateFlow<Boolean> = _opponentOnline.asStateFlow()

    private val _drawOffer = MutableStateFlow<DrawOffer?>(null)
    val drawOffer: StateFlow<DrawOffer?> = _drawOffer.asStateFlow()

    init {
        loadGame()
        subscribeToGameEvents()
    }

    private fun loadGame() {
        viewModelScope.launch {
            try {
                val game = gameRepository.getGame(gameId)
                _position.value = game.fen
                _currentTurn.value = game.currentTurn
                _moveHistory.value = game.moves
                _isMyTurn.value = game.isMyTurn
                _gameState.value = GameState.Playing(game)
            } catch (e: Exception) {
                _gameState.value = GameState.Error(e.message ?: "Failed to load game")
            }
        }
    }

    private fun subscribeToGameEvents() {
        reverbClient.subscribeToGameChannel(gameId, this)
    }

    fun makeMove(from: String, to: String, promotion: String? = null) {
        viewModelScope.launch {
            try {
                val move = chessEngine.validateMove(
                    fen = _position.value,
                    from = from,
                    to = to,
                    promotion = promotion
                )

                if (move != null) {
                    val response = gameRepository.makeMove(gameId, move)
                    // State will update via WebSocket event
                } else {
                    _gameState.value = GameState.Error("Illegal move")
                }
            } catch (e: Exception) {
                _gameState.value = GameState.Error(e.message ?: "Failed to make move")
            }
        }
    }

    // GameEventListener implementation
    override fun onMove(moveEvent: MoveEvent) {
        _position.value = moveEvent.fen
        _currentTurn.value = moveEvent.turn
        _moveHistory.value = moveEvent.moves
        _isMyTurn.value = moveEvent.isMyTurn

        // Play sound
        // Update timer
    }

    override fun onGameEnded(endEvent: GameEndEvent) {
        _gameState.value = GameState.Ended(endEvent)
    }

    // ... other listener methods

    override fun onCleared() {
        super.onCleared()
        reverbClient.unsubscribe("game.$gameId")
    }
}
```

### Repository Pattern

#### Game Repository
```kotlin
interface GameRepository {
    suspend fun getGame(gameId: String): Game
    suspend fun getActiveGames(): List<Game>
    suspend fun createGame(request: CreateGameRequest): Game
    suspend fun makeMove(gameId: String, move: Move): MoveResponse
    suspend fun pauseGame(gameId: String): GameStatusResponse
    suspend fun resignGame(gameId: String): GameEndResponse
    suspend fun offerDraw(gameId: String): DrawOfferResponse
    suspend fun acceptDraw(gameId: String): GameEndResponse
}

class GameRepositoryImpl @Inject constructor(
    private val gameApi: GameApi,
    private val webSocketGameApi: WebSocketGameApi,
    private val gameDao: GameDao,
    private val networkMonitor: NetworkMonitor
) : GameRepository {

    override suspend fun getGame(gameId: String): Game {
        return if (networkMonitor.isOnline()) {
            try {
                val game = gameApi.getGame(gameId)
                gameDao.insertGame(game.toEntity())
                game
            } catch (e: Exception) {
                // Fallback to cached version
                gameDao.getGame(gameId)?.toDomain()
                    ?: throw e
            }
        } else {
            gameDao.getGame(gameId)?.toDomain()
                ?: throw NoConnectivityException()
        }
    }

    override suspend fun makeMove(gameId: String, move: Move): MoveResponse {
        return webSocketGameApi.makeMove(gameId, MoveRequest(move))
    }

    // ... other implementations
}
```

---

## UI/UX Requirements

### Design System

#### Material Design 3 Theme
```kotlin
// Theme colors
val md_theme_light_primary = Color(0xFF6750A4)
val md_theme_light_onPrimary = Color(0xFFFFFFFF)
val md_theme_light_primaryContainer = Color(0xFFEADDFF)
val md_theme_light_onPrimaryContainer = Color(0xFF21005D)

// Chess-specific colors
val lightSquare = Color(0xFFF0D9B5)
val darkSquare = Color(0xFFB58863)
val selectedSquare = Color(0xFFFFFF00).copy(alpha = 0.5f)
val legalMoveIndicator = Color(0xFF00FF00).copy(alpha = 0.3f)
val lastMoveHighlight = Color(0xFFFFFF00).copy(alpha = 0.3f)
val checkHighlight = Color(0xFFFF0000).copy(alpha = 0.5f)
```

#### Typography
```kotlin
val Typography = Typography(
    displayLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 57.sp,
        lineHeight = 64.sp
    ),
    titleLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.SemiBold,
        fontSize = 22.sp,
        lineHeight = 28.sp
    ),
    bodyLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp,
        lineHeight = 24.sp
    )
)
```

### Chessboard Component

#### Custom Chessboard View
```kotlin
@Composable
fun ChessboardView(
    position: String, // FEN string
    orientation: String, // "w" or "b"
    legalMoves: List<String>? = null,
    selectedSquare: String? = null,
    lastMove: Pair<String, String>? = null,
    onSquareClick: (String) -> Unit,
    onPieceDrag: (from: String, to: String) -> Unit,
    showCoordinates: Boolean = true,
    modifier: Modifier = Modifier
) {
    val boardSize = remember { mutableStateOf(0.dp) }

    BoxWithConstraints(modifier = modifier.fillMaxWidth()) {
        val size = min(maxWidth, maxHeight)
        boardSize.value = size

        Column {
            // Chessboard
            Canvas(
                modifier = Modifier
                    .size(size)
                    .pointerInput(Unit) {
                        detectDragGestures(
                            onDragStart = { offset ->
                                // Handle drag start
                            },
                            onDragEnd = {
                                // Handle drag end
                            },
                            onDrag = { change, dragAmount ->
                                // Handle drag
                            }
                        )
                    }
                    .pointerInput(Unit) {
                        detectTapGestures { offset ->
                            val square = offsetToSquare(offset, size)
                            onSquareClick(square)
                        }
                    }
            ) {
                val squareSize = size.toPx() / 8

                // Draw squares
                for (rank in 0..7) {
                    for (file in 0..7) {
                        val isLight = (rank + file) % 2 == 0
                        val color = if (isLight) lightSquare else darkSquare

                        drawRect(
                            color = color,
                            topLeft = Offset(file * squareSize, rank * squareSize),
                            size = Size(squareSize, squareSize)
                        )
                    }
                }

                // Draw highlights (selected, legal moves, last move, check)
                selectedSquare?.let { square ->
                    val (file, rank) = squareToCoords(square, orientation)
                    drawRect(
                        color = selectedSquare,
                        topLeft = Offset(file * squareSize, rank * squareSize),
                        size = Size(squareSize, squareSize)
                    )
                }

                // Draw pieces
                val pieces = parseFen(position)
                pieces.forEach { (square, piece) ->
                    val (file, rank) = squareToCoords(square, orientation)
                    val pieceDrawable = getPieceDrawable(piece)

                    drawImage(
                        image = pieceDrawable,
                        topLeft = Offset(file * squareSize, rank * squareSize),
                        size = Size(squareSize, squareSize)
                    )
                }

                // Draw coordinates
                if (showCoordinates) {
                    // Draw file letters (a-h)
                    // Draw rank numbers (1-8)
                }
            }
        }
    }
}
```

### Screen Layouts

#### Game Screen Layout
```kotlin
@Composable
fun GameScreen(
    viewModel: GameViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit
) {
    val gameState by viewModel.gameState.collectAsState()
    val position by viewModel.position.collectAsState()
    val currentTurn by viewModel.currentTurn.collectAsState()
    val isMyTurn by viewModel.isMyTurn.collectAsState()
    val moveHistory by viewModel.moveHistory.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Chess Game") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { /* Show menu */ }) {
                        Icon(Icons.Default.MoreVert, "Menu")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Opponent info + timer
            OpponentInfoBar(
                opponent = (gameState as? GameState.Playing)?.game?.opponent,
                timeRemaining = /* ... */,
                modifier = Modifier.fillMaxWidth()
            )

            // Chessboard
            ChessboardView(
                position = position,
                orientation = /* ... */,
                selectedSquare = /* ... */,
                onSquareClick = { square ->
                    viewModel.onSquareClick(square)
                },
                onPieceDrag = { from, to ->
                    viewModel.makeMove(from, to)
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(1f)
            )

            // Player info + timer
            PlayerInfoBar(
                player = /* ... */,
                timeRemaining = /* ... */,
                isMyTurn = isMyTurn,
                modifier = Modifier.fillMaxWidth()
            )

            // Game controls
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                Button(
                    onClick = { viewModel.offerDraw() },
                    enabled = isMyTurn
                ) {
                    Text("Offer Draw")
                }

                Button(
                    onClick = { viewModel.resignGame() }
                ) {
                    Text("Resign")
                }

                IconButton(
                    onClick = { /* Show move history */ }
                ) {
                    Icon(Icons.Default.List, "Move history")
                }
            }
        }
    }
}
```

### Navigation

#### Navigation Graph
```kotlin
@Composable
fun NavGraph(
    navController: NavHostController = rememberNavController(),
    startDestination: String
) {
    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        composable("login") {
            LoginScreen(
                onLoginSuccess = {
                    navController.navigate("dashboard") {
                        popUpTo("login") { inclusive = true }
                    }
                }
            )
        }

        composable("dashboard") {
            DashboardScreen(
                onNavigateToGame = { gameId ->
                    navController.navigate("game/$gameId")
                },
                onNavigateToLobby = {
                    navController.navigate("lobby")
                }
            )
        }

        composable(
            route = "game/{gameId}",
            arguments = listOf(navArgument("gameId") { type = NavType.StringType })
        ) {
            GameScreen(
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable("lobby") {
            LobbyScreen(
                onInvitePlayer = { userId ->
                    // Send invitation
                },
                onNavigateToGame = { gameId ->
                    navController.navigate("game/$gameId")
                }
            )
        }

        composable("tutorial") {
            TutorialHubScreen(
                onSelectLesson = { lessonId ->
                    navController.navigate("tutorial/lesson/$lessonId")
                }
            )
        }

        composable(
            route = "tutorial/lesson/{lessonId}",
            arguments = listOf(navArgument("lessonId") { type = NavType.StringType })
        ) {
            LessonScreen(
                onLessonComplete = { navController.popBackStack() }
            )
        }

        composable("championships") {
            ChampionshipListScreen(
                onSelectChampionship = { id ->
                    navController.navigate("championship/$id")
                }
            )
        }

        composable(
            route = "championship/{id}",
            arguments = listOf(navArgument("id") { type = NavType.StringType })
        ) {
            ChampionshipDetailScreen(
                onNavigateToMatch = { matchId ->
                    navController.navigate("championship/match/$matchId")
                }
            )
        }

        composable("profile") {
            ProfileScreen()
        }

        composable("settings") {
            SettingsScreen()
        }
    }
}
```

### Responsive Design

#### Orientation Handling
```kotlin
@Composable
fun AdaptiveGameLayout(
    content: @Composable () -> Unit
) {
    val configuration = LocalConfiguration.current
    val isLandscape = configuration.orientation == Configuration.ORIENTATION_LANDSCAPE

    if (isLandscape) {
        Row(modifier = Modifier.fillMaxSize()) {
            // Chessboard on left
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
            ) {
                content()
            }

            // Move history, controls on right
            Column(
                modifier = Modifier
                    .weight(0.5f)
                    .fillMaxHeight()
            ) {
                // Secondary content
            }
        }
    } else {
        Column(modifier = Modifier.fillMaxSize()) {
            content()
        }
    }
}
```

---

## Local Storage & Caching

### Room Database Schema

#### Database Definition
```kotlin
@Database(
    entities = [
        GameEntity::class,
        UserEntity::class,
        InvitationEntity::class,
        TutorialProgressEntity::class,
        ChampionshipEntity::class,
        FriendEntity::class
    ],
    version = 1
)
abstract class ChessDatabase : RoomDatabase() {
    abstract fun gameDao(): GameDao
    abstract fun userDao(): UserDao
    abstract fun invitationDao(): InvitationDao
    abstract fun tutorialDao(): TutorialDao
    abstract fun championshipDao(): ChampionshipDao
    abstract fun friendDao(): FriendDao
}
```

#### Game Entity
```kotlin
@Entity(tableName = "games")
data class GameEntity(
    @PrimaryKey val id: String,
    val whitePlayerId: String,
    val blackPlayerId: String,
    val currentTurn: String,
    val fen: String,
    val status: String,
    val result: String?,
    val moves: String, // JSON array
    val createdAt: Long,
    val updatedAt: Long,
    val whiteTimeRemaining: Long?,
    val blackTimeRemaining: Long?,
    val lastMoveTimestamp: Long?
)

@Dao
interface GameDao {
    @Query("SELECT * FROM games WHERE id = :gameId")
    suspend fun getGame(gameId: String): GameEntity?

    @Query("SELECT * FROM games WHERE status = 'active' ORDER BY updatedAt DESC")
    suspend fun getActiveGames(): List<GameEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertGame(game: GameEntity)

    @Query("DELETE FROM games WHERE id = :gameId")
    suspend fun deleteGame(gameId: String)

    @Query("DELETE FROM games WHERE status = 'completed' AND updatedAt < :timestamp")
    suspend fun deleteOldCompletedGames(timestamp: Long)
}
```

### DataStore Preferences

#### User Preferences
```kotlin
data class UserPreferences(
    val boardTheme: String = "default",
    val pieceSet: String = "classic",
    val showLegalMoves: Boolean = true,
    val showCoordinates: Boolean = true,
    val soundEnabled: Boolean = true,
    val autoQueenPromotion: Boolean = false,
    val confirmMoves: Boolean = false,
    val notificationsEnabled: Boolean = true,
    val preferWebSocket: Boolean = true,
    val darkMode: Boolean = false
)

class UserPreferencesRepository @Inject constructor(
    private val dataStore: DataStore<Preferences>
) {
    private val BOARD_THEME = stringPreferencesKey("board_theme")
    private val PIECE_SET = stringPreferencesKey("piece_set")
    private val SHOW_LEGAL_MOVES = booleanPreferencesKey("show_legal_moves")
    // ... other keys

    val userPreferencesFlow: Flow<UserPreferences> = dataStore.data
        .catch { exception ->
            if (exception is IOException) {
                emit(emptyPreferences())
            } else {
                throw exception
            }
        }
        .map { preferences ->
            UserPreferences(
                boardTheme = preferences[BOARD_THEME] ?: "default",
                pieceSet = preferences[PIECE_SET] ?: "classic",
                showLegalMoves = preferences[SHOW_LEGAL_MOVES] ?: true
                // ... other mappings
            )
        }

    suspend fun updateBoardTheme(theme: String) {
        dataStore.edit { preferences ->
            preferences[BOARD_THEME] = theme
        }
    }

    // ... other update methods
}
```

### Token Management

#### Secure Token Storage
```kotlin
class TokenManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val sharedPreferences = context.getSharedPreferences(
        "auth_prefs",
        Context.MODE_PRIVATE
    )

    // For production, use EncryptedSharedPreferences
    private val encryptedPrefs = EncryptedSharedPreferences.create(
        "secure_auth_prefs",
        masterKey,
        context,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun saveToken(token: String) {
        encryptedPrefs.edit().putString("auth_token", token).apply()
    }

    fun getToken(): String? {
        return encryptedPrefs.getString("auth_token", null)
    }

    fun clearToken() {
        encryptedPrefs.edit().remove("auth_token").apply()
    }

    fun saveUser(user: User) {
        val userJson = Gson().toJson(user)
        sharedPreferences.edit().putString("user", userJson).apply()
    }

    fun getUser(): User? {
        val userJson = sharedPreferences.getString("user", null)
        return userJson?.let { Gson().fromJson(it, User::class.java) }
    }
}
```

### Caching Strategy

#### Cache Policy
```kotlin
sealed class CachePolicy {
    object CacheFirst : CachePolicy()
    object NetworkFirst : CachePolicy()
    object CacheOnly : CachePolicy()
    object NetworkOnly : CachePolicy()
    data class CacheWithTimeout(val timeoutMs: Long) : CachePolicy()
}

class CachingRepository<T> @Inject constructor(
    private val networkDataSource: NetworkDataSource<T>,
    private val localDataSource: LocalDataSource<T>,
    private val networkMonitor: NetworkMonitor
) {
    suspend fun getData(
        key: String,
        policy: CachePolicy = CachePolicy.CacheFirst
    ): Result<T> {
        return when (policy) {
            is CachePolicy.CacheFirst -> {
                localDataSource.get(key)?.let { Result.success(it) }
                    ?: fetchAndCache(key)
            }
            is CachePolicy.NetworkFirst -> {
                if (networkMonitor.isOnline()) {
                    fetchAndCache(key)
                } else {
                    localDataSource.get(key)?.let { Result.success(it) }
                        ?: Result.failure(NoConnectivityException())
                }
            }
            is CachePolicy.CacheOnly -> {
                localDataSource.get(key)?.let { Result.success(it) }
                    ?: Result.failure(CacheMissException())
            }
            is CachePolicy.NetworkOnly -> {
                fetchAndCache(key)
            }
            is CachePolicy.CacheWithTimeout -> {
                val cached = localDataSource.get(key)
                val cacheAge = localDataSource.getCacheAge(key)

                if (cached != null && cacheAge < policy.timeoutMs) {
                    Result.success(cached)
                } else {
                    fetchAndCache(key)
                }
            }
        }
    }

    private suspend fun fetchAndCache(key: String): Result<T> {
        return try {
            val data = networkDataSource.fetch(key)
            localDataSource.save(key, data)
            Result.success(data)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
```

---

## Media & Assets

### Sound Effects

#### Sound Manager
```kotlin
class SoundManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val preferencesRepository: UserPreferencesRepository
) {
    private val soundPool = SoundPool.Builder()
        .setMaxStreams(5)
        .build()

    private var moveSoundId: Int = 0
    private var checkSoundId: Int = 0
    private var gameEndSoundId: Int = 0

    init {
        moveSoundId = soundPool.load(context, R.raw.move, 1)
        checkSoundId = soundPool.load(context, R.raw.check, 1)
        gameEndSoundId = soundPool.load(context, R.raw.game_end, 1)
    }

    suspend fun playMoveSound() {
        val prefs = preferencesRepository.userPreferencesFlow.first()
        if (prefs.soundEnabled) {
            soundPool.play(moveSoundId, 1f, 1f, 1, 0, 1f)
        }
    }

    suspend fun playCheckSound() {
        val prefs = preferencesRepository.userPreferencesFlow.first()
        if (prefs.soundEnabled) {
            soundPool.play(checkSoundId, 1f, 1f, 1, 0, 1f)
        }
    }

    suspend fun playGameEndSound() {
        val prefs = preferencesRepository.userPreferencesFlow.first()
        if (prefs.soundEnabled) {
            soundPool.play(gameEndSoundId, 1f, 1f, 1, 0, 1f)
        }
    }

    fun release() {
        soundPool.release()
    }
}
```

### Image Assets

#### Piece Sets
```
res/
  drawable/
    piece_white_king.xml
    piece_white_queen.xml
    piece_white_rook.xml
    piece_white_bishop.xml
    piece_white_knight.xml
    piece_white_pawn.xml
    piece_black_king.xml
    piece_black_queen.xml
    piece_black_rook.xml
    piece_black_bishop.xml
    piece_black_knight.xml
    piece_black_pawn.xml

  drawable-night/
    (night mode variants)
```

#### Avatar Handling

##### Avatar Upload & Crop
```kotlin
class AvatarManager @Inject constructor(
    private val userApi: UserApi,
    @ApplicationContext private val context: Context
) {
    suspend fun uploadAvatar(uri: Uri, cropRect: Rect): Result<String> {
        return withContext(Dispatchers.IO) {
            try {
                // Load bitmap
                val bitmap = MediaStore.Images.Media.getBitmap(
                    context.contentResolver,
                    uri
                )

                // Crop bitmap
                val croppedBitmap = Bitmap.createBitmap(
                    bitmap,
                    cropRect.left,
                    cropRect.top,
                    cropRect.width(),
                    cropRect.height()
                )

                // Resize to 200x200
                val resizedBitmap = Bitmap.createScaledBitmap(
                    croppedBitmap,
                    200,
                    200,
                    true
                )

                // Save to temp file
                val file = File(context.cacheDir, "avatar_${System.currentTimeMillis()}.jpg")
                file.outputStream().use { stream ->
                    resizedBitmap.compress(Bitmap.CompressFormat.JPEG, 90, stream)
                }

                // Create multipart request
                val requestBody = file.asRequestBody("image/jpeg".toMediaTypeOrNull())
                val part = MultipartBody.Part.createFormData("avatar", file.name, requestBody)

                // Upload
                val user = userApi.updateProfile(avatar = part, name = null, bio = null)

                // Clean up
                file.delete()

                Result.success(user.avatarUrl)
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }
}
```

### Screenshot Generation

#### Game Result Card Generator
```kotlin
class ResultCardGenerator @Inject constructor(
    @ApplicationContext private val context: Context
) {
    fun generateResultCard(
        game: Game,
        player: User,
        opponent: User
    ): Bitmap {
        val width = 1080
        val height = 1920
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        // Draw background
        val paint = Paint().apply {
            color = Color.WHITE
            style = Paint.Style.FILL
        }
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), paint)

        // Draw logo
        val logo = BitmapFactory.decodeResource(context.resources, R.drawable.logo)
        canvas.drawBitmap(logo, 50f, 50f, null)

        // Draw "Chess99" branding
        val textPaint = Paint().apply {
            color = Color.BLACK
            textSize = 80f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        canvas.drawText("Chess99", 200f, 120f, textPaint)

        // Draw player info
        drawPlayerInfo(canvas, player, 100f, 250f, game.result == "white_wins")
        drawPlayerInfo(canvas, opponent, 100f, 450f, game.result == "black_wins")

        // Draw chessboard final position
        val boardBitmap = generateBoardBitmap(game.fen, 800)
        canvas.drawBitmap(boardBitmap, 140f, 700f, null)

        // Draw result text
        val resultText = when (game.result) {
            "white_wins" -> "White Wins!"
            "black_wins" -> "Black Wins!"
            "draw" -> "Draw"
            else -> "Game Over"
        }
        val resultPaint = Paint().apply {
            color = Color.BLACK
            textSize = 100f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            textAlign = Paint.Align.CENTER
        }
        canvas.drawText(resultText, width / 2f, 1600f, resultPaint)

        // Draw game stats
        drawGameStats(canvas, game, 100f, 1700f)

        return bitmap
    }

    private fun drawPlayerInfo(
        canvas: Canvas,
        player: User,
        x: Float,
        y: Float,
        isWinner: Boolean
    ) {
        // Draw avatar
        val avatar = loadAvatar(player.avatarUrl)
        val avatarBitmap = Bitmap.createScaledBitmap(avatar, 150, 150, true)
        canvas.drawBitmap(avatarBitmap, x, y, null)

        // Draw name
        val namePaint = Paint().apply {
            color = if (isWinner) Color.GREEN else Color.BLACK
            textSize = 50f
            typeface = if (isWinner)
                Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            else
                Typeface.DEFAULT
        }
        canvas.drawText(player.name, x + 180f, y + 75f, namePaint)

        // Draw rating
        val ratingPaint = Paint().apply {
            color = Color.GRAY
            textSize = 40f
        }
        canvas.drawText("Rating: ${player.rating}", x + 180f, y + 125f, ratingPaint)
    }

    private fun generateBoardBitmap(fen: String, size: Int): Bitmap {
        // Generate chessboard bitmap from FEN
        // Similar to ChessboardView but for static image
        // ... implementation
        return Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    }

    private fun loadAvatar(url: String): Bitmap {
        // Load avatar from URL or use default
        // ... implementation
        return BitmapFactory.decodeResource(context.resources, R.drawable.default_avatar)
    }
}
```

---

## Security & Authentication

### Authentication Flow

#### OAuth Integration
```kotlin
class OAuthManager @Inject constructor(
    private val context: Context,
    private val authApi: AuthApi,
    private val tokenManager: TokenManager
) {
    private val googleSignInClient: GoogleSignInClient by lazy {
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(context.getString(R.string.google_client_id))
            .requestEmail()
            .build()

        GoogleSignIn.getClient(context, gso)
    }

    fun getGoogleSignInIntent(): Intent {
        return googleSignInClient.signInIntent
    }

    suspend fun handleGoogleSignInResult(data: Intent?): Result<User> {
        return withContext(Dispatchers.IO) {
            try {
                val task = GoogleSignIn.getSignedInAccountFromIntent(data)
                val account = task.getResult(ApiException::class.java)

                // Send ID token to backend
                val response = authApi.oauthCallback(account.idToken!!)

                // Save token
                tokenManager.saveToken(response.token)
                tokenManager.saveUser(response.user)

                Result.success(response.user)
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }
}
```

#### Biometric Authentication
```kotlin
class BiometricAuthManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val biometricManager = BiometricManager.from(context)

    fun isBiometricAvailable(): Boolean {
        return when (biometricManager.canAuthenticate(BIOMETRIC_STRONG)) {
            BiometricManager.BIOMETRIC_SUCCESS -> true
            else -> false
        }
    }

    fun authenticate(
        activity: FragmentActivity,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        val executor = ContextCompat.getMainExecutor(context)

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Biometric Authentication")
            .setSubtitle("Log in using your biometric credential")
            .setNegativeButtonText("Use password")
            .build()

        val biometricPrompt = BiometricPrompt(
            activity,
            executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(
                    result: BiometricPrompt.AuthenticationResult
                ) {
                    super.onAuthenticationSucceeded(result)
                    onSuccess()
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    onError(errString.toString())
                }
            }
        )

        biometricPrompt.authenticate(promptInfo)
    }
}
```

### Security Best Practices

#### Network Security Config
```xml
<!-- res/xml/network_security_config.xml -->
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">api.chess99.com</domain>
        <pin-set expiration="2026-01-01">
            <pin digest="SHA-256"><!-- SHA-256 hash of cert --></pin>
            <pin digest="SHA-256"><!-- backup pin --></pin>
        </pin-set>
    </domain-config>

    <!-- Development only -->
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">10.0.2.2</domain>
        <domain includeSubdomains="true">localhost</domain>
    </domain-config>
</network-security-config>
```

#### ProGuard Rules
```proguard
# Keep model classes for Gson
-keep class com.chess99.android.data.model.** { *; }
-keepclassmembers class com.chess99.android.data.model.** { *; }

# Retrofit
-keepattributes Signature
-keepattributes Exceptions
-keep class retrofit2.** { *; }

# OkHttp
-dontwarn okhttp3.**
-keep class okhttp3.** { *; }

# Pusher
-keep class com.pusher.** { *; }
-dontwarn com.pusher.**
```

---

## Performance Requirements

### Performance Targets

#### Response Time
- Local move validation: <50ms
- Network API calls: <500ms
- WebSocket message latency: <200ms
- UI rendering: 60fps (16ms per frame)
- App cold start: <2s
- App warm start: <1s

#### Resource Usage
- Memory footprint: <150MB during active gameplay
- Network usage: <1MB per 10-minute game (excluding initial assets)
- Battery drain: <5% per hour of active play
- Storage: <100MB app size, <500MB max data

### Optimization Strategies

#### Image Optimization
```kotlin
class ImageLoader @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val imageLoader = ImageLoader.Builder(context)
        .components {
            add(SvgDecoder.Factory())
        }
        .memoryCache {
            MemoryCache.Builder(context)
                .maxSizePercent(0.25)
                .build()
        }
        .diskCache {
            DiskCache.Builder()
                .directory(context.cacheDir.resolve("image_cache"))
                .maxSizePercent(0.02)
                .build()
        }
        .build()

    suspend fun loadImage(url: String): Drawable? {
        val request = ImageRequest.Builder(context)
            .data(url)
            .build()

        return when (val result = imageLoader.execute(request)) {
            is SuccessResult -> result.drawable
            else -> null
        }
    }
}
```

#### Database Optimization
```kotlin
// Use indices for frequent queries
@Entity(
    tableName = "games",
    indices = [
        Index(value = ["status", "updatedAt"]),
        Index(value = ["whitePlayerId"]),
        Index(value = ["blackPlayerId"])
    ]
)
data class GameEntity(...)

// Use pagination for large lists
@Query("SELECT * FROM games WHERE status = :status ORDER BY updatedAt DESC LIMIT :limit OFFSET :offset")
suspend fun getGames(status: String, limit: Int, offset: Int): List<GameEntity>
```

#### Network Optimization
```kotlin
// Request compression
val okHttpClient = OkHttpClient.Builder()
    .addInterceptor { chain ->
        val request = chain.request().newBuilder()
            .addHeader("Accept-Encoding", "gzip")
            .build()
        chain.proceed(request)
    }
    .build()

// Response caching
val cacheSize = 10 * 1024 * 1024 // 10 MB
val cache = Cache(context.cacheDir, cacheSize.toLong())

val okHttpClient = OkHttpClient.Builder()
    .cache(cache)
    .addInterceptor { chain ->
        var request = chain.request()

        // Add cache control based on network availability
        request = if (networkMonitor.isOnline()) {
            request.newBuilder()
                .header("Cache-Control", "public, max-age=60")
                .build()
        } else {
            request.newBuilder()
                .header("Cache-Control", "public, only-if-cached, max-stale=${60 * 60 * 24 * 7}")
                .build()
        }

        chain.proceed(request)
    }
    .build()
```

---

## Third-Party Libraries

### Core Dependencies

```gradle
dependencies {
    // Kotlin
    implementation("org.jetbrains.kotlin:kotlin-stdlib:1.9.20")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")

    // Android Core
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.6.2")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.6.2")

    // Jetpack Compose
    implementation(platform("androidx.compose:compose-bom:2023.10.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.activity:activity-compose:1.8.1")
    implementation("androidx.navigation:navigation-compose:2.7.5")

    // Dependency Injection - Hilt
    implementation("com.google.dagger:hilt-android:2.48.1")
    kapt("com.google.dagger:hilt-compiler:2.48.1")
    implementation("androidx.hilt:hilt-navigation-compose:1.1.0")

    // Networking - Retrofit & OkHttp
    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("com.squareup.retrofit2:converter-gson:2.9.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    // WebSocket - Pusher
    implementation("com.pusher:pusher-java-client:2.4.4")

    // Local Storage - Room
    implementation("androidx.room:room-runtime:2.6.0")
    implementation("androidx.room:room-ktx:2.6.0")
    kapt("androidx.room:room-compiler:2.6.0")

    // DataStore
    implementation("androidx.datastore:datastore-preferences:1.0.0")

    // Security
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
    implementation("androidx.biometric:biometric:1.2.0-alpha05")

    // Image Loading - Coil
    implementation("io.coil-kt:coil-compose:2.5.0")
    implementation("io.coil-kt:coil-svg:2.5.0")

    // Image Cropping
    implementation("com.github.yalantis:ucrop:2.2.8")

    // OAuth
    implementation("com.google.android.gms:play-services-auth:20.7.0")
    implementation("com.facebook.android:facebook-login:16.2.0")

    // Payment - Razorpay
    implementation("com.razorpay:checkout:1.6.33")

    // Chess Engine (if available)
    // Option 1: Chess.kt (Kotlin port)
    implementation("io.github.wolfraam:chessgame:1.0.0") // Example, check availability

    // Option 2: Stockfish via JNI
    // implementation("org.petero.droidfish:stockfish:1.0") // Example

    // Date/Time
    implementation("org.jetbrains.kotlinx:kotlinx-datetime:0.5.0")

    // JSON Parsing
    implementation("com.google.code.gson:gson:2.10.1")

    // Work Manager (for background tasks)
    implementation("androidx.work:work-runtime-ktx:2.9.0")

    // Accompanist (Compose utilities)
    implementation("com.google.accompanist:accompanist-permissions:0.32.0")
    implementation("com.google.accompanist:accompanist-systemuicontroller:0.32.0")

    // Testing
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.7.3")
    testImplementation("io.mockk:mockk:1.13.8")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
```

### Chess Engine Integration

#### Option A: Pure Kotlin Chess Library
```kotlin
// If using a Kotlin chess library
class KotlinChessEngine @Inject constructor() : ChessEngine {
    private var game: ChessGame = ChessGame()

    override fun loadFen(fen: String) {
        game = ChessGame.fromFen(fen)
    }

    override fun isLegalMove(from: String, to: String): Boolean {
        return game.isLegalMove(from, to)
    }

    override fun makeMove(from: String, to: String, promotion: String?): Move? {
        return try {
            game.makeMove(from, to, promotion)
        } catch (e: Exception) {
            null
        }
    }

    override fun getLegalMoves(square: String): List<String> {
        return game.getLegalMovesForSquare(square)
    }

    override fun isCheck(): Boolean {
        return game.isCheck()
    }

    override fun isCheckmate(): Boolean {
        return game.isCheckmate()
    }

    override fun isStalemate(): Boolean {
        return game.isStalemate()
    }

    override fun getCurrentFen(): String {
        return game.toFen()
    }
}
```

#### Option B: Stockfish via JNI
```kotlin
class StockfishEngine @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private external fun initStockfish(dataDir: String): Boolean
    private external fun sendCommand(command: String): String
    private external fun stopStockfish()

    companion object {
        init {
            System.loadLibrary("stockfish")
        }
    }

    private var isInitialized = false

    fun initialize() {
        if (!isInitialized) {
            isInitialized = initStockfish(context.filesDir.absolutePath)
        }
    }

    suspend fun getBestMove(fen: String, depth: Int = 10): String {
        return withContext(Dispatchers.IO) {
            sendCommand("position fen $fen")
            sendCommand("go depth $depth")
            // Parse response for best move
            // ...
            ""
        }
    }

    fun shutdown() {
        if (isInitialized) {
            stopStockfish()
            isInitialized = false
        }
    }
}

// C++ JNI wrapper (stockfish-jni.cpp)
/*
#include <jni.h>
#include "stockfish.h"

extern "C" JNIEXPORT jboolean JNICALL
Java_com_chess99_android_chess_StockfishEngine_initStockfish(
    JNIEnv* env,
    jobject thiz,
    jstring dataDir
) {
    // Initialize Stockfish engine
    return JNI_TRUE;
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_chess99_android_chess_StockfishEngine_sendCommand(
    JNIEnv* env,
    jobject thiz,
    jstring command
) {
    // Send UCI command to Stockfish
    // Return response
    return env->NewStringUTF("");
}
*/
```

---

## Development Phases

### Phase 1: Foundation (Weeks 1-3)
- [ ] Project setup and architecture
- [ ] Dependency injection with Hilt
- [ ] Network layer with Retrofit
- [ ] Room database setup
- [ ] Authentication flow (email/password, OAuth)
- [ ] Token management
- [ ] Navigation graph
- [ ] Basic UI theme and design system

### Phase 2: Chess Engine & Core Gameplay (Weeks 4-6)
- [ ] Chess engine integration (chess.js port or native library)
- [ ] FEN parsing and validation
- [ ] Chessboard UI component (Compose)
- [ ] Drag-and-drop move input
- [ ] Move validation and legal move highlighting
- [ ] Play vs Computer mode
- [ ] Stockfish integration for AI
- [ ] Move history and navigation
- [ ] Game save/load locally

### Phase 3: Multiplayer Foundation (Weeks 7-9)
- [ ] WebSocket integration (Pusher client)
- [ ] Real-time game synchronization
- [ ] Polling fallback implementation
- [ ] Game creation and invitation system
- [ ] Accept/decline invitations
- [ ] Live move updates
- [ ] Opponent presence detection
- [ ] Basic game controls (pause, resume, resign)

### Phase 4: Advanced Multiplayer Features (Weeks 10-12)
- [ ] Chess clock with time increments
- [ ] Draw offer system
- [ ] Forfeit on timeout
- [ ] Rematch functionality
- [ ] Ping opponent
- [ ] Inactivity auto-pause
- [ ] Game end animations
- [ ] Push notifications for game events

### Phase 5: Lobby & Social (Weeks 13-15)
- [ ] Lobby screen with online players
- [ ] Player search and filtering
- [ ] Friend system (add, remove, pending)
- [ ] Invitation management UI
- [ ] User profile screen
- [ ] Avatar upload and cropping
- [ ] Rating display
- [ ] Statistics dashboard

### Phase 6: Tutorial System (Weeks 16-18)
- [ ] Tutorial module listing
- [ ] Lesson detail screen
- [ ] Interactive lesson player
- [ ] Move validation for lessons
- [ ] Hint system
- [ ] Progress tracking
- [ ] XP and achievements
- [ ] Daily challenges

### Phase 7: Championships (Weeks 19-22)
- [ ] Championship listing and filtering
- [ ] Championship detail screen
- [ ] Registration with payment (Razorpay)
- [ ] Participant management
- [ ] Match scheduling system
- [ ] Schedule proposals
- [ ] Match game creation
- [ ] Result reporting
- [ ] Standings/leaderboard
- [ ] Tournament administration (for creators)
- [ ] Round generation
- [ ] Bracket visualization (Elimination)

### Phase 8: History & Sharing (Weeks 23-24)
- [ ] Game history browsing
- [ ] Game replay with navigation
- [ ] PGN export
- [ ] Result card generation
- [ ] Social sharing (Share Sheet)
- [ ] Public game viewer

### Phase 9: Polish & Optimization (Weeks 25-27)
- [ ] Sound effects implementation
- [ ] Animations and transitions
- [ ] Performance optimization
- [ ] Memory leak fixes
- [ ] Network resilience improvements
- [ ] Offline mode enhancements
- [ ] Dark theme support
- [ ] Accessibility improvements

### Phase 10: Testing & QA (Weeks 28-30)
- [ ] Unit tests for business logic
- [ ] Integration tests for repositories
- [ ] UI tests with Compose Testing
- [ ] End-to-end tests
- [ ] Performance testing
- [ ] Security audit
- [ ] Beta testing with users
- [ ] Bug fixes and refinements

### Phase 11: Deployment Preparation (Weeks 31-32)
- [ ] App signing configuration
- [ ] ProGuard/R8 optimization
- [ ] Final asset optimization
- [ ] Play Store listing preparation
- [ ] Screenshots and promo materials
- [ ] Privacy policy and terms of service
- [ ] Release build testing
- [ ] Submission to Play Store

---

## Testing Strategy

### Unit Testing

#### ViewModel Tests
```kotlin
@ExperimentalCoroutinesTest
class GameViewModelTest {
    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private lateinit var viewModel: GameViewModel
    private lateinit var gameRepository: GameRepository
    private lateinit var chessEngine: ChessEngine

    @Before
    fun setup() {
        gameRepository = mockk()
        chessEngine = mockk()
        viewModel = GameViewModel(gameRepository, chessEngine, mockk(), mockk())
    }

    @Test
    fun `makeMove with legal move updates position`() = runTest {
        // Given
        val initialFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        val move = Move("e2", "e4")
        coEvery { chessEngine.validateMove(any(), any(), any(), any()) } returns move
        coEvery { gameRepository.makeMove(any(), any()) } returns mockk()

        // When
        viewModel.makeMove("e2", "e4")

        // Then
        coVerify { gameRepository.makeMove(any(), move) }
    }

    @Test
    fun `makeMove with illegal move shows error`() = runTest {
        // Given
        coEvery { chessEngine.validateMove(any(), any(), any(), any()) } returns null

        // When
        viewModel.makeMove("e2", "e5")
        advanceUntilIdle()

        // Then
        val state = viewModel.gameState.value
        assertTrue(state is GameState.Error)
    }
}
```

### Integration Testing

#### Repository Tests
```kotlin
@ExperimentalCoroutinesTest
class GameRepositoryTest {
    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private lateinit var repository: GameRepositoryImpl
    private lateinit var gameApi: GameApi
    private lateinit var gameDao: GameDao
    private lateinit var networkMonitor: NetworkMonitor

    @Before
    fun setup() {
        gameApi = mockk()
        gameDao = mockk()
        networkMonitor = mockk()
        repository = GameRepositoryImpl(gameApi, mockk(), gameDao, networkMonitor)
    }

    @Test
    fun `getGame when online fetches from API and caches`() = runTest {
        // Given
        val game = mockk<Game>()
        coEvery { networkMonitor.isOnline() } returns true
        coEvery { gameApi.getGame(any()) } returns game
        coEvery { gameDao.insertGame(any()) } just Runs

        // When
        val result = repository.getGame("game123")

        // Then
        assertEquals(game, result)
        coVerify { gameDao.insertGame(any()) }
    }

    @Test
    fun `getGame when offline returns cached data`() = runTest {
        // Given
        val cachedGame = mockk<GameEntity>()
        coEvery { networkMonitor.isOnline() } returns false
        coEvery { gameDao.getGame(any()) } returns cachedGame

        // When
        val result = repository.getGame("game123")

        // Then
        assertNotNull(result)
        coVerify(exactly = 0) { gameApi.getGame(any()) }
    }
}
```

### UI Testing

#### Compose UI Tests
```kotlin
@ExperimentalCoroutinesTest
class GameScreenTest {
    @get:Rule
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Test
    fun chessboard_displays_initial_position() {
        composeTestRule.setContent {
            ChessboardView(
                position = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                orientation = "w",
                onSquareClick = {},
                onPieceDrag = { _, _ -> }
            )
        }

        // Verify chessboard is displayed
        composeTestRule.onNodeWithTag("chessboard").assertExists()
    }

    @Test
    fun makeMove_button_enabled_when_my_turn() {
        val viewModel = mockk<GameViewModel>(relaxed = true)
        every { viewModel.isMyTurn } returns MutableStateFlow(true)

        composeTestRule.setContent {
            GameScreen(viewModel = viewModel, onNavigateBack = {})
        }

        composeTestRule.onNodeWithText("Offer Draw").assertIsEnabled()
    }
}
```

### End-to-End Testing

#### E2E Test Scenarios
```kotlin
@RunWith(AndroidJUnit4::class)
class MultiplayerGameE2ETest {
    @get:Rule
    val activityRule = ActivityScenarioRule(MainActivity::class.java)

    @Test
    fun complete_multiplayer_game_flow() {
        // 1. Login
        onView(withId(R.id.email_input)).perform(typeText("test@example.com"))
        onView(withId(R.id.password_input)).perform(typeText("password123"))
        onView(withId(R.id.login_button)).perform(click())

        // 2. Navigate to lobby
        onView(withId(R.id.lobby_button)).perform(click())

        // 3. Send invitation
        onView(withText("Opponent Name")).perform(click())
        onView(withId(R.id.send_invitation_button)).perform(click())

        // 4. Wait for acceptance (requires mock server or second device)
        Thread.sleep(2000)

        // 5. Verify game screen opens
        onView(withId(R.id.chessboard)).check(matches(isDisplayed()))

        // 6. Make a move
        onView(withId(R.id.square_e2)).perform(click())
        onView(withId(R.id.square_e4)).perform(click())

        // 7. Verify move is reflected
        // ... additional assertions
    }
}
```

---

## Deployment Considerations

### App Signing

#### Release Keystore Configuration
```gradle
android {
    signingConfigs {
        release {
            storeFile file(System.getenv("KEYSTORE_FILE") ?: "release.keystore")
            storePassword System.getenv("KEYSTORE_PASSWORD")
            keyAlias System.getenv("KEY_ALIAS")
            keyPassword System.getenv("KEY_PASSWORD")
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

### Build Variants

#### Flavor Configuration
```gradle
android {
    flavorDimensions "environment"

    productFlavors {
        dev {
            dimension "environment"
            applicationIdSuffix ".dev"
            versionNameSuffix "-dev"
            buildConfigField "String", "API_BASE_URL", "\"http://10.0.2.2:8000/api/\""
            buildConfigField "String", "REVERB_HOST", "\"10.0.2.2\""
            buildConfigField "int", "REVERB_PORT", "8080"
            buildConfigField "boolean", "REVERB_ENCRYPTED", "false"
        }

        staging {
            dimension "environment"
            applicationIdSuffix ".staging"
            versionNameSuffix "-staging"
            buildConfigField "String", "API_BASE_URL", "\"https://staging-api.chess99.com/api/\""
            buildConfigField "String", "REVERB_HOST", "\"staging-reverb.chess99.com\""
            buildConfigField "int", "REVERB_PORT", "443"
            buildConfigField "boolean", "REVERB_ENCRYPTED", "true"
        }

        prod {
            dimension "environment"
            buildConfigField "String", "API_BASE_URL", "\"https://api.chess99.com/api/\""
            buildConfigField "String", "REVERB_HOST", "\"reverb.chess99.com\""
            buildConfigField "int", "REVERB_PORT", "443"
            buildConfigField "boolean", "REVERB_ENCRYPTED", "true"
        }
    }
}
```

### Play Store Assets

#### Required Materials
- [ ] App icon (512x512 PNG)
- [ ] Feature graphic (1024x500 PNG)
- [ ] Screenshots (minimum 2, up to 8 per device type)
  - Phone: 1080x1920 or 1080x2340
  - Tablet: 1536x2048 or 1600x2560
- [ ] App description (short: 80 chars, full: 4000 chars)
- [ ] Privacy policy URL
- [ ] Content rating questionnaire responses
- [ ] Target audience and content declaration

#### Release Checklist
- [ ] Update version code and version name
- [ ] Test on multiple devices (phones and tablets)
- [ ] Verify all API endpoints use production URLs
- [ ] Ensure no debug logging in release build
- [ ] Test payment flows with live credentials
- [ ] Verify OAuth credentials for production
- [ ] Check ProGuard rules don't break functionality
- [ ] Test app signing and keystore
- [ ] Verify app permissions are minimal and justified
- [ ] Test deep links and app links
- [ ] Ensure all strings are externalized for i18n
- [ ] Verify compliance with Play Store policies
- [ ] Test on Android 8.0 (minimum SDK)
- [ ] Test on latest Android version
- [ ] Generate signed AAB (Android App Bundle)

---

## Summary

This document provides a comprehensive blueprint for developing a native Android application that replicates the full functionality of the Chess-Web React frontend. Key highlights:

### Technology Recommendations
- **Language**: Kotlin
- **UI**: Jetpack Compose (modern, React-like)
- **Architecture**: MVVM with Hilt DI
- **Networking**: Retrofit + OkHttp + Pusher
- **Database**: Room + DataStore
- **Chess Engine**: Chess.kt or Stockfish via JNI

### Critical Success Factors
1. **Real-time Performance**: WebSocket with polling fallback
2. **Offline Capability**: Local game storage and caching
3. **Security**: Encrypted token storage, SSL pinning
4. **User Experience**: 60fps animations, <500ms network latency
5. **Feature Parity**: All web features available on mobile

### Development Timeline
**Estimated**: 32 weeks (8 months) for full feature parity
- Weeks 1-6: Foundation and chess engine
- Weeks 7-12: Multiplayer functionality
- Weeks 13-22: Social features and tournaments
- Weeks 23-27: Polish and optimization
- Weeks 28-32: Testing and deployment

### Next Steps
1. Set up Android Studio project with recommended architecture
2. Implement authentication and basic navigation
3. Integrate chess engine and build chessboard UI
4. Connect to backend APIs
5. Implement WebSocket real-time sync
6. Iterate through feature phases

This document should be used as a reference throughout the Android development process, with regular updates as new requirements emerge or architectural decisions evolve.

---

**Document Prepared By**: Claude Code Analysis Agent
**Last Updated**: 2025-11-23
**Version**: 1.0
