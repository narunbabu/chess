package com.chess99.presentation.learn

import android.content.Context
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.R
import com.chess99.data.api.TutorialApi
import com.chess99.data.api.arrOrNull
import com.chess99.data.api.int
import com.chess99.data.api.objOrNull
import com.chess99.data.api.str
import com.chess99.engine.ChessGame
import com.chess99.presentation.common.ChessBoardView
import com.chess99.presentation.common.MoveEffects
import com.chess99.presentation.common.MoveReplay
import com.chess99.presentation.common.friendlyError
import com.google.gson.JsonObject
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import timber.log.Timber

@HiltViewModel
class TutorialLessonViewModel @Inject constructor(
    private val tutorialApi: TutorialApi,
    // Injected so failure copy can be read from strings.xml.
    @ApplicationContext private val context: Context,
) : ViewModel() {

    data class Stage(
        val instruction: String,
        val fen: String,
        val expectedMove: String?,
        val hint: String?,
        // Server row id of the interactive stage (interactive_lesson_stages.id).
        // Null for theory slides, which have nothing to validate server-side.
        val stageId: Int? = null,
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
        // Squares of the move just played on the board, cleared whenever a new
        // stage position is loaded (nothing on that board has moved yet).
        val lastMoveFrom: Int = -1,
        val lastMoveTo: Int = -1,
        val lastMoveEffects: MoveEffects = MoveEffects.None,
        // Server-side completion state: null = call still in flight,
        // true = persisted, false = failed (offers a retry).
        val completionPersisted: Boolean? = null,
        val xpAwarded: Int = 0,
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

    // Identity of the lesson currently loaded; 0 only before the first
    // successful load. Both server calls below must use the real id.
    private var currentLessonId: Int = 0
    private var isInteractiveLesson: Boolean = false
    private var estimatedDurationMinutes: Int = 0
    private var lessonStartedAtMs: Long = 0
    private var wrongAttempts: Int = 0
    private var correctMoves: Int = 0

    fun loadLesson(lessonId: Int) {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            try {
                // Start the lesson — the backend refuses completeLesson without
                // a progress row (404 "Lesson progress not found"), so this
                // must succeed before the player can finish the lesson.
                tutorialApi.startLesson(lessonId)

                // Look up the lesson's type first — theory lessons (slides +
                // diagrams) and interactive lessons (staged move validation)
                // are served by different endpoints with different shapes.
                val plainResponse = tutorialApi.getLesson(lessonId)
                if (!plainResponse.isSuccessful) {
                    _state.update {
                        it.copy(isLoading = false, error = context.getString(R.string.lesson_load_failed))
                    }
                    return@launch
                }
                val plainData = plainResponse.body()?.get("data").objOrNull()
                if (plainData == null) {
                    Timber.w("tutorial contract miss (lesson $lessonId): keys=${plainResponse.body()?.keySet()}")
                    _state.update {
                        it.copy(isLoading = false, error = context.getString(R.string.lesson_load_failed))
                    }
                    return@launch
                }

                currentLessonId = lessonId
                lessonStartedAtMs = System.currentTimeMillis()
                wrongAttempts = 0
                correctMoves = 0

                val title = plainData.str("title") ?: context.getString(R.string.lesson_default_title)
                val lessonType = plainData.str("lesson_type")
                isInteractiveLesson = lessonType in INTERACTIVE_LESSON_TYPES
                estimatedDurationMinutes = plainData.int("estimated_duration_minutes") ?: 0

                val stages = if (isInteractiveLesson) {
                    loadInteractiveStages(lessonId)
                } else {
                    // theory (slides) or puzzle-without-stage-data fallback:
                    // render from the plain lesson payload's content_data.
                    stagesFromContentData(plainData)
                }

                if (stages == null) {
                    _state.update {
                        it.copy(isLoading = false, error = context.getString(R.string.lesson_load_failed))
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
                        completionPersisted = null,
                        xpAwarded = 0,
                        lastMoveFrom = -1,
                        lastMoveTo = -1,
                        lastMoveEffects = MoveEffects.None,
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to load lesson $lessonId")
                _state.update { it.copy(isLoading = false, error = friendlyError(context, e, R.string.error_subject_this_lesson)) }
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
                stageId = obj.int("id"),
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
            wrongAttempts++
            game.load(stage.fen)
            _state.update {
                it.copy(
                    feedbackMessage = context.getString(R.string.lesson_feedback_wrong),
                    feedbackIsCorrect = false,
                    lastMoveFrom = -1,
                    lastMoveTo = -1,
                    lastMoveEffects = MoveEffects.None,
                )
            }
            return
        }

        // Correct move (or no expected move — free play)
        val result = game.move(from, to, promotion)
        if (result == null) {
            _state.update {
                it.copy(feedbackMessage = context.getString(R.string.lesson_feedback_invalid), feedbackIsCorrect = false)
            }
            return
        }

        correctMoves++

        // Validate with the server against the real lesson and stage rows.
        // Theory slides have no server stage (stageId null) and stay local
        // read-alongs. fenAfter is captured before the coroutine runs because
        // the local stage advance below reloads the board for the next stage.
        val lessonId = currentLessonId
        val stageId = stage.stageId
        val fenAfter = game.fen()
        val uci = result.uci()
        if (lessonId > 0 && stageId != null) {
            viewModelScope.launch {
                try {
                    val body = JsonObject().apply {
                        addProperty("move", uci)
                        addProperty("stage_id", stageId)
                        addProperty("fen_after", fenAfter)
                    }
                    val response = tutorialApi.validateInteractiveMove(lessonId, body)
                    val serverValidated = response.isSuccessful &&
                        response.body()?.get("data").objOrNull()
                            ?.get("validation_result").objOrNull()
                            ?.get("success")?.takeIf { it.isJsonPrimitive }?.asBoolean == true
                    if (!serverValidated) {
                        Timber.w("Server rejected move %s for lesson %d stage %d", uci, lessonId, stageId)
                    }
                } catch (e: Exception) {
                    Timber.w(e, "Server validation failed for lesson %d stage %d", lessonId, stageId)
                }
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
                    feedbackMessage = context.getString(R.string.lesson_feedback_correct),
                    feedbackIsCorrect = true,
                    showHint = false,
                    // Fresh position — nothing has moved on it.
                    lastMoveFrom = -1,
                    lastMoveTo = -1,
                    lastMoveEffects = MoveEffects.None,
                )
            }
        } else {
            _state.update {
                it.copy(
                    isComplete = true,
                    feedbackMessage = context.getString(R.string.lesson_feedback_complete),
                    feedbackIsCorrect = true,
                    lastMoveFrom = result.from,
                    lastMoveTo = result.to,
                    lastMoveEffects = MoveReplay.effectsOf(result),
                )
            }
            persistCompletion()
        }
    }

    /** Re-issues the server completion after a failure on the complete screen. */
    fun retryCompletion() {
        if (_state.value.isComplete) persistCompletion()
    }

    /**
     * Persists the completion server-side (tutorial/lessons/{id}/complete),
     * mirroring the web LessonPlayer payload: score 0-100, seconds spent and
     * attempt count. A clean interactive run scores 100 with each wrong
     * attempt costing 10 (LessonPlayer's puzzle scoring); theory read-alongs
     * use the web's time-based fallback, never below 60.
     */
    private fun persistCompletion() {
        val lessonId = currentLessonId
        if (lessonId <= 0) {
            _state.update { it.copy(completionPersisted = false) }
            return
        }
        val timeSpentSeconds = ((System.currentTimeMillis() - lessonStartedAtMs) / 1000)
            .coerceAtLeast(0L).toInt()
        val score = lessonScore(timeSpentSeconds)
        val body = JsonObject().apply {
            addProperty("score", score)
            addProperty("time_spent_seconds", timeSpentSeconds)
            addProperty("attempts", wrongAttempts + 1)
        }
        viewModelScope.launch {
            _state.update { it.copy(completionPersisted = null) }
            try {
                val response = tutorialApi.completeLesson(lessonId, body)
                val data = response.body()?.get("data").objOrNull()
                if (!response.isSuccessful || data == null) {
                    Timber.w("Lesson %d completion not persisted (http %d)", lessonId, response.code())
                    _state.update { it.copy(completionPersisted = false) }
                    return@launch
                }
                _state.update {
                    it.copy(
                        completionPersisted = true,
                        xpAwarded = data.get("xp_awarded")?.takeIf { it.isJsonPrimitive }?.asInt ?: 0,
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to persist lesson %d completion", lessonId)
                _state.update { it.copy(completionPersisted = false) }
            }
        }
    }

    private fun lessonScore(timeSpentSeconds: Int): Int {
        if (!isInteractiveLesson) {
            // Web parity: lose one point per minute over the estimated
            // duration, floored at 60 for read-along lessons without quizzes.
            val expectedSeconds = (estimatedDurationMinutes.takeIf { it > 0 } ?: 5) * 60
            val minutesOver = ((timeSpentSeconds - expectedSeconds) / 60.0).coerceAtLeast(0.0)
            return maxOf(60.0, 100.0 - minutesOver).toInt()
        }
        val totalStages = _state.value.stages.size.coerceAtLeast(1)
        val earned = (100.0 / totalStages) * correctMoves - 10.0 * wrongAttempts
        return earned.toInt().coerceIn(0, 100)
    }

    fun requestHint() {
        _state.update { it.copy(showHint = true) }
    }

    fun resetStage() {
        val stage = _state.value.stages.getOrNull(_state.value.currentStageIndex) ?: return
        game.load(stage.fen)
        _state.update {
            it.copy(
                feedbackMessage = null,
                showHint = false,
                lastMoveFrom = -1,
                lastMoveTo = -1,
                lastMoveEffects = MoveEffects.None,
            )
        }
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
                title = { Text(state.lessonTitle.ifEmpty { stringResource(R.string.lesson_default_title) }) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.action_back))
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
                            state.error ?: stringResource(R.string.error_title),
                            color = MaterialTheme.colorScheme.error,
                        )
                        Spacer(Modifier.height(16.dp))
                        Button(onClick = { viewModel.loadLesson(lessonId) }) {
                            Text(stringResource(R.string.action_retry))
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
                            stringResource(R.string.lesson_complete_title),
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.Bold,
                        )
                        Spacer(Modifier.height(8.dp))
                        Text(
                            state.lessonTitle,
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        if (state.completionPersisted == true && state.xpAwarded > 0) {
                            Spacer(Modifier.height(8.dp))
                            Text(
                                stringResource(R.string.lesson_complete_xp, state.xpAwarded),
                                color = MaterialTheme.colorScheme.primary,
                                fontWeight = FontWeight.Medium,
                            )
                        }
                        if (state.completionPersisted == false) {
                            Spacer(Modifier.height(8.dp))
                            Text(
                                stringResource(R.string.lesson_save_failed),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.error,
                                textAlign = TextAlign.Center,
                            )
                            Spacer(Modifier.height(8.dp))
                            OutlinedButton(onClick = { viewModel.retryCompletion() }) {
                                Text(stringResource(R.string.action_retry_save))
                            }
                        }
                        Spacer(Modifier.height(24.dp))
                        Button(onClick = onNavigateBack) {
                            Text(stringResource(R.string.lesson_back_to_lessons))
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
                            stringResource(R.string.lesson_step_of, state.currentStageIndex + 1, state.stages.size),
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
                        lastMoveFrom = state.lastMoveFrom,
                        lastMoveTo = state.lastMoveTo,
                        lastMoveEffects = state.lastMoveEffects,
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
                                Text(stringResource(R.string.action_hint), modifier = Modifier.padding(start = 4.dp))
                            }
                        }
                        OutlinedButton(
                            onClick = { viewModel.resetStage() },
                            modifier = Modifier.weight(1f),
                        ) {
                            Icon(Icons.Default.Refresh, null)
                            Text(stringResource(R.string.action_reset), modifier = Modifier.padding(start = 4.dp))
                        }
                    }
                }
            }
        }
    }
}
