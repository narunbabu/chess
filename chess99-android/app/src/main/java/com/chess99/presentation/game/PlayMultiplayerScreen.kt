package com.chess99.presentation.game

import androidx.activity.compose.BackHandler
import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.automirrored.filled.Undo
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.chess99.R
import com.chess99.engine.ChessGame
import com.chess99.presentation.common.AccessibleChessMoveControls
import com.chess99.presentation.common.ActiveGameType
import com.chess99.presentation.common.ChessBoardView
import com.chess99.presentation.common.GameCompletionAnimation
import com.chess99.presentation.common.GameNavigationWarningDialog
import com.chess99.presentation.common.GameTimerDisplay
import com.chess99.presentation.history.LifelineMarkers
import kotlinx.coroutines.launch

/**
 * Real-time multiplayer game screen.
 * Mirrors chess-frontend/src/components/play/PlayMultiplayer.js + GameContainer.js
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlayMultiplayerScreen(
    onNavigateBack: () -> Unit,
    viewModel: PlayMultiplayerViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()
    val companionState by viewModel.companionState.collectAsState()
    val cctState by viewModel.cctState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    var showNavigationWarning by remember { mutableStateOf(false) }
    var showCompletionAnimation by remember { mutableStateOf(false) }

    // Victory-image share (G3.1): capture the current screen and share it.
    val shareView = LocalView.current
    val shareContext = LocalContext.current
    val shareScope = rememberCoroutineScope()

    // Companion bottom sheet
    val companionSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var showCompanionSheet by remember { mutableStateOf(false) }

    // CCT analysis bottom sheet
    val cctSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var showCctSheet by remember { mutableStateOf(false) }

    val scope = rememberCoroutineScope()

    // Hardware/gesture back gets the SAME leave-game confirmation as the
    // toolbar back arrow — previously only the arrow was guarded (S11 T3).
    BackHandler(enabled = state.gamePhase == MultiplayerPhase.PLAYING) {
        showNavigationWarning = true
    }

    // Load companions when sheet opens for the first time
    LaunchedEffect(showCompanionSheet) {
        if (showCompanionSheet && companionState.companions.isEmpty() && !companionState.isLoading) {
            viewModel.loadCompanions()
        }
    }

    // Show completion animation when game ends
    LaunchedEffect(state.gamePhase) {
        if (state.gamePhase == MultiplayerPhase.COMPLETED && state.gameResult != null) {
            showCompletionAnimation = true
        }
    }

    // Navigation warning for back press during active game (toolbar arrow AND
    // hardware/gesture back via BackHandler above trigger the same dialog).
    if (showNavigationWarning) {
        GameNavigationWarningDialog(
            gameType = leaveGameType(state.isRated, state.isSyntheticGame),
            onLeave = {
                showNavigationWarning = false
                viewModel.leaveGame(onLeft = onNavigateBack)
            },
            onStay = { showNavigationWarning = false },
        )
    }

    // Game completion overlay
    if (showCompletionAnimation && state.gameResult != null) {
        GameCompletionAnimation(
            result = when (state.gameResult!!.status) {
                ResultStatus.WON -> "win"
                ResultStatus.LOST -> "loss"
                else -> "draw"
            },
            ratingChange = 0,
            onDismiss = { showCompletionAnimation = false },
        )
    }

    // Sound effects
    LaunchedEffect(state.soundToPlay) {
        state.soundToPlay?.let { viewModel.soundPlayed() }
    }

    // Trigger CCT analysis when position changes
    LaunchedEffect(state.fen, cctState.hintLevel, cctState.perspective) {
        if (cctState.hintLevel > 0 && state.gamePhase == MultiplayerPhase.PLAYING) {
            viewModel.updateCCTAnalysis()
        }
    }

    // Snackbar
    LaunchedEffect(state.snackbarMessage) {
        state.snackbarMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearSnackbar()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        // T3/T4/T5: a synthetic-opponent game always shows the
                        // bot's real name here \u2014 never "Computer (Level N)"
                        // and never a raw "synthetic" enum (spec T4).
                        Text(
                            text = if (state.isSyntheticGame) {
                                stringResource(R.string.game_playing_opponent, state.opponentName)
                            } else {
                                stringResource(R.string.game_number, state.gameId)
                            },
                            style = MaterialTheme.typography.titleMedium,
                        )
                        Text(
                            // Learning games are casual server-side (game_mode
                            // is validated as rated|casual), so the flag - not
                            // game_mode - decides the label. Without this a
                            // Learning game reads "Casual".
                            text = stringResource(
                                R.string.game_subtitle,
                                stringResource(
                                    when {
                                        state.isRated -> R.string.mode_rated
                                        state.isLearningMode -> R.string.mode_learning
                                        else -> R.string.mode_casual
                                    }
                                ),
                                state.timeControl,
                            ),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = {
                        if (state.gamePhase == MultiplayerPhase.PLAYING) {
                            showNavigationWarning = true
                        } else {
                            onNavigateBack()
                        }
                    }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.action_back))
                    }
                },
                actions = {
                    // Companion toggle (casual human-vs-human games only — a
                    // T3 synthetic-opponent game already has its own bot
                    // auto-playing the opponent side, so Companion Mode
                    // doesn't apply here).
                    if (!state.isRated && !state.isSyntheticGame && state.gamePhase != MultiplayerPhase.COMPLETED) {
                        IconButton(onClick = {
                            scope.launch {
                                showCompanionSheet = true
                            }
                        }) {
                            Icon(
                                Icons.Default.SmartToy,
                                contentDescription = stringResource(R.string.a11y_companion),
                                tint = if (companionState.selectedCompanion != null)
                                    MaterialTheme.colorScheme.primary
                                else MaterialTheme.colorScheme.onSurface,
                            )
                        }
                    }

                    // CCT Analysis toggle
                    if (state.gamePhase == MultiplayerPhase.PLAYING) {
                        IconButton(onClick = {
                            scope.launch {
                                showCctSheet = true
                            }
                        }) {
                            Icon(
                                Icons.Default.Analytics,
                                contentDescription = stringResource(R.string.a11y_analysis),
                                tint = if (cctState.hintLevel > 0)
                                    MaterialTheme.colorScheme.primary
                                else MaterialTheme.colorScheme.onSurface,
                            )
                        }
                    }

                    if (state.isChatFeatureEnabled && !state.isSyntheticGame) {
                        BadgedBox(
                            badge = {
                                if (state.unreadChatCount > 0) {
                                    Badge { Text("${state.unreadChatCount}") }
                                }
                            }
                        ) {
                            IconButton(onClick = { viewModel.toggleChat() }) {
                                Icon(Icons.AutoMirrored.Filled.Chat, stringResource(R.string.a11y_chat))
                            }
                        }
                    }

                    // Connection indicator
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(
                                if (state.isWebSocketConnected) Color(0xFF4CAF50)
                                else Color(0xFFFF5722)
                            )
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                },
            )
        },
    ) { padding ->
        when {
            state.isLoading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator()
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(stringResource(R.string.game_loading))
                    }
                }
            }

            state.isChatOpen -> {
                ChatPanel(
                    messages = state.chatMessages,
                    isGameOver = state.gamePhase == MultiplayerPhase.COMPLETED,
                    isMinor = state.isMinor,
                    policy = state.chatPolicy,
                    notice = state.chatNotice,
                    reportedMessageIds = state.reportedMessageIds,
                    onSendMessage = { viewModel.sendChat(it) },
                    onReportMessage = { viewModel.reportChatMessage(it) },
                    onBlockUser = { viewModel.blockChatUser(it) },
                    onClose = { viewModel.toggleChat() },
                    modifier = Modifier.padding(padding),
                )
            }

            else -> {
                GameBoard(
                    state = state,
                    modifier = Modifier.padding(padding),
                    onMove = { from, to, promo -> viewModel.onPlayerMove(from, to, promo) },
                    onResign = { viewModel.resign() },
                    onOfferDraw = { viewModel.offerDraw() },
                    onAcceptDraw = { viewModel.acceptDraw() },
                    onDeclineDraw = { viewModel.declineDraw() },
                    onRequestUndo = { viewModel.requestUndo() },
                    bestMovesOn = cctState.hintLevel == 2,
                    // Best shares the takeback pool, so a paid reveal needs a
                    // chance left — unless it is already showing at this
                    // position (same-position re-toggles stay free).
                    canUseBestMoves = state.undoChancesRemaining > 0 || cctState.hintLevel == 2,
                    onToggleBest = {
                        viewModel.setCctHintLevel(if (cctState.hintLevel == 2) 0 else 2)
                    },
                    reviewEnabled = state.reviewEnabled,
                    reviewLoading = state.reviewLoading,
                    onToggleReview = { viewModel.setReviewEnabled(it) },
                    latestReview = state.latestReview,
                    onAcceptUndo = { viewModel.acceptUndo() },
                    onDeclineUndo = { viewModel.declineUndo() },
                    onPause = { viewModel.pauseGame() },
                    onRequestResume = { viewModel.requestResumeGame() },
                    onNavigateBack = onNavigateBack,
                    onShare = {
                        val shareable = viewModel.buildShareableGame()
                        shareScope.launch {
                            viewModel.shareManager.captureAndShare(shareView, shareContext, shareable)
                        }
                    },
                )
            }
        }

        // Error dialog
        state.error?.let { error ->
            AlertDialog(
                onDismissRequest = { viewModel.clearError() },
                title = { Text(stringResource(R.string.error_title)) },
                text = { Text(error) },
                confirmButton = {
                    TextButton(onClick = { viewModel.clearError() }) { Text(stringResource(R.string.action_ok)) }
                },
            )
        }

        // Companion bottom sheet
        if (showCompanionSheet) {
            val game = remember(state.fen) { ChessGame(state.fen) }
            val isMyTurn = game.turn == state.playerColor
                    && state.gamePhase == MultiplayerPhase.PLAYING

            CompanionBottomSheet(
                companions = companionState.companions,
                selectedCompanion = companionState.selectedCompanion,
                isLoading = companionState.isLoading,
                error = companionState.error,
                isContinuousPlay = companionState.isContinuousPlay,
                moveCount = companionState.moveCount,
                isMyTurn = isMyTurn,
                isGameActive = state.gamePhase == MultiplayerPhase.PLAYING,
                companionThinking = companionState.isThinking,
                onSelect = { viewModel.selectCompanion(it) },
                onPlayOneMove = { viewModel.companionPlayOneMove() },
                onToggleContinuous = { viewModel.toggleCompanionContinuousPlay() },
                onDismiss = {
                    showCompanionSheet = false
                    scope.launch { companionSheetState.hide() }
                },
                onRelease = {
                    viewModel.releaseCompanion()
                    showCompanionSheet = false
                    scope.launch { companionSheetState.hide() }
                },
                onRetry = { viewModel.loadCompanions() },
                sheetState = companionSheetState,
            )
        }

        // CCT Analysis bottom sheet
        if (showCctSheet) {
            CCTBottomSheet(
                state = cctState,
                isActive = state.gamePhase == MultiplayerPhase.PLAYING,
                isRated = state.isRated,
                onHintLevelChange = { viewModel.setCctHintLevel(it) },
                onPerspectiveChange = { viewModel.setCctPerspective(it) },
                onDismiss = {
                    showCctSheet = false
                    scope.launch { cctSheetState.hide() }
                },
                sheetState = cctSheetState,
            )
        }
    }
}

// ── Game Board Layout ───────────────────────────────────────────────────

@Composable
private fun GameBoard(
    state: MultiplayerUiState,
    modifier: Modifier = Modifier,
    onMove: (String, String, Char?) -> Unit,
    onResign: () -> Unit,
    onOfferDraw: () -> Unit,
    onAcceptDraw: () -> Unit,
    onDeclineDraw: () -> Unit,
    onRequestUndo: () -> Unit,
    bestMovesOn: Boolean,
    canUseBestMoves: Boolean,
    onToggleBest: () -> Unit,
    reviewEnabled: Boolean,
    reviewLoading: Boolean,
    onToggleReview: (Boolean) -> Unit,
    latestReview: LiveReviewResult?,
    onAcceptUndo: () -> Unit,
    onDeclineUndo: () -> Unit,
    onPause: () -> Unit,
    onRequestResume: () -> Unit,
    onNavigateBack: () -> Unit,
    onShare: () -> Unit,
) {
    val game = remember(state.fen) { ChessGame(state.fen) }
    val isMyTurn = game.turn == state.playerColor
            && state.gamePhase == MultiplayerPhase.PLAYING

    Column(
        modifier = modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // Opponent info + timer (top)
        val opponentColor = state.playerColor.opposite()
        GameTimerDisplay(
            timeSeconds = if (opponentColor == com.chess99.engine.Color.WHITE) state.whiteTimeSeconds else state.blackTimeSeconds,
            isActive = game.turn == opponentColor && state.gamePhase == MultiplayerPhase.PLAYING,
            playerName = stringResource(
                R.string.game_player_with_rating,
                state.opponentName,
                state.opponentRating,
            ),
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 4.dp),
        )

        // Chess board
        ChessBoardView(
            game = game,
            boardOrientation = state.playerColor,
            isInteractive = isMyTurn,
            lastMoveFrom = state.lastMoveFrom,
            lastMoveTo = state.lastMoveTo,
            arrows = state.cctArrows,
            onMove = onMove,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp),
        )

        AccessibleChessMoveControls(
            game = game,
            isInteractive = isMyTurn && state.isWebSocketConnected,
            onMove = onMove,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
        )

        // Player timer (bottom)
        GameTimerDisplay(
            timeSeconds = if (state.playerColor == com.chess99.engine.Color.WHITE) state.whiteTimeSeconds else state.blackTimeSeconds,
            isActive = game.turn == state.playerColor && state.gamePhase == MultiplayerPhase.PLAYING,
            playerName = stringResource(R.string.game_you_with_rating, state.myRating),
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 4.dp),
        )

        Spacer(modifier = Modifier.height(4.dp))

        // Turn indicator
        if (state.gamePhase == MultiplayerPhase.PLAYING) {
            val turnColor by animateColorAsState(
                targetValue = if (isMyTurn) Color(0xFF4CAF50) else Color(0xFFFF9800),
                label = "turnColor",
            )
            Text(
                text = stringResource(
                    if (isMyTurn) R.string.game_your_turn else R.string.game_opponents_turn
                ),
                color = turnColor,
                fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.bodyMedium,
            )
        }

        // Draw offer banner
        if (state.drawOfferedByOpponent) {
            DrawOfferBanner(
                onAccept = onAcceptDraw,
                onDecline = onDeclineDraw,
            )
        }

        // Undo request banner
        if (state.undoRequestedByOpponent) {
            UndoRequestBanner(
                onAccept = onAcceptUndo,
                onDecline = onDeclineUndo,
            )
        }

        // Game controls
        when (state.gamePhase) {
            MultiplayerPhase.PLAYING -> {
                GameControlsRow(
                    onResign = onResign,
                    onOfferDraw = onOfferDraw,
                    onPause = onPause,
                    drawOfferedByMe = state.drawOfferedByMe,
                    isRated = state.isRated,
                    canRequestUndo = state.canRequestUndo,
                    undoChancesRemaining = state.undoChancesRemaining,
                    undoRequestPending = state.undoRequestPending,
                    onRequestUndo = onRequestUndo,
                    bestMovesOn = bestMovesOn,
                    canUseBestMoves = canUseBestMoves,
                    onToggleBest = onToggleBest,
                    reviewEnabled = reviewEnabled,
                    reviewLoading = reviewLoading,
                    onToggleReview = onToggleReview,
                )
            }

            MultiplayerPhase.PAUSED -> {
                PausedOverlay(
                    resumeRequestSecondsLeft = state.resumeRequestSecondsLeft,
                    onRequestResume = onRequestResume,
                )
            }

            MultiplayerPhase.COMPLETED -> {
                state.gameResult?.let { result ->
                    MultiplayerResultCard(
                        result = result,
                        opponentName = state.opponentName,
                        onBackToLobby = onNavigateBack,
                        onShare = onShare,
                    )
                }
            }

            MultiplayerPhase.CONNECTING -> {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(8.dp),
                ) {
                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(stringResource(R.string.game_connecting), style = MaterialTheme.typography.bodySmall)
                }
            }
        }

        if (reviewLoading || latestReview != null) {
            LiveReviewResultCard(
                result = latestReview,
                loading = reviewLoading,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 4.dp),
            )
        }

        // Move list
        if (state.moveHistory.isNotEmpty()) {
            MultiplayerMoveList(
                moves = state.moveHistory,
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .padding(horizontal = 16.dp),
            )
        }
    }
}

// ── Game Controls ───────────────────────────────────────────────────────

@Composable
private fun GameControlsRow(
    onResign: () -> Unit,
    onOfferDraw: () -> Unit,
    onPause: () -> Unit,
    drawOfferedByMe: Boolean,
    isRated: Boolean,
    canRequestUndo: Boolean,
    undoChancesRemaining: Int,
    undoRequestPending: Boolean,
    onRequestUndo: () -> Unit,
    bestMovesOn: Boolean,
    canUseBestMoves: Boolean,
    onToggleBest: () -> Unit,
    reviewEnabled: Boolean,
    reviewLoading: Boolean,
    onToggleReview: (Boolean) -> Unit,
) {
    var showResignConfirm by remember { mutableStateOf(false) }

    val controlPadding = PaddingValues(horizontal = 8.dp, vertical = 8.dp)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
        // Draw button
        OutlinedButton(
            onClick = onOfferDraw,
            enabled = !drawOfferedByMe,
            contentPadding = controlPadding,
            modifier = Modifier
                .weight(1f)
                .heightIn(min = 48.dp),
        ) {
            Icon(Icons.Default.Handshake, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                stringResource(if (drawOfferedByMe) R.string.game_draw_offered else R.string.action_draw),
                fontSize = 14.sp,
                maxLines = 1,
                softWrap = false,
            )
        }

        // Best moves (casual only) - web parity with GameContainer.js's Best
        // action: toggles the top-3 engine arrows on the board. Hidden in rated
        // games; the ViewModel also refuses the hint level there. Each reveal
        // is paid from the shared takeback pool, so the button locks once the
        // pool is empty and no reveal is currently showing.
        if (!isRated) {
            OutlinedButton(
                onClick = onToggleBest,
                enabled = canUseBestMoves,
                colors = if (bestMovesOn) {
                    ButtonDefaults.outlinedButtonColors(
                        containerColor = MaterialTheme.colorScheme.primaryContainer,
                    )
                } else {
                    ButtonDefaults.outlinedButtonColors()
                },
                contentPadding = controlPadding,
                modifier = Modifier
                    .weight(1f)
                    .heightIn(min = 48.dp),
            ) {
                Icon(Icons.Default.Lightbulb, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text(stringResource(R.string.game_best), fontSize = 14.sp, maxLines = 1, softWrap = false)
            }
        }

        // Pause button (casual only)
        if (!isRated) {
            OutlinedButton(
                onClick = onPause,
                contentPadding = controlPadding,
                modifier = Modifier
                    .weight(1f)
                    .heightIn(min = 48.dp),
            ) {
                Icon(Icons.Default.Pause, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text(stringResource(R.string.action_pause), fontSize = 14.sp, maxLines = 1, softWrap = false)
            }
        }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {

        // Review is a live, post-move alternative check. It is unavailable in
        // rated games, matching the web coaching gate.
        if (!isRated) {
            Surface(
                shape = MaterialTheme.shapes.small,
                color = MaterialTheme.colorScheme.surfaceVariant,
                modifier = Modifier
                    .weight(1f)
                    .heightIn(min = 48.dp),
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(stringResource(R.string.game_review), fontSize = 14.sp, maxLines = 1, softWrap = false)
                    Switch(
                        checked = reviewEnabled,
                        onCheckedChange = onToggleReview,
                        enabled = !reviewLoading,
                    )
                }
            }
        }

        // Takeback - web parity with GameContainer.js's Undo. Hidden entirely in
        // rated games (where it can never be used) rather than shown disabled.
        if (!isRated) {
            OutlinedButton(
                onClick = onRequestUndo,
                enabled = canRequestUndo,
                contentPadding = controlPadding,
                modifier = Modifier
                    .weight(1f)
                    .heightIn(min = 48.dp),
            ) {
                Icon(
                    Icons.AutoMirrored.Filled.Undo,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    if (undoRequestPending) {
                        stringResource(R.string.game_undo_asked)
                    } else {
                        stringResource(R.string.game_undo_count, undoChancesRemaining)
                    },
                    fontSize = 14.sp,
                    maxLines = 1,
                    softWrap = false,
                )
            }
        }

        // Resign button
        OutlinedButton(
            onClick = { showResignConfirm = true },
            colors = ButtonDefaults.outlinedButtonColors(
                contentColor = MaterialTheme.colorScheme.error,
            ),
            contentPadding = controlPadding,
            modifier = Modifier
                .weight(1f)
                .heightIn(min = 48.dp),
        ) {
            Icon(Icons.Default.Flag, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(6.dp))
            Text(stringResource(R.string.action_resign), fontSize = 14.sp, maxLines = 1, softWrap = false)
        }
        }
    }

    if (showResignConfirm) {
        AlertDialog(
            onDismissRequest = { showResignConfirm = false },
            title = { Text(stringResource(R.string.game_resign_title)) },
            text = { Text(stringResource(R.string.game_resign_body)) },
            confirmButton = {
                TextButton(onClick = {
                    showResignConfirm = false
                    onResign()
                }) {
                    Text(stringResource(R.string.action_resign), color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showResignConfirm = false }) { Text(stringResource(R.string.action_cancel)) }
            },
        )
    }
}

// ── Draw Offer Banner ───────────────────────────────────────────────────

@Composable
private fun DrawOfferBanner(onAccept: () -> Unit, onDecline: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer,
        ),
    ) {
        Row(
            modifier = Modifier
                .padding(12.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                stringResource(R.string.game_opponent_offers_draw),
                style = MaterialTheme.typography.bodyMedium,
            )
            Row {
                TextButton(onClick = onAccept) { Text(stringResource(R.string.action_accept)) }
                TextButton(onClick = onDecline) { Text(stringResource(R.string.action_decline)) }
            }
        }
    }
}

// ── Undo Request Banner ─────────────────────────────────────────────────

@Composable
private fun UndoRequestBanner(onAccept: () -> Unit, onDecline: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.tertiaryContainer,
        ),
    ) {
        Row(
            modifier = Modifier
                .padding(12.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                stringResource(R.string.game_opponent_requests_undo),
                style = MaterialTheme.typography.bodyMedium,
            )
            Row {
                TextButton(onClick = onAccept) { Text(stringResource(R.string.action_allow)) }
                TextButton(onClick = onDecline) { Text(stringResource(R.string.action_deny)) }
            }
        }
    }
}

// ── Paused Overlay ──────────────────────────────────────────────────────

@Composable
private fun PausedOverlay(resumeRequestSecondsLeft: Int, onRequestResume: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant,
        ),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Icon(
                Icons.Default.PauseCircle,
                contentDescription = null,
                modifier = Modifier.size(48.dp),
                tint = MaterialTheme.colorScheme.primary,
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                stringResource(R.string.game_paused),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
            Spacer(modifier = Modifier.height(12.dp))
            Button(onClick = onRequestResume, enabled = resumeRequestSecondsLeft == 0) {
                Text(
                    if (resumeRequestSecondsLeft > 0) {
                        stringResource(
                            R.string.game_waiting_for_opponent_seconds,
                            resumeRequestSecondsLeft,
                        )
                    } else {
                        stringResource(R.string.game_request_resume)
                    }
                )
            }
        }
    }
}

// ── Result Card ─────────────────────────────────────────────────────────

@Composable
private fun MultiplayerResultCard(
    result: GameResultState,
    opponentName: String,
    onBackToLobby: () -> Unit,
    onShare: () -> Unit,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = when (result.status) {
                ResultStatus.WON -> MaterialTheme.colorScheme.primaryContainer
                ResultStatus.LOST -> MaterialTheme.colorScheme.errorContainer
                ResultStatus.DRAW -> MaterialTheme.colorScheme.secondaryContainer
            }
        ),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = stringResource(
                    when (result.status) {
                        ResultStatus.WON -> R.string.game_result_victory
                        ResultStatus.LOST -> R.string.game_result_defeat
                        ResultStatus.DRAW -> R.string.game_result_draw
                    }
                ),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = result.details,
                style = MaterialTheme.typography.bodyMedium,
            )
            Text(
                text = stringResource(R.string.game_vs_opponent, opponentName),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(modifier = Modifier.height(8.dp))
            RatingChangeLine(ratingChange = result.ratingChange)
            Spacer(modifier = Modifier.height(12.dp))
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Button(onClick = onBackToLobby) {
                    Text(stringResource(R.string.action_back_to_lobby))
                }
                OutlinedButton(onClick = onShare) {
                    Icon(Icons.Default.Share, contentDescription = null)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(stringResource(R.string.action_share))
                }
            }
        }
    }
}

/**
 * Rating delta shown on the game-over card for a rated game. Mirrors web's
 * RatingChangeDisplay intent: green for a gain, red for a loss, neutral copy
 * when there was no rating movement (casual game / delta not yet available).
 * Uses theme colors only (primary == board green) — kid-safe, no raw numbers
 * dressed up as errors.
 */
@Composable
private fun RatingChangeLine(ratingChange: RatingChangeInfo?) {
    // No row for casual games or while a rated delta is still loading — mirrors
    // web's RatingChangeDisplay returning null when there's nothing to show.
    if (ratingChange == null) return
    val change = ratingChange.change
    val color = when {
        change > 0 -> MaterialTheme.colorScheme.primary
        change < 0 -> MaterialTheme.colorScheme.error
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }
    val label = when {
        change > 0 -> stringResource(R.string.game_rating_gain, change)
        change < 0 -> stringResource(R.string.game_rating_loss, change)
        else -> stringResource(R.string.game_rating_unchanged)
    }
    Text(
        text = label,
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.Bold,
        color = color,
    )
    Text(
        text = stringResource(
            R.string.game_rating_transition,
            ratingChange.oldRating,
            ratingChange.newRating,
        ),
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

// ── Chat Panel ──────────────────────────────────────────────────────────

@Composable
private fun ChatPanel(
    messages: List<ChatMessageData>,
    isGameOver: Boolean,
    isMinor: Boolean,
    policy: ChatPolicy,
    notice: String?,
    reportedMessageIds: Set<Int>,
    onSendMessage: (String) -> Unit,
    onReportMessage: (Int) -> Unit,
    onBlockUser: (Int) -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var messageText by remember { mutableStateOf("") }
    var pendingBlockUserId by remember { mutableStateOf<Int?>(null) }
    val listState = rememberLazyListState()
    val presetOnly = ChatSafetyRules.isPresetOnly(isMinor, policy)

    // Auto-scroll to bottom
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.size - 1)
        }
    }

    Column(modifier = modifier.fillMaxSize()) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                stringResource(R.string.chat_title),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
            IconButton(onClick = onClose) {
                Icon(Icons.Default.Close, stringResource(R.string.a11y_close_chat))
            }
        }

        HorizontalDivider()

        // Messages
        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            state = listState,
        ) {
            if (messages.isEmpty()) {
                item {
                    Text(
                        text = stringResource(R.string.chat_empty),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                        textAlign = TextAlign.Center,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            items(messages, key = { "${it.id}-${it.timestamp}-${it.userId}" }) { msg ->
                ChatBubble(
                    msg = msg,
                    isReported = msg.id in reportedMessageIds,
                    onReport = { onReportMessage(msg.id) },
                    onBlock = { pendingBlockUserId = msg.userId },
                )
                Spacer(modifier = Modifier.height(4.dp))
            }
        }

        val statusNotice = notice ?: if (!policy.enabled) {
            stringResource(ChatSafetyRules.disabledReason(policy.reason))
        } else null
        statusNotice?.let {
            HorizontalDivider()
            Text(
                text = it,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 10.dp),
                style = MaterialTheme.typography.bodySmall,
                color = if (policy.enabled) {
                    MaterialTheme.colorScheme.onSurfaceVariant
                } else {
                    MaterialTheme.colorScheme.error
                },
                textAlign = TextAlign.Center,
            )
        }

        if (!isGameOver && policy.enabled && presetOnly) {
            HorizontalDivider()
            Text(
                text = stringResource(
                    if (isMinor) R.string.chat_choose_kid_safe else R.string.chat_choose_quick
                ),
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                (policy.presetMessages + policy.emojiMessages).forEach { phrase ->
                    AssistChip(
                        onClick = { onSendMessage(phrase) },
                        label = { Text(phrase) },
                    )
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
        } else if (!isGameOver && policy.enabled) {
            HorizontalDivider()
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                OutlinedTextField(
                    value = messageText,
                    onValueChange = { if (it.length <= 500) messageText = it },
                    modifier = Modifier.weight(1f),
                    placeholder = { Text(stringResource(R.string.chat_type_message)) },
                    singleLine = true,
                )
                Spacer(modifier = Modifier.width(8.dp))
                IconButton(
                    onClick = {
                        onSendMessage(messageText)
                        messageText = ""
                    },
                    enabled = messageText.isNotBlank(),
                ) {
                    Icon(Icons.AutoMirrored.Filled.Send, stringResource(R.string.a11y_send))
                }
            }
        }

        pendingBlockUserId?.let { userId ->
            AlertDialog(
                onDismissRequest = { pendingBlockUserId = null },
                title = { Text(stringResource(R.string.chat_block_title)) },
                text = { Text(stringResource(R.string.chat_block_body)) },
                confirmButton = {
                    TextButton(
                        onClick = {
                            onBlockUser(userId)
                            pendingBlockUserId = null
                        }
                    ) { Text(stringResource(R.string.action_block)) }
                },
                dismissButton = {
                    TextButton(onClick = { pendingBlockUserId = null }) { Text(stringResource(R.string.action_cancel)) }
                },
            )
        }
    }
}

@Composable
private fun ChatBubble(
    msg: ChatMessageData,
    isReported: Boolean,
    onReport: () -> Unit,
    onBlock: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = if (msg.isMe) Alignment.End else Alignment.Start,
    ) {
        if (!msg.isMe) {
            Text(
                text = msg.userName,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.primary,
            )
        }
        Surface(
            shape = RoundedCornerShape(12.dp),
            color = if (msg.isMe) MaterialTheme.colorScheme.primaryContainer
            else MaterialTheme.colorScheme.surfaceVariant,
        ) {
            Text(
                text = msg.message,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        if (!msg.isMe) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(
                    onClick = onReport,
                    enabled = msg.id > 0 && !isReported,
                    modifier = Modifier.size(36.dp),
                ) {
                    Icon(
                        Icons.Default.ReportProblem,
                        contentDescription = stringResource(
                            if (isReported) R.string.a11y_message_reported else R.string.a11y_report_message
                        ),
                        modifier = Modifier.size(18.dp),
                    )
                }
                IconButton(
                    onClick = onBlock,
                    enabled = msg.userId > 0,
                    modifier = Modifier.size(36.dp),
                ) {
                    Icon(
                        Icons.Default.Block,
                        contentDescription = stringResource(R.string.a11y_block_player),
                        modifier = Modifier.size(18.dp),
                    )
                }
                if (msg.filtered) {
                    Text(
                        stringResource(R.string.chat_filtered),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

// ── Move List ───────────────────────────────────────────────────────────

@Composable
private fun MultiplayerMoveList(
    moves: List<GameMoveRecord>,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.verticalScroll(rememberScrollState())) {
        Text(
            stringResource(R.string.game_moves),
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
        )
        Spacer(modifier = Modifier.height(4.dp))

        val pairs = moves.chunked(2)
        for ((index, pair) in pairs.withIndex()) {
            Row(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = stringResource(R.string.game_move_number, index + 1),
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.width(32.dp),
                )
                Text(
                    text = pair[0].san,
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.width(64.dp),
                )
                MoveLifelineBadges(pair[0].lifelines)
                if (pair.size > 1) {
                    Text(
                        text = pair[1].san,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.width(64.dp),
                    )
                    MoveLifelineBadges(pair[1].lifelines)
                }
            }
        }
    }
}

@Composable
private fun LiveReviewResultCard(
    result: LiveReviewResult?,
    loading: Boolean,
    modifier: Modifier = Modifier,
) {
    Card(modifier = modifier) {
        Column(modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
            if (loading) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(stringResource(R.string.game_reviewing_move), style = MaterialTheme.typography.bodySmall)
                }
            } else if (result != null) {
                val rankText = result.userMoveRank?.let {
                    stringResource(R.string.game_review_rank, it, result.topMoves.size)
                } ?: stringResource(R.string.game_review_outside_top, result.topMoves.size)
                Text(
                    stringResource(R.string.game_review_header, result.moveNumber, result.san),
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    rankText,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (result.topMoves.isNotEmpty()) {
                    Row(
                        modifier = Modifier.padding(top = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        result.topMoves.forEachIndexed { index, move ->
                            AssistChip(
                                onClick = {},
                                enabled = false,
                                label = {
                                    Text(
                                        stringResource(
                                            R.string.game_review_top_move,
                                            index + 1,
                                            move.san,
                                        ),
                                        fontSize = 11.sp,
                                    )
                                },
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MoveLifelineBadges(markers: List<String>) {
    markers.forEach { marker ->
        Surface(
            shape = RoundedCornerShape(6.dp),
            color = Color(0x2E3FB98F),
            modifier = Modifier.padding(end = 3.dp),
        ) {
            Text(
                stringResource(LifelineMarkers.labelRes(marker)),
                modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp),
                color = Color(0xFF9CE5CA),
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}
