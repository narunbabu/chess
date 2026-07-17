package com.chess99.presentation.onboarding

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.PagerState
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.chess99.R
import com.chess99.presentation.theme.ChessDarkGreen
import com.chess99.presentation.theme.ChessGreen

private data class OnboardingPage(
    val headline: String,
    val body: String,
)

private val onboardingPages = listOf(
    OnboardingPage(
        headline = "Learn chess the fun way",
        body = "Lessons, puzzles and games built for young players.",
    ),
    OnboardingPage(
        headline = "Play and improve every day",
        body = "Solve daily challenges, earn XP and climb the leaderboard.",
    ),
    OnboardingPage(
        headline = "Safe for kids. Loved by parents.",
        body = "Kid-safe chat controls and a parent dashboard keep you in charge.",
    ),
)

/**
 * First-run onboarding pager (spec S7 / T1). Shown once, before the user
 * reaches Login/Register, unless they're already authenticated.
 *
 * All exit paths (Skip, "Get started", "I already have an account",
 * "Try as guest") mark onboarding as seen via [OnboardingViewModel] before
 * invoking the corresponding navigation callback, so it never shows again
 * (spec T2) regardless of which button the caller wires up.
 */
@Composable
fun OnboardingScreen(
    onGetStarted: () -> Unit,
    onLogin: () -> Unit,
    onPlayAsGuest: () -> Unit,
    onSkip: () -> Unit,
    viewModel: OnboardingViewModel = hiltViewModel(),
) {
    val pagerState = rememberPagerState(pageCount = { onboardingPages.size })

    fun exit(then: () -> Unit) {
        viewModel.markOnboardingSeen()
        then()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.linearGradient(listOf(ChessGreen, ChessDarkGreen)))
            .windowInsetsPadding(WindowInsets.safeDrawing),
    ) {
        // Skip — top-right, all pages (spec T1).
        TextButton(
            onClick = { exit(onSkip) },
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(top = 8.dp, end = 8.dp),
        ) {
            Text("Skip", color = Color.White)
        }

        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            HorizontalPager(
                state = pagerState,
                modifier = Modifier.weight(1f),
            ) { page ->
                OnboardingPageContent(page = page)
            }

            PageDots(pagerState = pagerState)

            Spacer(Modifier.height(20.dp))

            OnboardingButtons(
                isLastPage = pagerState.currentPage == onboardingPages.lastIndex,
                onGetStarted = { exit(onGetStarted) },
                onLogin = { exit(onLogin) },
                onPlayAsGuest = { exit(onPlayAsGuest) },
            )

            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun OnboardingPageContent(page: Int) {
    val data = onboardingPages[page]
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        PageIllustration(page = page)

        Spacer(Modifier.height(40.dp))

        Text(
            text = data.headline,
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            color = Color.White,
            textAlign = TextAlign.Center,
        )

        Spacer(Modifier.height(12.dp))

        Text(
            text = data.body,
            style = MaterialTheme.typography.bodyLarge,
            color = Color.White.copy(alpha = 0.9f),
            textAlign = TextAlign.Center,
        )
    }
}

/**
 * Large icon/illustration area. No new art required (spec T1): page 1 reuses
 * the launcher mark; pages 2–3 compose the bundled white-knight/white-queen
 * piece PNGs decoratively.
 */
@Composable
private fun PageIllustration(page: Int) {
    Box(
        modifier = Modifier.size(160.dp),
        contentAlignment = Alignment.Center,
    ) {
        when (page) {
            0 -> Image(
                painter = painterResource(R.drawable.ic_launcher_foreground),
                contentDescription = null,
                modifier = Modifier
                    .size(160.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.15f)),
                contentScale = ContentScale.Fit,
            )
            1 -> Image(
                painter = painterResource(R.drawable.piece_wn),
                contentDescription = null,
                modifier = Modifier
                    .size(140.dp)
                    .background(Color.White.copy(alpha = 0.15f), CircleShape)
                    .padding(20.dp),
                contentScale = ContentScale.Fit,
            )
            else -> Image(
                painter = painterResource(R.drawable.piece_wq),
                contentDescription = null,
                modifier = Modifier
                    .size(140.dp)
                    .background(Color.White.copy(alpha = 0.15f), CircleShape)
                    .padding(20.dp),
                contentScale = ContentScale.Fit,
            )
        }
    }
}

@Composable
private fun PageDots(pagerState: PagerState) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        repeat(onboardingPages.size) { index ->
            val isSelected = pagerState.currentPage == index
            Box(
                modifier = Modifier
                    .size(if (isSelected) 10.dp else 8.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = if (isSelected) 1f else 0.4f)),
            )
        }
    }
}

@Composable
private fun OnboardingButtons(
    isLastPage: Boolean,
    onGetStarted: () -> Unit,
    onLogin: () -> Unit,
    onPlayAsGuest: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // Primary — all pages (spec T1).
        Button(
            onClick = onGetStarted,
            colors = ButtonDefaults.buttonColors(
                containerColor = Color.White,
                contentColor = ChessDarkGreen,
            ),
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp),
        ) {
            Text("Get started", fontWeight = FontWeight.Bold)
        }

        Spacer(Modifier.height(8.dp))

        // Text button — all pages (spec T1).
        TextButton(onClick = onLogin) {
            Text("I already have an account", color = Color.White)
        }

        // Secondary outlined — page 3 only (spec T1).
        if (isLastPage) {
            Spacer(Modifier.height(4.dp))
            OutlinedButton(
                onClick = onPlayAsGuest,
                colors = ButtonDefaults.outlinedButtonColors(
                    contentColor = Color.White,
                ),
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.7f)),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
            ) {
                Text("Try as guest")
            }
        }
    }
}
