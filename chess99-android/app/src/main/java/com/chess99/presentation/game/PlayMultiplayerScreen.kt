package com.chess99.presentation.game

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
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
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.chess99.engine.ChessGame
import com.chess99.presentation.common.ChessBoardView
import com.chess99.presentation.common.GameCompletionAnimation
import com.chess99.presentation.common.GameNavigationWarningDialog
import com.chess99.presentation.common.GameTimerDisplay

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
    val snackbarHostState = remember { SnackbarHostState() }
    var showNavigationWarning by remember { mutableStateOf(false) }
    var showCompletionAnimation by remember { mutableStateOf(false) }

    // Show completion animation when game ends
    LaunchedEffect(state.gamePhase) {
        if (state.gamePhase == MultiplayerPhase.COMPLETED && state.gameResult != null) {
            showCompletionAnimation = true
        }
    }

    // Navigation warning for back press during active game
    if (showNavigationWarning) {
        GameNavigationWarningDialog(
            isRated = state.isRated,
            onLeave = {
                showNavigationWarning = false
                onNavigateBack()
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
                        Text("Game #${state.gameId}", style = MaterialTheme.typography.titleMedium)
                        Text(
                            text = buildString {
                                append(if (state.isRated) "Rated" else "Casual")
                                append(" \u2022 ${state.timeControl}")
                            },
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
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
                actions = {
                    // Chat toggle
                    BadgedBox(
                        badge = {
                            if (state.unreadChatCount > 0) {
                                Badge { Text("${state.unreadChatCount}") }
                            }
                        }
                    ) {
                        IconButton(onClick = { viewModel.toggleChat() }) {
                            Icon(Icons.AutoMirrored.Filled.Chat, "Chat")
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
                        Text("Loading game...")
                    }
                }
            }

            state.isChatOpen -> {
                ChatPanel(
                    messages = state.chatMessages,
                    isGameOver = state.gamePhase == MultiplayerPhase.COMPLETED,
                    onSendMessage = { viewModel.sendChat(it) },
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
                    onAcceptUndo = { viewModel.acceptUndo() },
                    onDeclineUndo = { viewModel.declineUndo() },
                    onPause = { viewModel.pauseGame() },
                    onRequestResume = { viewModel.requestResumeGame() },
                    onNavigateBack = onNavigateBack,
                )
            }
        }

        // Error dialog
        state.error?.let { error ->
            AlertDialog(
                onDismissRequest = { viewModel.clearError() },
                title = { Text("Error") },
                text = { Text(error) },
                confirmButton = {
                    TextButton(onClick = { viewModel.clearError() }) { Text("OK") }
                },
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
    onAcceptUndo: () -> Unit,
    onDeclineUndo: () -> Unit,
    onPause: () -> Unit,
    onRequestResume: () -> Unit,
    onNavigateBack: () -> Unit,
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
            playerName = "${state.opponentName} (${state.opponentRating})",
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
            onMove = onMove,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp),
        )

        // Player timer (bottom)
        GameTimerDisplay(
            timeSeconds = if (state.playerColor == com.chess99.engine.Color.WHITE) state.whiteTimeSeconds else state.blackTimeSeconds,
            isActive = game.turn == state.playerColor && state.gamePhase == MultiplayerPhase.PLAYING,
            playerName = "You (${state.myRating})",
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
                text = if (isMyTurn) "Your turn" else "Opponent's turn",
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
                )
            }

            MultiplayerPhase.PAUSED -> {
                PausedOverlay(onRequestResume = onRequestResume)
            }

            MultiplayerPhase.COMPLETED -> {
                state.gameResult?.let { result ->
                    MultiplayerResultCard(
                        result = result,
                        opponentName = state.opponentName,
                        onBackToLobby = onNavigateBack,
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
                    Text("Connecting...", style = MaterialTheme.typography.bodySmall)
                }
            }
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
) {
    var showResignConfirm by remember { mutableStateOf(false) }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceEvenly,
    ) {
        // Draw button
        OutlinedButton(
            onClick = onOfferDraw,
            enabled = !drawOfferedByMe,
            modifier = Modifier.weight(1f),
        ) {
            Icon(Icons.Default.Handshake, contentDescription = null, modifier = Modifier.size(16.dp))
            Spacer(modifier = Modifier.width(4.dp))
            Text(if (drawOfferedByMe) "Offered" else "Draw", fontSize = 12.sp)
        }

        Spacer(modifier = Modifier.width(8.dp))

        // Pause button (casual only)
        if (!isRated) {
            OutlinedButton(
                onClick = onPause,
                modifier = Modifier.weight(1f),
            ) {
                Icon(Icons.Default.Pause, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Pause", fontSize = 12.sp)
            }
            Spacer(modifier = Modifier.width(8.dp))
        }

        // Resign button
        OutlinedButton(
            onClick = { showResignConfirm = true },
            colors = ButtonDefaults.outlinedButtonColors(
                contentColor = MaterialTheme.colorScheme.error,
            ),
            modifier = Modifier.weight(1f),
        ) {
            Icon(Icons.Default.Flag, contentDescription = null, modifier = Modifier.size(16.dp))
            Spacer(modifier = Modifier.width(4.dp))
            Text("Resign", fontSize = 12.sp)
        }
    }

    if (showResignConfirm) {
        AlertDialog(
            onDismissRequest = { showResignConfirm = false },
            title = { Text("Resign Game?") },
            text = { Text("Are you sure you want to resign? This will count as a loss.") },
            confirmButton = {
                TextButton(onClick = {
                    showResignConfirm = false
                    onResign()
                }) {
                    Text("Resign", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showResignConfirm = false }) { Text("Cancel") }
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
            Text("Opponent offers a draw", style = MaterialTheme.typography.bodyMedium)
            Row {
                TextButton(onClick = onAccept) { Text("Accept") }
                TextButton(onClick = onDecline) { Text("Decline") }
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
            Text("Opponent requests undo", style = MaterialTheme.typography.bodyMedium)
            Row {
                TextButton(onClick = onAccept) { Text("Allow") }
                TextButton(onClick = onDecline) { Text("Deny") }
            }
        }
    }
}

// ── Paused Overlay ──────────────────────────────────────────────────────

@Composable
private fun PausedOverlay(onRequestResume: () -> Unit) {
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
            Text("Game Paused", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(12.dp))
            Button(onClick = onRequestResume) {
                Text("Request Resume")
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
                text = when (result.status) {
                    ResultStatus.WON -> "Victory!"
                    ResultStatus.LOST -> "Defeat"
                    ResultStatus.DRAW -> "Draw"
                },
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = result.details,
                style = MaterialTheme.typography.bodyMedium,
            )
            Text(
                text = "vs $opponentName",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(modifier = Modifier.height(12.dp))
            Button(onClick = onBackToLobby) {
                Text("Back to Lobby")
            }
        }
    }
}

// ── Chat Panel ──────────────────────────────────────────────────────────

@Composable
private fun ChatPanel(
    messages: List<ChatMessageData>,
    isGameOver: Boolean,
    onSendMessage: (String) -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var messageText by remember { mutableStateOf("") }
    val listState = rememberLazyListState()

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
            Text("Chat", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            IconButton(onClick = onClose) {
                Icon(Icons.Default.Close, "Close chat")
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
                        text = "No messages yet. Say hi!",
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                        textAlign = TextAlign.Center,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            items(messages) { msg ->
                ChatBubble(msg)
                Spacer(modifier = Modifier.height(4.dp))
            }
        }

        // Input
        if (!isGameOver) {
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
                    placeholder = { Text("Type a message...") },
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
                    Icon(Icons.AutoMirrored.Filled.Send, "Send")
                }
            }
        }
    }
}

@Composable
private fun ChatBubble(msg: ChatMessageData) {
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
    }
}

// ── Move List ───────────────────────────────────────────────────────────

@Composable
private fun MultiplayerMoveList(
    moves: List<GameMoveRecord>,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.verticalScroll(rememberScrollState())) {
        Text("Moves", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(4.dp))

        val pairs = moves.chunked(2)
        for ((index, pair) in pairs.withIndex()) {
            Row(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "${index + 1}.",
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.width(32.dp),
                )
                Text(
                    text = pair[0].san,
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.width(64.dp),
                )
                if (pair.size > 1) {
                    Text(
                        text = pair[1].san,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.width(64.dp),
                    )
                }
            }
        }
    }
}
