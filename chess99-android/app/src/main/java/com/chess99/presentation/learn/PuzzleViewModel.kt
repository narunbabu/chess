package com.chess99.presentation.learn

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.R
import com.chess99.data.api.TutorialApi
import com.chess99.data.api.arrOrNull
import com.chess99.data.api.objOrNull
import com.chess99.data.api.str
import com.chess99.engine.ChessGame
import com.chess99.engine.Color
import com.chess99.engine.Move
import com.chess99.presentation.common.MoveEffects
import com.chess99.presentation.common.MoveReplay
import com.chess99.presentation.learn.tactical.TacticalPuzzle
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import timber.log.Timber

data class PuzzleUiState(
    val isLoading: Boolean = false,
    val currentPuzzle: PuzzleData? = null,
    val fen: String = ChessGame.STARTING_FEN,
    val playerColor: Color = Color.WHITE,
    // Placeholders only: the ViewModel fills both from strings.xml, because a
    // data-class default has no Context.
    val instruction: String = "",
    val difficulty: String = "",
    val puzzleNumber: Int = 1,
    val hint: String? = null,
    val isSolved: Boolean = false,
    val isWrongMove: Boolean = false,
    val solvedCount: Int = 0,
    val streakCount: Int = 0,
    val isOfflinePuzzle: Boolean = false,
    // Review of the persisted daily-challenge submit; null until a daily
    // puzzle finishes (bundled puzzles never submit).
    val dailyReview: DailySubmitReview? = null,
    // Squares of the ply that produced [fen] — the opponent's reply when there
    // is one, otherwise the player's own move.
    val lastMoveFrom: Int = -1,
    val lastMoveTo: Int = -1,
    val lastMoveEffects: MoveEffects = MoveEffects.None,
)

/**
 * Server response to the daily submit: whether the solve was persisted (and
 * its reward), or that persistence failed and the solve only exists locally.
 */
data class DailySubmitReview(
    val persisted: Boolean,
    val correct: Boolean = true,
    val xpAwarded: Int = 0,
    val alreadyCompleted: Boolean = false,
)

data class PuzzleData(
    val id: String,
    val fen: String,
    val solutionMoves: List<String>,
    val difficulty: String,
    val theme: String,
    val playerColor: Color,
    val isOffline: Boolean,
    // Daily-challenge extras: the solver persists the solve for these and
    // skips the submit when the backend already has the completion.
    val isDaily: Boolean = false,
    val dailyChallengeId: Int? = null,
    val trackSlug: String? = null,
    val alreadyCompleted: Boolean = false,
    // Daily solutions stay in the SAN the server stores and validates. Every
    // entry is one of the *player's* moves — the web solver compares the Nth
    // move played with solution[N] (DailyChallengePage.js:126-140) and never
    // auto-plays a reply — so the daily branch of attemptMove matches SAN and
    // leaves solutionMoves for hints only.
    val solutionSan: List<String> = emptyList(),
    val hints: List<String> = emptyList(),
)

@HiltViewModel
class PuzzleViewModel @Inject constructor(
    @ApplicationContext private val appContext: Context,
    private val tutorialApi: TutorialApi,
) : ViewModel() {

    private val _uiState = MutableStateFlow(PuzzleUiState())
    val uiState: StateFlow<PuzzleUiState> = _uiState.asStateFlow()

    private var currentMoveIndex = 0
    private var puzzleIndex = 0
    private var puzzles = mutableListOf<PuzzleData>()
    private val gson = Gson()

    // Static bundled puzzles are parsed once; the daily challenge reloads
    // whenever the requested track changes (loadedTrack).
    private var bundledPuzzles: List<PuzzleData>? = null
    private var dailyPuzzle: PuzzleData? = null
    private var loadedTrack: String? = null

    // SAN of the moves the player made on the current puzzle — the daily
    // submit's `solution` payload. Bundled puzzles never submit, so this
    // only accumulates meaning while a daily challenge is on the board.
    private val playerSanLine = mutableListOf<String>()
    private var dailyStartedAtMs: Long = 0

    fun loadPuzzles(track: String? = loadedTrack) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                if (track != loadedTrack) {
                    loadedTrack = track
                    puzzleIndex = 0
                    dailyPuzzle = fetchDailyChallenge(track)
                }
                if (bundledPuzzles == null) {
                    // A missing or corrupt asset must not take the daily
                    // challenge down with it — it is the one puzzle here whose
                    // solve is persisted.
                    bundledPuzzles = try {
                        loadBundledPuzzles()
                    } catch (e: Exception) {
                        Timber.e(e, "Failed to load bundled puzzles")
                        emptyList()
                    }
                }
                puzzles = (listOfNotNull(dailyPuzzle) + (bundledPuzzles ?: emptyList())).toMutableList()
                if (puzzles.isNotEmpty()) {
                    puzzleIndex %= puzzles.size
                    showPuzzle(puzzles[puzzleIndex])
                } else {
                    _uiState.value = _uiState.value.copy(currentPuzzle = null)
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to load puzzles")
            } finally {
                _uiState.value = _uiState.value.copy(isLoading = false)
            }
        }
    }

    /**
     * Today's challenge for [track]. The payload nests the board under
     * `data.challenge_data` ({ fen, solution, hints }), with the challenge row
     * id and the caller's completion state alongside. Solution moves are SAN
     * ("Ra8#") like on the web and are kept that way — the submit is validated
     * against them server-side. A UCI rendering is derived best-effort for the
     * hint square only; a line that cannot be replayed move-after-move (the
     * usual case once a solution has more than one player move, since the
     * replies are not in the list) simply leaves the hint without a square.
     */
    private suspend fun fetchDailyChallenge(track: String?): PuzzleData? {
        return try {
            val response = tutorialApi.getDailyChallenge(track)
            if (!response.isSuccessful) return null
            val data = response.body()?.get("data").objOrNull() ?: return null
            val challengeData = data.get("challenge_data").objOrNull()
            val fen = challengeData?.str("fen") ?: return null
            val sanSolution = challengeData.get("solution").arrOrNull()
                ?.mapNotNull { el -> el.takeIf { it.isJsonPrimitive }?.asString }
                ?.takeIf { it.isNotEmpty() }
                ?: return null
            PuzzleData(
                id = data.str("id") ?: "daily",
                fen = fen,
                solutionMoves = sanLineToUci(fen, sanSolution) ?: emptyList(),
                solutionSan = sanSolution,
                hints = challengeData.get("hints").arrOrNull()
                    ?.mapNotNull { el -> el.takeIf { it.isJsonPrimitive }?.asString }
                    ?: emptyList(),
                difficulty = challengeData.str("difficulty")
                    ?: data.str("skill_tier")
                    ?: appContext.getString(R.string.puzzle_difficulty_medium),
                theme = challengeData.str("category") ?: "tactics",
                playerColor = ChessGame(fen).turn,
                isOffline = false,
                isDaily = true,
                dailyChallengeId = data.str("id")?.toIntOrNull(),
                trackSlug = data.str("track_slug") ?: track,
                alreadyCompleted = data.get("user_completion").objOrNull()
                    ?.get("completed")?.takeIf { it.isJsonPrimitive }?.asBoolean ?: false,
            )
        } catch (e: Exception) {
            Timber.d(e, "Daily challenge unavailable; using bundled puzzles")
            null
        }
    }

    /** SAN ("Ra8#") → UCI ("a6a8") by replaying the line on a scratch board. */
    private fun sanLineToUci(fen: String, sanMoves: List<String>): List<String>? {
        val scratch = ChessGame(fen)
        val uci = ArrayList<String>(sanMoves.size)
        for (san in sanMoves) {
            // Strip check/mate suffixes — the local SAN generator never emits
            // them, so moveSan would not match otherwise.
            val move = scratch.moveSan(san.replace("#", "").replace("+", "")) ?: return null
            uci.add(move.uci())
        }
        return uci
    }

    private fun showPuzzle(puzzle: PuzzleData) {
        currentMoveIndex = 0
        playerSanLine.clear()
        dailyStartedAtMs = System.currentTimeMillis()
        _uiState.value = _uiState.value.copy(
            currentPuzzle = puzzle,
            fen = puzzle.fen,
            playerColor = puzzle.playerColor,
            instruction = appContext.getString(R.string.puzzle_instruction_default),
            difficulty = puzzle.difficulty,
            puzzleNumber = puzzleIndex + 1,
            hint = null,
            isSolved = false,
            isWrongMove = false,
            isOfflinePuzzle = puzzle.isOffline,
            dailyReview = null,
            lastMoveFrom = -1,
            lastMoveTo = -1,
            lastMoveEffects = MoveEffects.None,
        )
    }

    fun attemptMove(from: String, to: String, promotion: Char?) {
        val puzzle = _uiState.value.currentPuzzle ?: return
        if (_uiState.value.isSolved) return
        if (puzzle.solutionSan.isNotEmpty()) {
            attemptDailyMove(puzzle, from, to, promotion)
            return
        }

        val moveStr = "$from$to${promotion ?: ""}"
        val expectedMove = puzzle.solutionMoves.getOrNull(currentMoveIndex)

        if (expectedMove != null && (moveStr == expectedMove || "$from$to" == expectedMove.take(4))) {
            // Correct move
            val fenBefore = _uiState.value.fen
            val game = ChessGame(fenBefore)
            // The board highlights whichever ply left the position on screen,
            // so keep hold of the last one actually played.
            var lastPlayed: Move? = game.move(from, to, promotion)
            // SAN is read off a board that has NOT advanced: san() disambiguates
            // against game.legalMoves(), which after the move are the opponent's
            // and would invent a file/rank prefix.
            lastPlayed?.let { playerSanLine.add(it.san(ChessGame(fenBefore))) }
            currentMoveIndex++

            if (currentMoveIndex < puzzle.solutionMoves.size) {
                puzzle.solutionMoves.getOrNull(currentMoveIndex)?.let { opponentMove ->
                    val reply = game.moveUci(opponentMove)
                    if (reply != null) {
                        lastPlayed = reply
                        currentMoveIndex++
                    }
                    // A reply that is not playable from here (a single-side
                    // solution line) leaves the index put, so the player plays
                    // the next move themselves — same as the web solver.
                }
            }

            val played = lastPlayed
            if (currentMoveIndex >= puzzle.solutionMoves.size) {
                // Puzzle solved
                _uiState.value = _uiState.value.copy(
                    fen = game.fen(),
                    isSolved = true,
                    isWrongMove = false,
                    solvedCount = _uiState.value.solvedCount + 1,
                    streakCount = _uiState.value.streakCount + 1,
                    lastMoveFrom = played?.from ?: -1,
                    lastMoveTo = played?.to ?: -1,
                    lastMoveEffects = played?.let { MoveReplay.effectsOf(it) } ?: MoveEffects.None,
                )
                submitDailySolve(puzzle)
            } else {
                _uiState.value = _uiState.value.copy(
                    fen = game.fen(),
                    isWrongMove = false,
                    lastMoveFrom = played?.from ?: -1,
                    lastMoveTo = played?.to ?: -1,
                    lastMoveEffects = played?.let { MoveReplay.effectsOf(it) } ?: MoveEffects.None,
                )
            }
        } else {
            // Wrong move
            _uiState.value = _uiState.value.copy(
                isWrongMove = true,
                streakCount = 0,
            )
        }
    }

    /**
     * The daily solver, matching the web one move-for-move: play the move,
     * compare its SAN with `solution[currentMoveIndex]` ignoring `+`/`#` and
     * case, and finish when the player has played the whole line themselves.
     * No reply is auto-played, because the stored solution holds only the
     * player's moves.
     */
    private fun attemptDailyMove(puzzle: PuzzleData, from: String, to: String, promotion: Char?) {
        val fenBefore = _uiState.value.fen
        val game = ChessGame(fenBefore)
        val played = game.move(from, to, promotion)
        if (played == null) {
            _uiState.value = _uiState.value.copy(isWrongMove = true, streakCount = 0)
            return
        }
        // Pre-move board for SAN — see the note in attemptMove.
        val san = played.san(ChessGame(fenBefore))
        val expected = puzzle.solutionSan.getOrNull(currentMoveIndex)
        if (expected == null || !sanMatches(expected, san)) {
            _uiState.value = _uiState.value.copy(isWrongMove = true, streakCount = 0)
            return
        }

        playerSanLine.add(san)
        currentMoveIndex++
        val solved = currentMoveIndex >= puzzle.solutionSan.size
        _uiState.value = _uiState.value.copy(
            fen = game.fen(),
            isWrongMove = false,
            isSolved = solved,
            solvedCount = if (solved) _uiState.value.solvedCount + 1 else _uiState.value.solvedCount,
            streakCount = if (solved) _uiState.value.streakCount + 1 else _uiState.value.streakCount,
            lastMoveFrom = played.from,
            lastMoveTo = played.to,
            lastMoveEffects = MoveReplay.effectsOf(played),
        )
        if (solved) submitDailySolve(puzzle)
    }

    /** SAN equality the way the backend compares it: `+`/`#` stripped, case-insensitive. */
    private fun sanMatches(expected: String, actual: String): Boolean =
        expected.replace("#", "").replace("+", "").trim()
            .equals(actual.replace("#", "").replace("+", "").trim(), ignoreCase = true)

    /**
     * Persists the daily solve (tutorial/daily-challenge/submit) with the same
     * payload the web sends: challenge id, track, the SAN solution line and
     * seconds spent. The backend validates the line server-side and records
     * the completion/attempts, so the Daily hub shows it after a reload.
     */
    private fun submitDailySolve(puzzle: PuzzleData) {
        if (!puzzle.isDaily) return
        if (puzzle.alreadyCompleted) {
            _uiState.value = _uiState.value.copy(
                dailyReview = DailySubmitReview(persisted = true, alreadyCompleted = true),
            )
            return
        }
        val challengeId = puzzle.dailyChallengeId
        if (challengeId == null) {
            _uiState.value = _uiState.value.copy(dailyReview = DailySubmitReview(persisted = false))
            return
        }
        val spentSeconds = ((System.currentTimeMillis() - dailyStartedAtMs) / 1000).coerceAtLeast(0L).toInt()
        val body = JsonObject().apply {
            addProperty("challenge_id", challengeId)
            puzzle.trackSlug?.let { addProperty("track", it) }
            add("solution", JsonArray().apply { playerSanLine.forEach { add(it) } })
            addProperty("time_spent_seconds", spentSeconds)
        }
        viewModelScope.launch {
            try {
                val response = tutorialApi.submitDailyChallenge(body)
                val data = response.body()?.get("data").objOrNull()
                if (!response.isSuccessful || data == null) {
                    Timber.w("Daily challenge submit not accepted (http %d)", response.code())
                    _uiState.value = _uiState.value.copy(dailyReview = DailySubmitReview(persisted = false))
                    return@launch
                }
                _uiState.value = _uiState.value.copy(
                    dailyReview = DailySubmitReview(
                        persisted = true,
                        correct = data.get("correct")?.takeIf { it.isJsonPrimitive }?.asBoolean ?: true,
                        xpAwarded = data.get("xp_awarded")?.takeIf { it.isJsonPrimitive }?.asInt ?: 0,
                    ),
                )
            } catch (e: Exception) {
                Timber.e(e, "Failed to submit daily challenge result")
                _uiState.value = _uiState.value.copy(dailyReview = DailySubmitReview(persisted = false))
            }
        }
    }

    fun requestHint() {
        val puzzle = _uiState.value.currentPuzzle ?: return
        // Daily challenges ship written hints (challenge_data.hints), which is
        // what the web shows; fall back to the from-square of the next move.
        val hint = puzzle.hints.getOrNull(currentMoveIndex)
            ?: puzzle.hints.firstOrNull()
            ?: puzzle.solutionMoves.getOrNull(currentMoveIndex)
                ?.let { appContext.getString(R.string.puzzle_hint_from_square, it.take(2)) }
            ?: return
        _uiState.value = _uiState.value.copy(hint = hint)
    }

    fun nextPuzzle() {
        puzzleIndex++
        loadPuzzles()
    }

    private fun loadBundledPuzzles(): List<PuzzleData> {
        val filenames = listOf(
            "beginner_puzzles.json",
            "stage1_puzzles.json",
            "stage2_puzzles.json",
            "stage3_puzzles.json",
            "stage4_puzzles.json",
        )
        val type = object : TypeToken<List<TacticalPuzzle>>() {}.type
        return filenames.flatMap { filename ->
            appContext.assets.open("tactical/$filename").bufferedReader().use { reader ->
                val tactical: List<TacticalPuzzle> = gson.fromJson(reader, type)
                tactical.mapNotNull(::normalizeBundledPuzzle)
            }
        }
    }

    /**
     * Bundled Lichess puzzles store the opponent's setup ply first. Apply that
     * move so the player receives the actual puzzle position.
     */
    private fun normalizeBundledPuzzle(puzzle: TacticalPuzzle): PuzzleData? {
        if (puzzle.moves.size < 2) return null
        return try {
            val game = ChessGame(puzzle.fen)
            if (game.moveUci(puzzle.moves.first()) == null) return null
            val normalizedMoves = puzzle.moves.drop(1)
            if (normalizedMoves.isEmpty()) return null
            PuzzleData(
                id = puzzle.id,
                fen = game.fen(),
                solutionMoves = normalizedMoves,
                difficulty = puzzle.difficulty.replaceFirstChar { it.uppercase() },
                theme = puzzle.themes.firstOrNull() ?: "tactics",
                playerColor = game.turn,
                isOffline = true,
            )
        } catch (e: Exception) {
            Timber.d(e, "Skipping malformed bundled puzzle ${puzzle.id}")
            null
        }
    }
}
