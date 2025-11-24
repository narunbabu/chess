# Android Landing Page Implementation Guide

## Overview

This document provides your Android builder with detailed specifications to replicate the Chess99 landing page design and functionality from the web application. The landing page follows a modern, kid-friendly design with specific components and interactions that need to be adapted for Android.

## Current Web Implementation Analysis

### Page Structure
The web landing page consists of 4 main sections:
1. **Fixed Header** - Navigation and authentication buttons
2. **Hero Section** - Background image with call-to-action buttons
3. **Stats Section** - Impact metrics with colorful cards
4. **Features Section** - Interactive feature cards
5. **Footer** - Simple footer with links

### Key Design Elements

#### Color Palette (CSS Variables)
```css
--brand: #0284c7;      /* sky-600 - Primary blue */
--brand-2: #0ea5e9;    /* sky-500 - Secondary blue */
--accent: #f59e0b;     /* amber-500 - Accent/orange */
--success: #10b981;    /* emerald-500 - Green */
--ink: #1f2937;        /* slate-800 - Dark text */
```

#### Typography & Spacing
- **Headlines**: Bold, extra-large fonts (2xl-6xl) with high contrast
- **Body Text**: System fonts, responsive sizing
- **Spacing**: Tailwind-based spacing system (4px base unit)
- **Border Radius**: 12px for cards, rounded-full for circles

#### Card Design System
- **Background**: White with subtle shadows (#ffffff, box-shadow: 0 2px 4px rgba(0,0,0,0.05))
- **Hover Effects**: Transform translateY(-4px), enhanced shadows
- **Avatars**: 56px circles with colored backgrounds
- **Buttons**: Gradient backgrounds with hover animations

## Android Implementation Specifications

### 1. Architecture Components

#### Recommended Jetpack Compose Structure
```kotlin
// Screen-level composable
@Composable
fun LandingScreen(
    uiState: LandingUiState,
    onNavigateToPlay: () -> Unit,
    onNavigateToLogin: () -> Unit,
    onNavigateToSignup: () -> Unit,
    onNavigateToPuzzles: () -> Unit,
    onNavigateToLearn: () -> Unit,
    // ... other navigation callbacks
) {
    // Main screen implementation
}

// ViewModel
@HiltViewModel
class LandingViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {
    // State management and business logic
}

// Data class for UI state
data class LandingUiState(
    val isAuthenticated: Boolean = false,
    val isLoading: Boolean = false,
    val showMobileMenu: Boolean = false
)
```

#### Component Breakdown
```kotlin
// Header Component
@Composable
fun LandingHeader(
    isAuthenticated: Boolean,
    onNavigateToPlay: () -> Unit,
    onNavigateToLogin: () -> Unit,
    onNavigateToSignup: () -> Unit,
    // ...
)

// Hero Section Component
@Composable
fun HeroSection(
    isAuthenticated: Boolean,
    onPlayComputer: () -> Unit,
    onPlayFriends: () -> Unit,
    onLearnChess: () -> Unit,
    // ...
)

// Stats Section Component
@Composable
fun StatsSection(
    stats: List<StatItem>
)

// Features Section Component
@Composable
fun FeaturesSection(
    onNavigateToPuzzles: () -> Unit,
    onNavigateToLearn: () -> Unit,
    onNavigateToTournaments: () -> Unit
)
```

### 2. Header Implementation

#### Fixed Header Design
```kotlin
@Composable
fun LandingHeader(
    isAuthenticated: Boolean,
    onNavigateToPlay: () -> Unit,
    onNavigateToLogin: () -> Unit,
    onNavigateToSignup: () -> Unit,
    onNavigateToPuzzles: () -> Unit,
    onNavigateToLearn: () -> Unit,
    onNavigateToTutorial: () -> Unit,
    modifier: Modifier = Modifier
) {
    // Fixed position at top using Box with ConstraintLayout or CoordinatorLayout
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(64.dp) // h-16 = 64dp
            .background(
                color = Color(0xFF0284C7), // sky-600
                alpha = 0.95f
            )
            .shadow(4.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp), // px-4
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Logo section
            LogoSection()

            // Navigation (desktop/tablet only)
            if (LocalConfiguration.current.screenWidthDp > 768) {
                DesktopNavigation(
                    onNavigateToPuzzles = onNavigateToPuzzles,
                    onNavigateToLearn = onNavigateToLearn,
                    onNavigateToTutorial = onNavigateToTutorial
                )
            }

            // Auth buttons and mobile menu
            AuthSection(
                isAuthenticated = isAuthenticated,
                onNavigateToPlay = onNavigateToPlay,
                onNavigateToLogin = onNavigateToLogin,
                onNavigateToSignup = onNavigateToSignup,
                isMobile = LocalConfiguration.current.screenWidthDp <= 768
            )
        }
    }
}
```

#### Button Styling
```kotlin
// Primary CTA Button (Play button)
@Composable
fun PrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Button(
        onClick = onClick,
        modifier = modifier,
        colors = ButtonDefaults.buttonColors(
            containerColor = Color(0xFFF97316), // orange-500
            contentColor = Color.White
        ),
        shape = RoundedCornerShape(8.dp), // rounded-lg
        elevation = ButtonDefaults.buttonElevation(4.dp)
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelMedium.copy(
                fontWeight = FontWeight.Bold
            )
        )
    }
}

// Secondary Button (Sign Up)
@Composable
fun SecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Button(
        onClick = onClick,
        modifier = modifier,
        colors = ButtonDefaults.buttonColors(
            containerColor = Color(0xFFFBBF24), // yellow-400
            contentColor = Color(0xFF1F2937) // gray-800
        ),
        shape = RoundedCornerShape(8.dp),
        elevation = ButtonDefaults.buttonElevation(4.dp)
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelMedium.copy(
                fontWeight = FontWeight.Bold
            )
        )
    }
}
```

### 3. Hero Section Implementation

#### Hero Section with Background Image
```kotlin
@Composable
fun HeroSection(
    isAuthenticated: Boolean,
    onPlayComputer: () -> Unit,
    onPlayFriends: () -> Unit,
    onLearnChess: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 500.dp, max = 700.dp) // 60vh min/max
    ) {
        // Background image with overlay
        AsyncImage(
            model = R.drawable.chess_playing_kids, // Add to drawable resources
            contentDescription = "Kids playing chess",
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop
        )

        // Gradient overlay
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            Color(0xFF0EA5E9).copy(alpha = 0.1f), // sky-400/10
                            Color(0xFF7DD3FC).copy(alpha = 0.05f), // sky-200/5
                            Color(0xFFBAE6FD).copy(alpha = 0.1f)  // sky-200/10
                        )
                    )
                )
        )

        // Content overlay
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Headline with backdrop
            HeadlineCard()

            Spacer(modifier = Modifier.height(32.dp))

            // Action buttons
            ActionButtons(
                isAuthenticated = isAuthenticated,
                onPlayComputer = onPlayComputer,
                onPlayFriends = onPlayFriends,
                onLearnChess = onLearnChess
            )
        }
    }
}

@Composable
fun HeadlineCard() {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color.Black.copy(alpha = 0.3f)
        ),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "India's Best Chess Site for Kids",
                style = MaterialTheme.typography.headlineMedium.copy(
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    fontSize = when (LocalConfiguration.current.screenWidthDp) {
                        in 0..480 -> 24.sp   // text-2xl
                        in 481..768 -> 36.sp  // text-4xl
                        else -> 48.sp          // text-6xl
                    }
                ),
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "Learn, Play, and Have Fun with Chess!",
                style = MaterialTheme.typography.bodyLarge.copy(
                    color = Color.White.copy(alpha = 0.95f),
                    fontSize = when (LocalConfiguration.current.screenWidthDp) {
                        in 0..480 -> 14.sp   // text-sm
                        in 481..768 -> 18.sp  // text-lg
                        else -> 24.sp          // text-2xl
                    }
                ),
                textAlign = TextAlign.Center
            )
        }
    }
}
```

### 4. Stats Section Implementation

#### Stats Cards
```kotlin
@Composable
fun StatsSection(
    stats: List<StatItem>,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(Color(0xFFF0F9FF)) // sky-50
            .padding(16.dp)
    ) {
        Text(
            text = "Our Impact in Numbers",
            style = MaterialTheme.typography.headlineMedium.copy(
                fontWeight = FontWeight.ExtraBold,
                color = Color(0xFF1F2937) // slate-800
            ),
            textAlign = TextAlign.Center,
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 32.dp)
        )

        LazyVerticalGrid(
            columns = GridCells.Adaptive(minSize = 140.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            items(stats) { stat ->
                StatCard(stat = stat)
            }
        }
    }
}

@Composable
fun StatCard(stat: StatItem) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .height(180.dp)
            .clickable { /* Handle click if needed */ },
        colors = CardDefaults.cardColors(
            containerColor = Color.White
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Avatar with color
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .background(
                        color = stat.avatarColor,
                        shape = CircleShape
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = stat.icon,
                    fontSize = 28.sp
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = stat.number,
                style = MaterialTheme.typography.headlineLarge.copy(
                    fontWeight = FontWeight.Black,
                    color = Color(0xFF1F2937)
                )
            )

            Text(
                text = stat.label,
                style = MaterialTheme.typography.bodySmall.copy(
                    fontWeight = FontWeight.SemiBold,
                    color = Color(0xFF64748B),
                    letterSpacing = 0.1.em
                ),
                textAlign = TextAlign.Center
            )
        }
    }
}

data class StatItem(
    val number: String,
    val label: String,
    val icon: String,
    val avatarColor: Color
)

// Sample data
val statsData = listOf(
    StatItem("12M+", "Happy Kids", "😊", Color(0xFFFFEDD5)), // bg-orange
    StatItem("28,000+", "Schools", "🏫", Color(0xFFE0E7FF)), // bg-blue
    StatItem("91M+", "Games Played", "♟️", Color(0xFFD1FAE5)), // bg-green
    StatItem("113M+", "Puzzles Solved", "🧩", Color(0xFFF3E8FF)), // bg-purple
    StatItem("16M+", "Lessons Taken", "📚", Color(0xFFFCE7F3)) // bg-pink
)
```

### 5. Features Section Implementation

#### Feature Cards
```kotlin
@Composable
fun FeaturesSection(
    onNavigateToPuzzles: () -> Unit,
    onNavigateToLearn: () -> Unit,
    onNavigateToTournaments: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        Color(0xFFF8FAFC), // slate-50
                        Color(0xFFF3F4F6)  // gray-100
                    )
                )
            )
            .padding(16.dp)
    ) {
        Text(
            text = "Play Chess with Other Kids",
            style = MaterialTheme.typography.headlineMedium.copy(
                fontWeight = FontWeight.ExtraBold,
                color = Color(0xFF1F2937)
            ),
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth()
        )

        Text(
            text = "Learning with ChessKid is fun! Play games, watch video lessons, and solve fun puzzles!",
            style = MaterialTheme.typography.bodyLarge.copy(
                color = Color(0xFF6B7280)
            ),
            textAlign = TextAlign.Center,
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 16.dp)
        )

        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(horizontal = 16.dp)
        ) {
            item {
                FeatureCard(
                    title = "Solve Puzzles",
                    subtitle = "Challenge yourself with thousands of chess puzzles",
                    icon = "🧩",
                    onClick = onNavigateToPuzzles
                )
            }
            item {
                FeatureCard(
                    title = "Start Learning",
                    subtitle = "Watch fun videos and interactive lessons",
                    icon = "📚",
                    onClick = onNavigateToLearn
                )
            }
            item {
                FeatureCard(
                    title = "Join Tournaments",
                    subtitle = "Compete with players from around the world",
                    icon = "🏆",
                    onClick = onNavigateToTournaments
                )
            }
        }
    }
}

@Composable
fun FeatureCard(
    title: String,
    subtitle: String,
    icon: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        onClick = onClick,
        modifier = modifier
            .width(300.dp)
            .height(200.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color.White
        ),
        elevation = CardDefaults.cardElevation(
            defaultElevation = 4.dp,
            pressedElevation = 8.dp
        ),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Avatar with gradient
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .background(
                        brush = Brush.linearGradient(
                            colors = listOf(
                                Color(0xFF0284C7), // sky-600
                                Color(0xFF0EA5E9)  // sky-500
                            )
                        ),
                        shape = CircleShape
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = icon,
                    fontSize = 24.sp
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = title,
                style = MaterialTheme.typography.titleLarge.copy(
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF1F2937)
                ),
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodyMedium.copy(
                    color = Color(0xFF6B7280)
                ),
                textAlign = TextAlign.Center
            )
        }
    }
}
```

### 6. Footer Implementation

```kotlin
@Composable
fun LandingFooter(
    onNavigateToPuzzles: () -> Unit,
    onNavigateToLearn: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(Color(0xFF111827)) // gray-900
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "© 2024 Chess99. Making Chess Fun for Kids!",
            style = MaterialTheme.typography.bodyMedium.copy(
                color = Color(0xFF9CA3AF) // gray-400
            ),
            modifier = Modifier.padding(bottom = 16.dp)
        )

        Row(
            horizontalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            TextButton(
                onClick = onNavigateToPuzzles,
                colors = ButtonDefaults.textButtonColors(
                    contentColor = Color(0xFF9CA3AF)
                )
            ) {
                Text("Puzzles")
            }

            TextButton(
                onClick = onNavigateToLearn,
                colors = ButtonDefaults.textButtonColors(
                    contentColor = Color(0xFF9CA3AF)
                )
            ) {
                Text("Learn")
            }

            TextButton(
                onClick = { /* Handle About */ },
                colors = ButtonDefaults.textButtonColors(
                    contentColor = Color(0xFF9CA3AF)
                )
            ) {
                Text("About")
            }

            TextButton(
                onClick = { /* Handle Contact */ },
                colors = ButtonDefaults.textButtonColors(
                    contentColor = Color(0xFF9CA3AF)
                )
            ) {
                Text("Contact")
            }
        }
    }
}
```

### 7. Navigation Integration

#### Navigation Setup
```kotlin
@Composable
fun ChessNavigation(
    navController: NavHostController = rememberNavController()
) {
    NavHost(
        navController = navController,
        startDestination = "landing"
    ) {
        composable("landing") {
            LandingScreen(
                onNavigateToPlay = { navController.navigate("play") },
                onNavigateToLogin = { navController.navigate("login") },
                onNavigateToSignup = { navController.navigate("signup") },
                onNavigateToPuzzles = { navController.navigate("puzzles") },
                onNavigateToLearn = { navController.navigate("learn") },
                onNavigateToTutorial = { navController.navigate("tutorial") },
                onNavigateToTournaments = { navController.navigate("tournaments") }
            )
        }

        // Add other destinations...
        composable("play") { PlayScreen() }
        composable("login") { LoginScreen() }
        // etc.
    }
}
```

### 8. Responsive Design Guidelines

#### Screen Size Breakpoints
```kotlin
sealed class ScreenSize(val dp: Int) {
    object Compact : ScreenSize(0..480)      // Mobile
    object Medium : ScreenSize(481..768)     // Tablet
    object Expanded : ScreenSize(769..Int.MAX_VALUE) // Desktop/Tablet
}

@Composable
fun rememberScreenSize(): ScreenSize {
    val configuration = LocalConfiguration.current
    val screenWidthDp = configuration.screenWidthDp

    return remember(screenWidthDp) {
        when {
            screenWidthDp <= 480 -> ScreenSize.Compact
            screenWidthDp <= 768 -> ScreenSize.Medium
            else -> ScreenSize.Expanded
        }
    }
}
```

#### Responsive Components
```kotlin
@Composable
fun ResponsiveLandingContent(
    uiState: LandingUiState,
    screenSize: ScreenSize,
    // navigation callbacks...
) {
    when (screenSize) {
        is ScreenSize.Compact -> {
            // Mobile layout with stacked elements
            CompactLandingLayout(uiState, /* callbacks */)
        }
        is ScreenSize.Medium -> {
            // Tablet layout with adjusted spacing
            MediumLandingLayout(uiState, /* callbacks */)
        }
        is ScreenSize.Expanded -> {
            // Desktop/tablet layout with horizontal arrangements
            ExpandedLandingLayout(uiState, /* callbacks */)
        }
    }
}
```

### 9. Animation & Transitions

#### Hero Animations
```kotlin
@Composable
fun AnimatedHeroSection(
    isAuthenticated: Boolean,
    onPlayComputer: () -> Unit,
    onPlayFriends: () -> Unit,
    onLearnChess: () -> Unit
) {
    val visibleState by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        visibleState = true
    }

    Box(
        modifier = Modifier.fillMaxSize()
    ) {
        // Background and overlays...

        AnimatedVisibility(
            visible = visibleState,
            enter = fadeIn(
                animationSpec = tween(1000)
            ) + slideInVertically(
                initialOffsetY = { fullHeight -> fullHeight },
                animationSpec = tween(1000, easing = EaseOutCubic)
            ),
            modifier = Modifier.fillMaxSize()
        ) {
            HeroContent(
                isAuthenticated = isAuthenticated,
                onPlayComputer = onPlayComputer,
                onPlayFriends = onPlayFriends,
                onLearnChess = onLearnChess
            )
        }
    }
}
```

#### Button Press Animations
```kotlin
@Composable
fun AnimatedPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    var isPressed by remember { mutableStateOf(false) }

    Button(
        onClick = {
            isPressed = true
            onClick()
        },
        modifier = modifier.scale(
            animateFloatAsState(
                targetValue = if (isPressed) 0.95f else 1f,
                animationSpec = spring(
                    dampingRatio = Spring.DampingRatioMediumBouncy
                )
            ).value
        ),
        colors = ButtonDefaults.buttonColors(
            containerColor = Color(0xFFF97316)
        )
    ) {
        Text(text = text)
    }

    LaunchedEffect(isPressed) {
        if (isPressed) {
            delay(100)
            isPressed = false
        }
    }
}
```

### 10. Testing Strategy

#### UI Tests
```kotlin
@Test
fun landingPage_displaysCorrectContent() {
    composeTestRule.setContent {
        ChessTheme {
            LandingScreen(
                uiState = LandingUiState(isAuthenticated = false),
                onNavigateToPlay = { },
                onNavigateToLogin = { },
                onNavigateToSignup = { },
                onNavigateToPuzzles = { },
                onNavigateToLearn = { }
            )
        }
    }

    // Verify header elements
    composeTestRule
        .onNodeWithText("Play")
        .assertIsDisplayed()

    composeTestRule
        .onNodeWithText("Sign Up")
        .assertIsDisplayed()

    // Verify hero section
    composeTestRule
        .onNodeWithText("India's Best Chess Site for Kids")
        .assertIsDisplayed()

    // Verify stats section
    composeTestRule
        .onNodeWithText("Our Impact in Numbers")
        .assertIsDisplayed()
}

@Test
fun authenticatedUser_showsDifferentActions() {
    composeTestRule.setContent {
        ChessTheme {
            LandingScreen(
                uiState = LandingUiState(isAuthenticated = true),
                onNavigateToPlay = { },
                onNavigateToLogin = { },
                onNavigateToSignup = { },
                onNavigateToPuzzles = { },
                onNavigateToLearn = { }
            )
        }
    }

    // Authenticated users see different options
    composeTestRule
        .onNodeWithText("Choose Your Opponent")
        .assertIsDisplayed()

    composeTestRule
        .onNodeWithText("Play with Computer")
        .assertIsDisplayed()

    composeTestRule
        .onNodeWithText("Play with Friends")
        .assertIsDisplayed()
}
```

### 11. Performance Optimizations

#### Image Loading
```kotlin
@Composable
fun OptimizedBackgroundImage(
    @DrawableRes imageRes: Int,
    contentDescription: String?,
    modifier: Modifier = Modifier
) {
    AsyncImage(
        model = ImageRequest.Builder(LocalContext.current)
            .data(imageRes)
            .memoryCachePolicy(CachePolicy.ENABLED)
            .diskCachePolicy(CachePolicy.ENABLED)
            .build(),
        contentDescription = contentDescription,
        modifier = modifier,
        contentScale = ContentScale.Crop,
        loading = {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        },
        error = {
            // Fallback gradient background
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(
                                Color(0xFF0EA5E9),
                                Color(0xFFBAE6FD)
                            )
                        )
                    )
            )
        }
    )
}
```

### 12. Accessibility Guidelines

#### Content Descriptions
```kotlin
@Composable
fun AccessibleButton(
    text: String,
    contentDescription: String,
    onClick: () -> Unit
) {
    Button(
        onClick = onClick,
        modifier = Modifier.semantics {
            this.contentDescription = contentDescription
            this.role = Role.Button
        }
    ) {
        Text(text)
    }
}
```

#### Accessibility Testing
```kotlin
@Test
fun landingPage_isAccessible() {
    composeTestRule.setContent {
        ChessTheme {
            LandingScreen(/*...*/)
        }
    }

    composeTestRule.onRoot().assertIsScreenReaderEnabled()

    // Test navigation with talkback
    composeTestRule
        .onNodeWithContentDescription("Play computer chess")
        .assertIsDisplayed()
        .performClick()
}
```

### 13. Required Assets

#### Drawables Needed
- `ic_chess_logo.xml` - App logo vector drawable
- `chess_playing_kids.jpg` - Hero background image
- Navigation icons (hamburger menu, etc.)

#### Colors (colors.xml)
```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- Brand Colors -->
    <color name="brand_primary">#0284C7</color>
    <color name="brand_secondary">#0EA5E9</color>
    <color name="accent_orange">#F97316</color>
    <color name="success_green">#10B981</color>
    <color name="text_ink">#1F2937</color>

    <!-- Surface Colors -->
    <color name="surface_white">#FFFFFF</color>
    <color name="surface_gray">#F8FAFC</color>
    <color name="surface_dark">#111827</color>
</resources>
```

### 14. Integration with Existing Android Architecture

#### Repository Integration
```kotlin
@Singleton
class AuthRepository @Inject constructor(
    private val authApi: AuthApi,
    private val userPreferences: DataStore<Preferences>
) {
    val isAuthenticated: Flow<Boolean> = userPreferences.data.map { preferences ->
        preferences[PreferencesKeys.IS_AUTHENTICATED] ?: false
    }

    suspend fun login(email: String, password: String): Result<User> {
        // Implement login logic matching web API
    }
}
```

#### API Integration
```kotlin
interface ChessApi {
    @GET("/api/user/profile")
    suspend fun getUserProfile(): Response<UserProfile>

    @POST("/api/games/create")
    suspend fun createGame(request: CreateGameRequest): Response<Game>

    // Match all web API endpoints from docs/android-app-requirements.md
}
```

## Implementation Priority

### Phase 1: Core Layout (Week 1-2)
1. ✅ Basic screen structure with ConstraintLayout/Box
2. ✅ Fixed header with logo and navigation
3. ✅ Hero section with background image
4. ✅ Basic responsive breakpoints

### Phase 2: Interactive Elements (Week 2-3)
1. ✅ Action buttons with proper navigation
2. ✅ Mobile menu functionality
3. ✅ State management (authenticated vs guest)
4. ✅ Basic animations

### Phase 3: Content Sections (Week 3-4)
1. ✅ Stats section with cards
2. ✅ Features section with horizontal scrolling
3. ✅ Footer implementation
4. ✅ Full responsive design

### Phase 4: Polish & Optimization (Week 4-5)
1. ✅ Advanced animations and transitions
2. ✅ Accessibility compliance
3. ✅ Performance optimizations
4. ✅ Comprehensive testing

## Success Metrics

- **Visual Fidelity**: 95%+ match to web design
- **Performance**: <500ms initial render, 60fps animations
- **Accessibility**: Full TalkBack support, high contrast
- **Responsive**: Works on phones (360dp+), tablets (768dp+)
- **Navigation**: Seamless integration with existing Android navigation

This guide provides your Android builder with everything needed to replicate the landing page design while following Android best practices and Material Design guidelines.