package com.chess99.presentation.learn

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.data.api.TutorialApi
import com.chess99.engine.ChessGame
import com.chess99.engine.Color
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

data class TrainingExerciseUiState(
    val isLoading: Boolean = false,
    val title: String = "Training Exercise",
    val instruction: String = "",
    val fen: String = ChessGame.STARTING_FEN,
    val playerColor: Color = Color.WHITE,
    val feedback: String? = null,
    val isCorrect: Boolean = false,
    val isStepComplete: Boolean = false,
    val isExerciseComplete: Boolean = false,
    val currentStep: Int = 0,
    val totalSteps: Int = 1,
) {
    val progress: Float
        get() = if (totalSteps > 0) currentStep.toFloat() / totalSteps else 0f
}

@HiltViewModel
class TrainingExerciseViewModel @Inject constructor(
    private val tutorialApi: TutorialApi,
) : ViewModel() {

    private val _uiState = MutableStateFlow(TrainingExerciseUiState())
    val uiState: StateFlow<TrainingExerciseUiState> = _uiState.asStateFlow()

    fun loadExercise(exerciseId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                // Use tutorial/practice-game/create for practice exercises
                val response = tutorialApi.createPracticeGame(
                    com.google.gson.JsonObject().apply {
                        addProperty("exercise_id", exerciseId)
                    },
                )
                if (response.isSuccessful) {
                    val body = response.body()
                    val exercise = body?.getAsJsonObject("exercise") ?: body
                    if (exercise != null) {
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            title = exercise.get("title")?.asString ?: "Training Exercise",
                            instruction = exercise.get("instruction")?.asString ?: "Make the best move",
                            fen = exercise.get("fen")?.asString ?: ChessGame.STARTING_FEN,
                            totalSteps = exercise.get("total_steps")?.asInt ?: 1,
                        )
                    } else {
                        _uiState.value = _uiState.value.copy(isLoading = false)
                    }
                } else {
                    _uiState.value = _uiState.value.copy(isLoading = false)
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to load exercise")
                _uiState.value = _uiState.value.copy(isLoading = false)
            }
        }
    }

    fun onMove(from: String, to: String, promotion: Char?) {
        val game = ChessGame(_uiState.value.fen)
        val moveResult = game.move(from, to, promotion)
        if (moveResult != null) {
            _uiState.value = _uiState.value.copy(
                fen = game.fen(),
                feedback = "Good move!",
                isCorrect = true,
                isStepComplete = true,
            )
        } else {
            _uiState.value = _uiState.value.copy(
                feedback = "Invalid move. Try again.",
                isCorrect = false,
            )
        }
    }

    fun nextStep() {
        val current = _uiState.value
        if (current.currentStep + 1 >= current.totalSteps) {
            _uiState.value = current.copy(isExerciseComplete = true)
        } else {
            _uiState.value = current.copy(
                currentStep = current.currentStep + 1,
                feedback = null,
                isStepComplete = false,
            )
        }
    }
}
