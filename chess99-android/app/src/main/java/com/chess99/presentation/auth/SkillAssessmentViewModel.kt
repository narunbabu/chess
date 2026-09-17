package com.chess99.presentation.auth

import android.content.Context
import androidx.annotation.ArrayRes
import androidx.annotation.StringRes
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.data.api.TutorialApi
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.chess99.R
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
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
    // Placeholders only: the ViewModel fills all four from strings.xml before
    // the first render, because a data-class default has no Context.
    val skillLevel: String = "",
    val currentQuestion: String = "",
    val currentDescription: String = "",
    val currentOptions: List<String> = emptyList(),
) {
    val progress: Float
        get() = if (totalQuestions > 0) currentIndex.toFloat() / totalQuestions else 0f
}

/** One assessment step. The copy is resource ids so the questions stay translatable. */
private data class AssessmentQuestion(
    @StringRes val question: Int,
    @StringRes val description: Int,
    @ArrayRes val options: Int,
)

private val assessmentQuestions = listOf(
    AssessmentQuestion(R.string.skill_q_experience, R.string.skill_q_experience_desc, R.array.skill_q_experience_options),
    AssessmentQuestion(R.string.skill_q_tactics, R.string.skill_q_tactics_desc, R.array.skill_q_tactics_options),
    AssessmentQuestion(R.string.skill_q_openings, R.string.skill_q_openings_desc, R.array.skill_q_openings_options),
    AssessmentQuestion(R.string.skill_q_endgame, R.string.skill_q_endgame_desc, R.array.skill_q_endgame_options),
    AssessmentQuestion(R.string.skill_q_time, R.string.skill_q_time_desc, R.array.skill_q_time_options),
)

@HiltViewModel
class SkillAssessmentViewModel @Inject constructor(
    private val tutorialApi: TutorialApi,
    // Injected so the question copy above can be read from strings.xml.
    @ApplicationContext private val context: Context,
) : ViewModel() {

    private fun optionsOf(q: AssessmentQuestion): List<String> =
        context.resources.getStringArray(q.options).toList()

    private val _uiState = MutableStateFlow(
        SkillAssessmentUiState(
            totalQuestions = assessmentQuestions.size,
            currentQuestion = context.getString(assessmentQuestions[0].question),
            currentDescription = context.getString(assessmentQuestions[0].description),
            currentOptions = optionsOf(assessmentQuestions[0]),
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
                currentQuestion = context.getString(next.question),
                currentDescription = context.getString(next.description),
                currentOptions = optionsOf(next),
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

    private fun levelFromRating(rating: Int): String = context.getString(
        when {
            rating < 800 -> R.string.skill_level_beginner
            rating < 1000 -> R.string.skill_level_novice
            rating < 1200 -> R.string.skill_level_intermediate
            rating < 1500 -> R.string.skill_level_advanced
            rating < 1800 -> R.string.skill_level_expert
            else -> R.string.skill_level_master
        }
    )
}
