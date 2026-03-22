package com.chess99.presentation.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.data.api.TutorialApi
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

data class SkillAssessmentUiState(
    val currentIndex: Int = 0,
    val totalQuestions: Int = 5,
    val answers: List<Int> = emptyList(),
    val isSubmitting: Boolean = false,
    val showResults: Boolean = false,
    val isComplete: Boolean = false,
    val estimatedRating: Int = 1200,
    val skillLevel: String = "Beginner",
    val currentQuestion: String = "How long have you been playing chess?",
    val currentDescription: String = "This helps us set your starting rating.",
    val currentOptions: List<String> = listOf(
        "I'm new to chess",
        "I know the rules but rarely play",
        "I play regularly (a few games a week)",
        "I play competitively or have a rating",
    ),
) {
    val progress: Float
        get() = if (totalQuestions > 0) currentIndex.toFloat() / totalQuestions else 0f
}

private val assessmentQuestions = listOf(
    Triple(
        "How long have you been playing chess?",
        "This helps us set your starting rating.",
        listOf("I'm new to chess", "I know the rules but rarely play", "I play regularly", "I play competitively"),
    ),
    Triple(
        "Can you spot basic tactics?",
        "Forks, pins, and skewers.",
        listOf("Not sure what those are", "I know them but miss them", "I spot them often", "I rarely miss them"),
    ),
    Triple(
        "How familiar are you with openings?",
        "Common opening sequences and principles.",
        listOf("I don't know any openings", "I know a few moves", "I follow opening principles", "I study openings regularly"),
    ),
    Triple(
        "How would you describe your endgame?",
        "King and pawn endgames, basic checkmates.",
        listOf("I struggle with endgames", "I know basic checkmates", "I'm comfortable in endgames", "Endgames are my strength"),
    ),
    Triple(
        "What's your experience with timed games?",
        "Playing under time pressure.",
        listOf("Never played timed", "I've tried but struggle", "I'm comfortable with time", "I thrive under time pressure"),
    ),
)

@HiltViewModel
class SkillAssessmentViewModel @Inject constructor(
    private val tutorialApi: TutorialApi,
) : ViewModel() {

    private val _uiState = MutableStateFlow(
        SkillAssessmentUiState(
            totalQuestions = assessmentQuestions.size,
            currentQuestion = assessmentQuestions[0].first,
            currentDescription = assessmentQuestions[0].second,
            currentOptions = assessmentQuestions[0].third,
        ),
    )
    val uiState: StateFlow<SkillAssessmentUiState> = _uiState.asStateFlow()

    fun selectAnswer(answerIndex: Int) {
        val current = _uiState.value
        val newAnswers = current.answers + answerIndex
        val nextIndex = current.currentIndex + 1

        if (nextIndex >= assessmentQuestions.size) {
            submitAssessment(newAnswers)
        } else {
            val next = assessmentQuestions[nextIndex]
            _uiState.value = current.copy(
                currentIndex = nextIndex,
                answers = newAnswers,
                currentQuestion = next.first,
                currentDescription = next.second,
                currentOptions = next.third,
            )
        }
    }

    private fun submitAssessment(answers: List<Int>) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isSubmitting = true, answers = answers)
            try {
                val body = JsonObject().apply {
                    val answersArray = JsonArray()
                    answers.forEach { answersArray.add(it) }
                    add("answers", answersArray)
                }
                val response = tutorialApi.createSkillAssessment(body)
                if (response.isSuccessful) {
                    val data = response.body()
                    val rating = data?.get("estimated_rating")?.asInt ?: estimateLocally(answers)
                    val level = data?.get("skill_level")?.asString ?: levelFromRating(rating)
                    _uiState.value = _uiState.value.copy(
                        isSubmitting = false,
                        showResults = true,
                        estimatedRating = rating,
                        skillLevel = level,
                    )
                } else {
                    // Fallback to local estimation
                    val rating = estimateLocally(answers)
                    _uiState.value = _uiState.value.copy(
                        isSubmitting = false,
                        showResults = true,
                        estimatedRating = rating,
                        skillLevel = levelFromRating(rating),
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Skill assessment submit error")
                val rating = estimateLocally(answers)
                _uiState.value = _uiState.value.copy(
                    isSubmitting = false,
                    showResults = true,
                    estimatedRating = rating,
                    skillLevel = levelFromRating(rating),
                )
            }
        }
    }

    fun skipAssessment() {
        _uiState.value = _uiState.value.copy(isComplete = true)
    }

    private fun estimateLocally(answers: List<Int>): Int {
        val avgScore = answers.map { it.toFloat() }.average()
        return (800 + (avgScore * 300)).toInt().coerceIn(600, 2000)
    }

    private fun levelFromRating(rating: Int): String = when {
        rating < 800 -> "Beginner"
        rating < 1000 -> "Novice"
        rating < 1200 -> "Intermediate"
        rating < 1500 -> "Advanced"
        rating < 1800 -> "Expert"
        else -> "Master"
    }
}
