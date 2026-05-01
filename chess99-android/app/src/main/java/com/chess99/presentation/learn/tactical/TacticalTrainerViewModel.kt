package com.chess99.presentation.learn.tactical

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.data.api.TacticalApi
import com.chess99.engine.ChessGame
import com.chess99.engine.Color
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.reflect.TypeToken
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import timber.log.Timber
import java.io.InputStreamReader
import javax.inject.Inject

enum class TacticalScreenPhase {
    DASHBOARD, PUZZLE, SOLUTION_VIEWER, STAGE_COMPLETE,
}

data class TacticalTrainerUiState(
    val phase: TacticalScreenPhase = TacticalScreenPhase.DASHBOARD,
    val progress: TacticalProgress = TacticalStages.defaultProgress(),
    val currentStage: TacticalStage? = null,
    val currentPuzzle: TacticalPuzzle? = null,
    val puzzleIndex: Int = 0,
    val fen: String = ChessGame.STARTING_FEN,
    val playerColor: Color = Color.WHITE,
    val isLoading: Boolean = false,
    val isSolved: Boolean = false,
    val isWrongMove: Boolean = false,
    val wrongCount: Int = 0,
    val hintSquare: String? = null,
    val solutionShown: Boolean = false,
    val solutionMoveIndex: Int = 0,
    val lastScore: PuzzleScoreResult? = null,
    val lastRatingDelta: RatingDelta? = null,
    val errorMessage: String? = null,
    val puzzleCount: Int = 0,
)

@HiltViewModel
class TacticalTrainerViewModel @Inject constructor(
    @ApplicationContext private val appContext: Context,
    private val tacticalApi: TacticalApi,
) : ViewModel() {

    private val _uiState = MutableStateFlow(TacticalTrainerUiState())
    val uiState: StateFlow<TacticalTrainerUiState> = _uiState.asStateFlow()

    private val gson = Gson()
    private var currentMoveIndex = 0
    private var puzzles: List<TacticalPuzzle> = emptyList()
    private var progress = TacticalStages.defaultProgress()
    private val offlineQueue = mutableListOf<JsonObject>()
    private var syncedOnce = false

    init {
        loadProgressFromPrefs()
        syncProgressFromServer()
    }

    private fun loadProgressFromPrefs() {
        val prefs = appContext.getSharedPreferences("chess99_tactical", Context.MODE_PRIVATE)
        val json = prefs.getString("progress", null)
        if (json != null) {
            try {
                progress = gson.fromJson(json, TacticalProgress::class.java)
                _uiState.value = _uiState.value.copy(progress = progress)
            } catch (e: Exception) {
                Timber.e(e, "Failed to load tactical progress")
            }
        }
    }

    private fun saveProgressToPrefs() {
        val prefs = appContext.getSharedPreferences("chess99_tactical", Context.MODE_PRIVATE)
        prefs.edit().putString("progress", gson.toJson(progress)).apply()
    }

    private fun syncProgressFromServer() {
        viewModelScope.launch {
            try {
                val response = tacticalApi.getProgress()
                if (response.isSuccessful) {
                    val body = response.body() ?: return@launch
                    val stats = body.getAsJsonObject("stats") ?: return@launch
                    val stageArray = body.getAsJsonArray("stageProgress")
                    val badgeArray = body.getAsJsonArray("badges")

                    val serverRating = stats.get("rating")?.asInt ?: return@launch
                    val serverSolved = stats.get("totalSolved")?.asInt ?: 0
                    val serverAttempted = stats.get("totalAttempted")?.asInt ?: 0
                    val serverStreak = stats.get("streak")?.asInt ?: 0
                    val serverPeak = stats.get("peakRating")?.asInt ?: serverRating
                    val serverBest = stats.get("bestStreak")?.asInt ?: 0

                    // Merge server stage progress
                    val stageProgressMap = mutableMapOf<Int, StageProgress>()
                    if (stageArray != null) {
                        for (elem in stageArray) {
                            val obj = elem.asJsonObject
                            val stageId = obj.get("stageId")?.asInt ?: continue
                            val sp = StageProgress(
                                attempted = obj.get("attempted")?.asInt ?: 0,
                                solved = obj.get("solved")?.asInt ?: 0,
                                unlocked = obj.get("unlocked")?.asBoolean ?: (stageId == 0),
                                lastIndex = obj.get("lastIndex")?.asInt ?: 0,
                                completedPuzzleIds = try {
                                    obj.getAsJsonArray("completedPuzzleIds")?.map { it.asString }?.toSet() ?: emptySet()
                                } catch (_: Exception) { emptySet() },
                            )
                            stageProgressMap[stageId] = sp
                        }
                    }

                    // Parse badges
                    val badges = mutableListOf<TacticalBadge>()
                    if (badgeArray != null) {
                        for (elem in badgeArray) {
                            val obj = elem.asJsonObject
                            badges.add(TacticalBadge(
                                id = obj.get("id")?.asString ?: "",
                                name = obj.get("name")?.asString ?: "",
                                description = obj.get("description")?.asString ?: "",
                                icon = obj.get("icon")?.asString ?: "trophy",
                                tier = obj.get("tier")?.asString ?: "bronze",
                                isUnlocked = obj.get("isUnlocked")?.asBoolean ?: false,
                                unlockedAt = obj.get("unlockedAt")?.asString,
                            ))
                        }
                    }

                    progress = progress.copy(
                        rating = serverRating,
                        peakRating = serverPeak,
                        totalAttempted = serverAttempted,
                        totalSolved = serverSolved,
                        streak = serverStreak,
                        bestStreak = serverBest,
                        stageProgress = stageProgressMap,
                        badges = badges,
                    )
                    _uiState.value = _uiState.value.copy(progress = progress)
                    saveProgressToPrefs()
                }
            } catch (e: Exception) {
                Timber.d(e, "Tactical sync failed, using local progress")
            }
        }

        // One-time sync of local data to server
        if (!syncedOnce && progress.totalAttempted > 0) {
            syncedOnce = true
            viewModelScope.launch {
                try {
                    val snapshot = JsonObject().apply {
                        addProperty("rating", progress.rating)
                        addProperty("totalAttempted", progress.totalAttempted)
                        addProperty("totalSolved", progress.totalSolved)
                        addProperty("streak", progress.streak)
                    }
                    tacticalApi.syncLocalData(snapshot)
                } catch (e: Exception) {
                    Timber.d(e, "Tactical local sync failed")
                }
            }
        }

        // Flush offline queue
        flushOfflineQueue()
    }

    private fun flushOfflineQueue() {
        if (offlineQueue.isEmpty()) return
        val toFlush = offlineQueue.toList()
        offlineQueue.clear()
        viewModelScope.launch {
            for (attempt in toFlush) {
                try {
                    tacticalApi.submitAttempt(attempt)
                } catch (e: Exception) {
                    offlineQueue.add(attempt)
                }
            }
        }
    }

    fun selectStage(stageId: Int) {
        val stage = TacticalStages.stages.find { it.id == stageId } ?: return
        val sp = progress.stageProgress[stageId]
        val isUnlocked = sp?.unlocked ?: (stageId == 0)
        if (!isUnlocked) return

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            try {
                puzzles = loadPuzzlesFromFile(stage.dataFile)
                val completedIds = sp?.completedPuzzleIds ?: emptySet()
                val firstUnsolved = puzzles.indexOfFirst { it.id !in completedIds }
                val startIdx = if (firstUnsolved >= 0) firstUnsolved else 0

                // Check if all puzzles in this stage are completed
                if (completedIds.size >= puzzles.size && puzzles.isNotEmpty()) {
                    _uiState.value = _uiState.value.copy(
                        phase = TacticalScreenPhase.STAGE_COMPLETE,
                        currentStage = stage,
                        puzzleIndex = 0,
                        puzzleCount = puzzles.size,
                        isLoading = false,
                    )
                    return@launch
                }

                _uiState.value = _uiState.value.copy(
                    phase = TacticalScreenPhase.PUZZLE,
                    currentStage = stage,
                    puzzleIndex = startIdx,
                    puzzleCount = puzzles.size,
                    isLoading = false,
                )
                showPuzzle(startIdx)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    errorMessage = "Failed to load puzzles: ${e.message}",
                )
            }
        }
    }

    private fun loadPuzzlesFromFile(filename: String): List<TacticalPuzzle> {
        val assetPath = "tactical/$filename"
        val stream = appContext.assets.open(assetPath)
        val reader = InputStreamReader(stream)
        val type = object : TypeToken<List<TacticalPuzzle>>() {}.type
        val result: List<TacticalPuzzle> = gson.fromJson(reader, type)
        reader.close()
        return result.sortedBy { it.rating }
    }

    private fun showPuzzle(index: Int) {
        if (index >= puzzles.size) return
        val puzzle = puzzles[index]
        currentMoveIndex = 0
        val game = ChessGame(puzzle.fen)
        val color = when (puzzle.playerColor) {
            "b" -> Color.BLACK
            else -> Color.WHITE
        }

        _uiState.value = _uiState.value.copy(
            currentPuzzle = puzzle,
            fen = puzzle.fen,
            playerColor = color,
            isSolved = false,
            isWrongMove = false,
            wrongCount = 0,
            hintSquare = null,
            solutionShown = false,
            solutionMoveIndex = 0,
            lastScore = null,
            lastRatingDelta = null,
            puzzleIndex = index,
        )
    }

    fun attemptMove(from: String, to: String, promotion: Char?) {
        val puzzle = _uiState.value.currentPuzzle ?: return
        if (_uiState.value.isSolved) return

        val moveStr = "$from$to${promotion ?: ""}"
        val expectedMove = puzzle.moves.getOrNull(currentMoveIndex)

        if (expectedMove != null && (moveStr == expectedMove || "$from$to" == expectedMove.take(4))) {
            val game = ChessGame(_uiState.value.fen)
            game.move(from, to, promotion)
            currentMoveIndex++

            if (currentMoveIndex >= puzzle.moves.size) {
                onPuzzleSolved(puzzle)
            } else {
                // Opponent auto-responds
                val oppMove = puzzle.moves.getOrNull(currentMoveIndex)
                if (oppMove != null) {
                    game.moveUci(oppMove)
                    currentMoveIndex++
                    if (currentMoveIndex >= puzzle.moves.size) {
                        onPuzzleSolved(puzzle)
                        return
                    }
                }
                _uiState.value = _uiState.value.copy(
                    fen = game.fen(),
                    isWrongMove = false,
                )
            }
        } else {
            val newWrong = _uiState.value.wrongCount + 1
            val hint = if (newWrong >= 1) puzzle.moves.getOrNull(currentMoveIndex)?.take(2) else null
            _uiState.value = _uiState.value.copy(
                isWrongMove = true,
                wrongCount = newWrong,
                hintSquare = hint,
            )
            // Streak is only broken when returning to dashboard
        }
    }

    private fun onPuzzleSolved(puzzle: TacticalPuzzle) {
        val score = TacticalStages.computePuzzleScore(
            wrongCount = _uiState.value.wrongCount,
            solutionShown = _uiState.value.solutionShown,
        )
        val delta = TacticalStages.computeRatingDelta(
            puzzle = puzzle,
            success = true,
            wrongCount = _uiState.value.wrongCount,
            cctQuality = score.cctQuality,
        )

        val newRating = (progress.rating + delta.value).coerceIn(800, 2400)
        val newPeak = maxOf(progress.peakRating, newRating)
        val newBest = maxOf(progress.bestStreak, progress.streak + 1)
        val sp = progress.stageProgress[puzzle.stage] ?: StageProgress(unlocked = true)
        val newCompleted = sp.completedPuzzleIds + puzzle.id
        val newSp = sp.copy(
            attempted = sp.attempted + 1,
            solved = sp.solved + 1,
            lastIndex = _uiState.value.puzzleIndex + 1,
            completedPuzzleIds = newCompleted,
        )

        // Check unlock for next stage
        val mutableMap = progress.stageProgress.toMutableMap()
        mutableMap[puzzle.stage] = newSp
        val nextStageId = puzzle.stage + 1
        val nextStage = TacticalStages.stages.find { it.id == nextStageId }
        if (nextStage != null) {
            val nextSp = mutableMap[nextStageId] ?: StageProgress()
            if (!nextSp.unlocked && newSp.solved >= nextStage.unlockAfter) {
                mutableMap[nextStageId] = nextSp.copy(unlocked = true)
            }
        }

        progress = progress.copy(
            rating = newRating,
            peakRating = newPeak,
            totalAttempted = progress.totalAttempted + 1,
            totalSolved = progress.totalSolved + 1,
            streak = progress.streak + 1,
            bestStreak = newBest,
            stageProgress = mutableMap,
        )
        saveProgressToPrefs()
        submitAttemptToServer(puzzle, true, score)

        val finalGame = ChessGame(_uiState.value.fen)
        finalGame.moveUci(puzzle.moves.last())
        _uiState.value = _uiState.value.copy(
            fen = finalGame.fen(),
            isSolved = true,
            isWrongMove = false,
            lastScore = score,
            lastRatingDelta = delta,
            progress = progress,
        )
    }

    fun showSolution() {
        val puzzle = _uiState.value.currentPuzzle ?: return
        if (_uiState.value.solutionShown) return

        val score = TacticalStages.computePuzzleScore(
            wrongCount = _uiState.value.wrongCount,
            solutionShown = true,
        )
        val delta = TacticalStages.computeRatingDelta(
            puzzle = puzzle,
            success = false,
            wrongCount = _uiState.value.wrongCount,
            cctQuality = score.cctQuality,
        )

        val newRating = (progress.rating - delta.value).coerceIn(800, 2400)
        val sp = progress.stageProgress[puzzle.stage] ?: StageProgress(unlocked = true)
        val newSp = sp.copy(
            attempted = sp.attempted + 1,
            lastIndex = _uiState.value.puzzleIndex + 1,
        )
        val mutableMap = progress.stageProgress.toMutableMap()
        mutableMap[puzzle.stage] = newSp

        progress = progress.copy(
            rating = newRating,
            totalAttempted = progress.totalAttempted + 1,
            streak = 0,
            stageProgress = mutableMap,
        )
        saveProgressToPrefs()
        submitAttemptToServer(puzzle, false, score)

        _uiState.value = _uiState.value.copy(
            phase = TacticalScreenPhase.SOLUTION_VIEWER,
            solutionShown = true,
            solutionMoveIndex = 0,
            lastScore = score,
            lastRatingDelta = delta,
            progress = progress,
        )
    }

    fun navigateSolution(direction: Int) {
        val puzzle = _uiState.value.currentPuzzle ?: return
        val newIndex = (_uiState.value.solutionMoveIndex + direction).coerceIn(0, puzzle.moves.lastIndex)
        val game = ChessGame(puzzle.fen)
        repeat(newIndex + 1) { idx ->
            game.moveUci(puzzle.moves[idx])
        }
        _uiState.value = _uiState.value.copy(
            solutionMoveIndex = newIndex,
            fen = game.fen(),
        )
    }

    fun nextPuzzle() {
        val nextIdx = _uiState.value.puzzleIndex + 1
        val stage = _uiState.value.currentStage ?: return
        val sp = progress.stageProgress[stage.id]

        // Check if stage is now complete
        val completedCount = sp?.completedPuzzleIds?.size ?: 0
        if (nextIdx >= puzzles.size) {
            _uiState.value = _uiState.value.copy(
                phase = TacticalScreenPhase.STAGE_COMPLETE,
                puzzleIndex = 0,
            )
            return
        }

        showPuzzle(nextIdx)
    }

    fun backToDashboard() {
        // Sync progress from server when returning to dashboard
        syncProgressFromServer()
        _uiState.value = _uiState.value.copy(
            phase = TacticalScreenPhase.DASHBOARD,
            currentPuzzle = null,
            currentStage = null,
            isSolved = false,
            solutionShown = false,
            lastScore = null,
            lastRatingDelta = null,
        )
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(errorMessage = null)
    }

    private fun submitAttemptToServer(puzzle: TacticalPuzzle, success: Boolean, score: PuzzleScoreResult) {
        val body = JsonObject().apply {
            addProperty("stage_id", puzzle.stage)
            addProperty("puzzle_id", puzzle.id)
            addProperty("success", success)
            addProperty("puzzle_rating", puzzle.rating)
            addProperty("puzzle_difficulty", puzzle.difficulty)
            addProperty("wrong_count", _uiState.value.wrongCount)
            addProperty("solution_shown", _uiState.value.solutionShown)
            addProperty("score", score.combined ?: score.execScore)
            addProperty("cct_attempted", score.cctAttempted)
            addProperty("cct_quality", score.cctQuality.toDouble())
        }

        viewModelScope.launch {
            try {
                val response = tacticalApi.submitAttempt(body)
                if (response.isSuccessful) {
                    val respBody = response.body() ?: return@launch
                    // Update badges from response
                    val awardedBadges = respBody.getAsJsonArray("awardedBadges")
                    if (awardedBadges != null && awardedBadges.size() > 0) {
                        val newBadges = progress.badges.toMutableList()
                        for (elem in awardedBadges) {
                            val obj = elem.asJsonObject
                            val badgeId = obj.get("id")?.asString ?: continue
                            val idx = newBadges.indexOfFirst { it.id == badgeId }
                            val badge = TacticalBadge(
                                id = badgeId,
                                name = obj.get("name")?.asString ?: "",
                                description = obj.get("description")?.asString ?: "",
                                icon = obj.get("icon")?.asString ?: "trophy",
                                tier = obj.get("tier")?.asString ?: "bronze",
                                isUnlocked = true,
                                unlockedAt = obj.get("unlockedAt")?.asString,
                            )
                            if (idx >= 0) newBadges[idx] = badge else newBadges.add(badge)
                        }
                        progress = progress.copy(badges = newBadges)
                        _uiState.value = _uiState.value.copy(progress = progress)
                        saveProgressToPrefs()
                    }
                }
            } catch (e: Exception) {
                Timber.d(e, "Tactical attempt queued offline")
                offlineQueue.add(body)
            }
        }
    }
}
