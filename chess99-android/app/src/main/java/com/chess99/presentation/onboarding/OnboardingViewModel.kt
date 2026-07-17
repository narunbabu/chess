package com.chess99.presentation.onboarding

import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

/**
 * Thin Hilt-DI wrapper around [OnboardingPreferences] for [OnboardingScreen].
 *
 * No UiState/StateFlow needed here — the only job is a synchronous,
 * fire-and-forget local write when the user leaves the pager (spec T2),
 * so a full StateFlow UiState would be unnecessary ceremony for this screen.
 */
@HiltViewModel
class OnboardingViewModel @Inject constructor(
    private val onboardingPreferences: OnboardingPreferences,
) : ViewModel() {

    /** Marks onboarding as seen so it never shows again, regardless of exit path. */
    fun markOnboardingSeen() {
        onboardingPreferences.markOnboardingSeen()
    }
}
