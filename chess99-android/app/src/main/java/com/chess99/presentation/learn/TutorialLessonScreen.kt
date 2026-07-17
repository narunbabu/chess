package com.chess99.presentation.learn

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.data.api.TutorialApi
import com.chess99.data.api.arrOrNull
import com.chess99.data.api.objOrNull
import com.chess99.data.api.str
import com.chess99.engine.ChessGame
import com.chess99.presentation.common.ChessBoardView
import com.chess99.presentation.common.friendlyError
import com.google.gson.JsonObject
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

@HiltViewModel
class TutorialLessonViewModel @Inject constructor(
    private val tutorialApi: TutorialApi,
) : ViewModel() {

    data class Stage(
        val instruction: String,
        val fen: String,
        val expectedMove: String?,
        val hint: String?,
    )

    data class State(
        val isLoading: Boolean = true,
        val error: String? = null,
        val lessonTitle: String = "",
        val lessonDescription: String = "",
        val stages: List<Stage> = emptyList(),
        val currentStageIndex: Int = 0,
        val isComplete: Boolean = false,
        val feedbackMessage: String? = null,
        val feedbackIsCorrect: Boolean = false,
        val showHint: Boolean = false,
    )

    private val _state = MutableStateFlow(State())
    val state: StateFlow<State> = _state.asStateFlow()

    private val game = ChessGame()

    // Lesson types that carry real interactive_stages content on the
    // backend (matches TutorialLesson::isInteractive() in
    // chess-backend/app/Models/TutorialLesson.php). Every other type
    // (currently just "theory" in the production dataset) 400s on
    // tutorial/lessons/{id}/interactive with "This is not an interactive
    // lesson." — verified live 2026-07-14, see S5-learn-tutorials-contract.md.
    private val INTERACTIVE_LESSON_TYPES = setOf("interactive", "puzzle", "practice_game")

    fun loadLesson(lessonId: Int) {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            try {
                // Start the lesson
                tutorialApi.startLesson(lessonId)

                // Look up the lesson's type first — theory lessons (slides +
                // diagrams) and interactive lessons (staged move validation)
                // are served by different endpoints with different shapes.
                val plainResponse = tutorialApi.getLesson(lessonId)
                if (!plainResponse.isSuccessful) {
                    _state.update {
                        it.copy(isLoading = false, error = "Couldn't load this lesson. Pull to retry.")
                    }
                    return@launch
                }
                val plainData = plainResponse.body()?.get("data").objOrNull()
                if (plainData == null) {
                    Timber.w("tutorial contract miss (lesson $lessonId): keys=${plainResponse.body()?.keySet()}")
                    _state.update {
                        it.copy(isLoading = false, error = "Couldn't load this lesson. Pull to retry.")
                    }
                    return@launch
                }

                val title = plainData.str("title") ?: "Lesson"
                val lessonType = plainData.str("lesson_type")

                val stages = if (lessonType in INTERACTIVE_LESSON_TYPES) {
                    loadInteractiveStages(lessonId)
                } else {
                    // theory (slides) or puzzle-without-stage-data fallback:
                    // render from the plain lesson payload's content_data.
                    stagesFromContentData(plainData)
                }

                if (stages == null) {
                    _state.update {
                        it.copy(isLoading = false, error = "Couldn't load this lesson. Pull to retry.")
                    }
                    return@launch
                }

                if (stages.isNotEmpty()) {
                    game.load(stages[0].fen)
                }

                _state.update {
                    it.copy(
                        isLoading = false,
                        lessonTitle = title,
                        lessonDescription = plainData.str("description") ?: "",
                        stages = stages,
                        currentStageIndex = 0,
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to load lesson $lessonId")
                _state.update { it.copy(isLoading = false, error = friendlyError(e, "this lesson")) }
            }
        }
    }

    /** @return null on a contract miss (caller shows the error state); empty list is genuine no-content. */
    private suspend fun loadInteractiveStages(lessonId: Int): List<Stage>? {
        val response = tutorialApi.getInteractiveLesson(lessonId)
        if (!response.isSuccessful) return null
        val data = response.body()?.get("data").objOrNull() ?: return null
        val stagesArray = data.get("interactive_stages").arrOrNull() ?: return emptyList()
        return stagesArray.mapNotNull { element ->
            val obj = element.objOrNull() ?: return@mapNotNull null
            Stage(
                instruction = obj.str("instruction_text") ?: obj.str("title") ?: "",
                fen = obj.str("initial_fen")
                    ?: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                // No flat "expected move" concept on the real payload (it
                // uses goals/success_criteria objects) — free play, same as
                // the pre-existing null-expectedMove behavior.
                expectedMove = null,
                hint = obj.get("hints").arrOrNull()?.firstOrNull()?.takeIf { it.isJsonPrimitive }?.asString,
            )
        }
    }

    /** Renders a theory lesson's `content_data.slides[]` as read-along stages using the existing board UI. */
    private fun stagesFromContentData(lessonData: JsonObject): List<Stage> {
        val slides = lessonData.objOrNull("content_data")?.get("slides").arrOrNull() ?: return emptyList()
        return slides.mapNotNull { element ->
            val obj = element.objOrNull() ?: return@mapNotNull null
            val slideTitle = obj.str("title")
            val bodyText = stripHtml(obj.str("content") ?: "")
            Stage(
                instruction = listOfNotNull(slideTitle, bodyText.takeIf { it.isNotBlank() })
                    .joinToString(separator = "\n\n"),
                fen = obj.str("diagram")
                    ?: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                expectedMove = null,
                hint = null,
            )
        }
    }

    private fun stripHtml(html: String): String =
        html.replace(Regex("<[^>]*>"), "").replace("&nbsp;", " ").trim()

    private fun JsonObject?.objOrNull(key: String): JsonObject? = this?.get(key).objOrNull()

    fun onMove(from: String, to: String, promotion: Char?) {
        val currentState = _state.value
        val stage = currentState.stages.getOrNull(currentState.currentStageIndex) ?: return

        val moveNotation = "$from$to"
        val expected = stage.expectedMove

        if (expected != null && moveNotation != expected) {
            // Wrong move — reset board
            game.load(stage.fen)
            _state.update {
                it.copy(
                    feedbackMessage = "Not quite. Try again!",
                    feedbackIsCorrect = false,
                )
            }
            return
        }

        // Correct move (or no expected move — free play)
        val result = game.move(from, to, promotion)
        if (result == null) {
            _state.update {
                it.copy(feedbackMessage = "Invalid move", feedbackIsCorrect = false)
            }
            return
        }

        // Validate with server
        viewModelScope.launch {
            try {
                val body = JsonObject().apply {
                    addProperty("move", moveNotation)
                    addProperty("stage_index", currentState.currentStageIndex)
                }
                val lessonId = 0 // will be set from the loaded data
                tutorialApi.validateInteractiveMove(lessonId, body)
            } catch (_: Exception) {
                // Continue even if server validation fails
            }
        }

        // Advance to next stage
        val nextIndex = currentState.currentStageIndex + 1
        if (nextIndex < currentState.stages.size) {
            val nextStage = currentState.stages[nextIndex]
            game.load(nextStage.fen)
            _state.update {
                it.copy(
                    currentStageIndex = nextIndex,
                    feedbackMessage = "Correct!",
                    feedbackIsCorrect = true,
                    showHint = false,
                )
            }
        } else {
            _state.update {
                it.copy(
                    isComplete = true,
                    feedbackMessage = "Lesson complete!",
                    feedbackIsCorrect = true,
                )
            }
        }
    }

    fun requestHint() {
        _state.update { it.copy(showHint = true) }
    }

    fun resetStage() {
        val stage = _state.value.stages.getOrNull(_state.value.currentStageIndex) ?: return
        game.load(stage.fen)
        _state.update { it.copy(feedbackMessage = null, showHint = false) }
    }

    fun getGame(): ChessGame = game
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TutorialLessonScreen(
    lessonId: Int,
    onNavigateBack: () -> Unit,
    viewModel: TutorialLessonViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(lessonId) {
        viewModel.loadLesson(lessonId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(state.lessonTitle.ifEmpty { "Lesson" }) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
            )
        },
    ) { padding ->
        when {
            state.isLoading -> {
                Box(
                    Modifier.fillMaxSize().padding(padding),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator()
                }
            }

            state.error != null -> {
                Box(
                    Modifier.fillMaxSize().padding(padding),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            state.error ?: "Error",
                            color = MaterialTheme.colorScheme.error,
                        )
                        Spacer(Modifier.height(16.dp))
                        Button(onClick = { viewModel.loadLesson(lessonId) }) {
                            Text("Retry")
                        }
                    }
                }
            }

            state.isComplete -> {
                Box(
                    Modifier.fillMaxSize().padding(padding),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(32.dp),
                    ) {
                        Icon(
                            Icons.Default.CheckCircle,
                            contentDescription = null,
                            tint = Color(0xFF4CAF50),
                            modifier = Modifier.height(64.dp),
                        )
                        Spacer(Modifier.height(16.dp))
                        Text(
                            "Lesson Complete!",
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.Bold,
                        )
                        Spacer(Modifier.height(8.dp))
                        Text(
                            state.lessonTitle,
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(24.dp))
                        Button(onClick = onNavigateBack) {
                            Text("Back to Lessons")
                        }
                    }
                }
            }

            else -> {
                val currentStage = state.stages.getOrNull(state.currentStageIndex)

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                ) {
                    // Progress indicator
                    if (state.stages.size > 1) {
                        Text(
                            "Step ${state.currentStageIndex + 1} of ${state.stages.size}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(8.dp))
                    }

                    // Instruction
                    currentStage?.let { stage ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                        ) {
                            Text(
                                stage.instruction,
                                modifier = Modifier.padding(16.dp),
                                style = MaterialTheme.typography.bodyLarge,
                            )
                        }
                    }

                    Spacer(Modifier.height(12.dp))

                    // Chess board
                    val game = remember { viewModel.getGame() }
                    ChessBoardView(
                        game = game,
                        isInteractive = true,
                        onMove = { from, to, promotion ->
                            viewModel.onMove(from, to, promotion)
                        },
                        modifier = Modifier.fillMaxWidth(),
                    )

                    Spacer(Modifier.height(12.dp))

                    // Feedback
                    state.feedbackMessage?.let { message ->
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(
                                    if (state.feedbackIsCorrect) Color(0xFF4CAF50).copy(alpha = 0.1f)
                                    else Color(0xFFF44336).copy(alpha = 0.1f),
                                    RoundedCornerShape(8.dp),
                                )
                                .padding(12.dp),
                        ) {
                            Text(
                                message,
                                color = if (state.feedbackIsCorrect) Color(0xFF4CAF50)
                                else Color(0xFFF44336),
                                fontWeight = FontWeight.Medium,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.fillMaxWidth(),
                            )
                        }
                    }

                    // Hint
                    if (state.showHint && currentStage?.hint != null) {
                        Spacer(Modifier.height(8.dp))
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(8.dp),
                        ) {
                            Row(
                                modifier = Modifier.padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Icon(
                                    Icons.Default.Lightbulb,
                                    null,
                                    tint = Color(0xFFFFC107),
                                )
                                Text(
                                    currentStage.hint ?: "",
                                    modifier = Modifier.padding(start = 8.dp),
                                    style = MaterialTheme.typography.bodyMedium,
                                )
                            }
                        }
                    }

                    Spacer(Modifier.height(16.dp))

                    // Action buttons
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        if (currentStage?.hint != null && !state.showHint) {
                            OutlinedButton(
                                onClick = { viewModel.requestHint() },
                                modifier = Modifier.weight(1f),
                            ) {
                                Icon(Icons.Default.Lightbulb, null)
                                Text("Hint", modifier = Modifier.padding(start = 4.dp))
                            }
                        }
                        OutlinedButton(
                            onClick = { viewModel.resetStage() },
                            modifier = Modifier.weight(1f),
                        ) {
                            Icon(Icons.Default.Refresh, null)
                            Text("Reset", modifier = Modifier.padding(start = 4.dp))
                        }
                    }
                }
            }
        }
    }
}
