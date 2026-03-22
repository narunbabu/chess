package com.chess99.presentation.social

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.data.api.SocialApi
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

data class SharedResultUiState(
    val isLoading: Boolean = false,
    val error: String? = null,
    val resultText: String = "",
    val whiteName: String = "",
    val blackName: String = "",
    val whiteRating: Int = 0,
    val blackRating: Int = 0,
    val score: String = "",
    val timeControl: String = "",
    val totalMoves: Int = 0,
    val result: String = "",
    val ratingChange: Int = 0,
)

@HiltViewModel
class SharedResultViewModel @Inject constructor(
    private val socialApi: SocialApi,
) : ViewModel() {

    private val _uiState = MutableStateFlow(SharedResultUiState())
    val uiState: StateFlow<SharedResultUiState> = _uiState.asStateFlow()

    fun loadSharedResult(uniqueId: String) {
        viewModelScope.launch {
            _uiState.value = SharedResultUiState(isLoading = true)
            try {
                val response = socialApi.getShareData(uniqueId.toIntOrNull() ?: 0)
                if (response.isSuccessful) {
                    val body = response.body() ?: return@launch
                    val result = body.get("result")?.asString ?: "unknown"
                    val whitePlayer = body.get("white_player")?.asString ?: "White"
                    val blackPlayer = body.get("black_player")?.asString ?: "Black"

                    _uiState.value = SharedResultUiState(
                        resultText = when (result) {
                            "white" -> "$whitePlayer wins!"
                            "black" -> "$blackPlayer wins!"
                            "draw" -> "Draw"
                            else -> "Game Over"
                        },
                        whiteName = whitePlayer,
                        blackName = blackPlayer,
                        whiteRating = body.get("white_rating")?.asInt ?: 0,
                        blackRating = body.get("black_rating")?.asInt ?: 0,
                        score = when (result) {
                            "white" -> "1 - 0"
                            "black" -> "0 - 1"
                            "draw" -> "\u00BD - \u00BD"
                            else -> "* - *"
                        },
                        timeControl = body.get("time_control")?.asString ?: "",
                        totalMoves = body.get("total_moves")?.asInt ?: 0,
                        result = result,
                        ratingChange = body.get("rating_change")?.asInt ?: 0,
                    )
                } else {
                    _uiState.value = SharedResultUiState(error = "Result not found")
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to load shared result")
                _uiState.value = SharedResultUiState(error = "Network error: ${e.message}")
            }
        }
    }
}
