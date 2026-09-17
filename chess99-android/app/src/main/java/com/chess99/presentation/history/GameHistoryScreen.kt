package com.chess99.presentation.history

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.*
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringArrayResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.chess99.R
import com.chess99.engine.ChessGame
import com.chess99.presentation.common.ChessBoardView

/**
 * Game History screen showing paginated list of completed games
 * with filters, search, and inline game replay.
 *
 * Mirrors chess-frontend/src/pages/HistoryPage.js behavior.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GameHistoryScreen(
    onNavigateBack: () -> Unit,
    onNavigateToReview: ((gameId: Int) -> Unit)? = null,
    viewModel: GameHistoryViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    // Resolved here because the copy-PGN callback below is a plain lambda, not
    // a composable scope.
    val pgnCopiedMessage = stringResource(R.string.history_pgn_copied)

    var showSnackbar by remember { mutableStateOf(false) }
    var snackbarMessage by remember { mutableStateOf("") }
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(showSnackbar) {
        if (showSnackbar) {
            snackbarHostState.showSnackbar(snackbarMessage)
            showSnackbar = false
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.history_title)) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.action_back),
                        )
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            // Search bar
            SearchBar(
                query = state.searchQuery,
                onQueryChange = { viewModel.setSearchQuery(it) },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
            )

            // Filter chips
            FilterChipsRow(
                state = state,
                onResultFilter = { viewModel.setResultFilter(it) },
                onColorFilter = { viewModel.setColorFilter(it) },
                onModeFilter = { viewModel.setModeFilter(it) },
                modifier = Modifier.padding(horizontal = 16.dp),
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Content
            when {
                state.isLoading -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator()
                    }
                }
                state.error != null && state.filteredGames.isEmpty() -> {
                    ErrorContent(
                        error = state.error!!,
                        onRetry = { viewModel.loadGames(reset = true) },
                        modifier = Modifier.fillMaxSize(),
                    )
                }
                state.filteredGames.isEmpty() -> {
                    EmptyContent(
                        hasFilters = state.resultFilter != ResultFilter.ALL ||
                                state.colorFilter != ColorFilter.ALL ||
                                state.modeFilter != ModeFilter.ALL ||
                                state.searchQuery.isNotBlank(),
                        modifier = Modifier.fillMaxSize(),
                    )
                }
                else -> {
                    GameList(
                        games = state.filteredGames,
                        expandedGameId = state.expandedGameId,
                        replayState = state.replayState,
                        isLoadingMore = state.isLoadingMore,
                        hasMorePages = state.hasMorePages,
                        onGameClick = { viewModel.selectGame(it.id) },
                        onLoadMore = { viewModel.loadMore() },
                        onNavigateToReview = onNavigateToReview,
                        onFirstMove = { viewModel.goToFirstMove() },
                        onPrevMove = { viewModel.goToPreviousMove() },
                        onNextMove = { viewModel.goToNextMove() },
                        onLastMove = { viewModel.goToLastMove() },
                        onMoveClick = { viewModel.goToMove(it) },
                        onToggleAutoPlay = { viewModel.toggleAutoPlay() },
                        onCopyPgn = {
                            val pgn = viewModel.generatePgn()
                            if (pgn.isNotBlank()) {
                                val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE)
                                        as ClipboardManager
                                val clip = ClipData.newPlainText(
                                    context.getString(R.string.history_pgn_clip_label),
                                    pgn,
                                )
                                clipboard.setPrimaryClip(clip)
                                snackbarMessage = pgnCopiedMessage
                                showSnackbar = true
                            }
                        },
                        modifier = Modifier.fillMaxSize(),
                    )
                }
            }
        }

        // Error dialog
        state.error?.let { error ->
            if (state.filteredGames.isNotEmpty()) {
                LaunchedEffect(error) {
                    snackbarHostState.showSnackbar(error)
                    viewModel.clearError()
                }
            }
        }
    }
}

// ── Search Bar ────────────────────────────────────────────────────────

@Composable
private fun SearchBar(
    query: String,
    onQueryChange: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    OutlinedTextField(
        value = query,
        onValueChange = onQueryChange,
        placeholder = { Text(stringResource(R.string.history_search_placeholder)) },
        leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
        trailingIcon = {
            if (query.isNotBlank()) {
                IconButton(onClick = { onQueryChange("") }) {
                    Icon(Icons.Default.Clear, contentDescription = stringResource(R.string.a11y_clear_search))
                }
            }
        },
        singleLine = true,
        modifier = modifier,
    )
}

// ── Filter Chips ──────────────────────────────────────────────────────

@Composable
private fun FilterChipsRow(
    state: GameHistoryUiState,
    onResultFilter: (ResultFilter) -> Unit,
    onColorFilter: (ColorFilter) -> Unit,
    onModeFilter: (ModeFilter) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        // Result filters
        ResultFilter.entries.forEach { filter ->
            FilterChip(
                selected = state.resultFilter == filter,
                onClick = { onResultFilter(filter) },
                label = {
                    Text(
                        stringResource(
                            when (filter) {
                                ResultFilter.ALL -> R.string.history_filter_all_results
                                ResultFilter.WON -> R.string.history_result_won
                                ResultFilter.LOST -> R.string.history_result_lost
                                ResultFilter.DRAW -> R.string.history_result_draw
                            }
                        )
                    )
                },
                leadingIcon = if (state.resultFilter == filter) {
                    { Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(18.dp)) }
                } else null,
            )
        }

        Spacer(modifier = Modifier.width(4.dp))

        // Color filters
        ColorFilter.entries.forEach { filter ->
            FilterChip(
                selected = state.colorFilter == filter,
                onClick = { onColorFilter(filter) },
                label = {
                    Text(
                        stringResource(
                            when (filter) {
                                ColorFilter.ALL -> R.string.history_filter_all_colors
                                ColorFilter.WHITE -> R.string.color_white
                                ColorFilter.BLACK -> R.string.color_black
                            }
                        )
                    )
                },
                leadingIcon = if (state.colorFilter == filter) {
                    { Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(18.dp)) }
                } else null,
            )
        }

        Spacer(modifier = Modifier.width(4.dp))

        // Mode filters
        ModeFilter.entries.forEach { filter ->
            FilterChip(
                selected = state.modeFilter == filter,
                onClick = { onModeFilter(filter) },
                label = {
                    Text(
                        stringResource(
                            when (filter) {
                                ModeFilter.ALL -> R.string.history_filter_all_modes
                                ModeFilter.CASUAL -> R.string.mode_casual
                                ModeFilter.RATED -> R.string.mode_rated
                            }
                        )
                    )
                },
                leadingIcon = if (state.modeFilter == filter) {
                    { Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(18.dp)) }
                } else null,
            )
        }
    }
}

// ── Game List ─────────────────────────────────────────────────────────

@Composable
private fun GameList(
    games: List<GameSummary>,
    expandedGameId: Int?,
    replayState: ReplayState?,
    isLoadingMore: Boolean,
    hasMorePages: Boolean,
    onGameClick: (GameSummary) -> Unit,
    onLoadMore: () -> Unit,
    onNavigateToReview: ((gameId: Int) -> Unit)?,
    onFirstMove: () -> Unit,
    onPrevMove: () -> Unit,
    onNextMove: () -> Unit,
    onLastMove: () -> Unit,
    onMoveClick: (Int) -> Unit,
    onToggleAutoPlay: () -> Unit,
    onCopyPgn: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val listState = rememberLazyListState()

    LazyColumn(
        state = listState,
        modifier = modifier,
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(games, key = { it.id }) { game ->
            GameCard(
                game = game,
                isExpanded = game.id == expandedGameId,
                replayState = if (game.id == expandedGameId) replayState else null,
                onClick = { onGameClick(game) },
                onNavigateToReview = onNavigateToReview,
                onFirstMove = onFirstMove,
                onPrevMove = onPrevMove,
                onNextMove = onNextMove,
                onLastMove = onLastMove,
                onMoveClick = onMoveClick,
                onToggleAutoPlay = onToggleAutoPlay,
                onCopyPgn = onCopyPgn,
            )
        }

        // Load more
        if (hasMorePages) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    if (isLoadingMore) {
                        CircularProgressIndicator(modifier = Modifier.size(32.dp))
                    } else {
                        OutlinedButton(onClick = onLoadMore) {
                            Text(stringResource(R.string.history_load_more))
                        }
                    }
                }
            }
        }
    }
}

// ── Game Card ─────────────────────────────────────────────────────────

@Composable
private fun GameCard(
    game: GameSummary,
    isExpanded: Boolean,
    replayState: ReplayState?,
    onClick: () -> Unit,
    onNavigateToReview: ((gameId: Int) -> Unit)?,
    onFirstMove: () -> Unit,
    onPrevMove: () -> Unit,
    onNextMove: () -> Unit,
    onLastMove: () -> Unit,
    onMoveClick: (Int) -> Unit,
    onToggleAutoPlay: () -> Unit,
    onCopyPgn: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = when (game.result) {
                GameResult.WON -> MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
                GameResult.LOST -> MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f)
                GameResult.DRAW -> MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.3f)
            }
        ),
    ) {
        Column {
            // Game summary row (always visible)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onClick)
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // Result icon
                ResultIcon(result = game.result)

                Spacer(modifier = Modifier.width(12.dp))

                // Game info
                Column(modifier = Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = game.opponentName,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f, fill = false),
                        )
                        if (game.opponentRating > 0) {
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = stringResource(
                                    R.string.history_opponent_rating,
                                    game.opponentRating,
                                ),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(2.dp))

                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        // Color indicator
                        Text(
                            text = if (game.playerColor == "white") "\u2654" else "\u265A",
                            style = MaterialTheme.typography.bodySmall,
                        )

                        // Time control
                        if (game.timeControl.isNotBlank()) {
                            Text(
                                text = game.timeControl,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }

                        // Game mode badge
                        if (game.gameMode == "rated") {
                            SuggestionChip(
                                onClick = {},
                                label = {
                                    Text(
                                        stringResource(R.string.mode_rated),
                                        style = MaterialTheme.typography.labelSmall,
                                    )
                                },
                                modifier = Modifier.height(24.dp),
                            )
                        }

                        // Date
                        Text(
                            text = formatDate(game.playedAt),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }

                Spacer(modifier = Modifier.width(8.dp))

                // Rating change
                if (game.ratingChange != 0) {
                    RatingChangeBadge(change = game.ratingChange)
                }

                // Expand indicator
                Icon(
                    imageVector = if (isExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                    contentDescription = stringResource(
                        if (isExpanded) R.string.a11y_collapse else R.string.a11y_expand
                    ),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            // Expanded replay section
            AnimatedVisibility(
                visible = isExpanded,
                enter = expandVertically(),
                exit = shrinkVertically(),
            ) {
                if (replayState != null) {
                    ReplayContent(
                        game = game,
                        replayState = replayState,
                        onNavigateToReview = onNavigateToReview,
                        onFirstMove = onFirstMove,
                        onPrevMove = onPrevMove,
                        onNextMove = onNextMove,
                        onLastMove = onLastMove,
                        onMoveClick = onMoveClick,
                        onToggleAutoPlay = onToggleAutoPlay,
                        onCopyPgn = onCopyPgn,
                        modifier = Modifier.padding(
                            start = 16.dp,
                            end = 16.dp,
                            bottom = 16.dp,
                        ),
                    )
                }
            }
        }
    }
}

// ── Result Icon ───────────────────────────────────────────────────────

@Composable
private fun ResultIcon(result: GameResult) {
    val (icon, color) = when (result) {
        GameResult.WON -> Icons.Default.CheckCircle to Color(0xFF4CAF50)
        GameResult.LOST -> Icons.Default.Cancel to Color(0xFFF44336)
        GameResult.DRAW -> Icons.Default.RemoveCircle to Color(0xFFFFC107)
    }
    val description = stringResource(
        when (result) {
            GameResult.WON -> R.string.history_result_won
            GameResult.LOST -> R.string.history_result_lost
            GameResult.DRAW -> R.string.history_result_draw
        }
    )
    Icon(
        imageVector = icon,
        contentDescription = description,
        tint = color,
        modifier = Modifier.size(32.dp),
    )
}

// ── Rating Change Badge ───────────────────────────────────────────────

@Composable
private fun RatingChangeBadge(change: Int) {
    val color = when {
        change > 0 -> Color(0xFF4CAF50)
        change < 0 -> Color(0xFFF44336)
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }
    val text = when {
        change > 0 -> "+$change"
        else -> "$change"
    }
    Text(
        text = text,
        style = MaterialTheme.typography.titleSmall,
        fontWeight = FontWeight.Bold,
        color = color,
    )
}

// ── Replay Content ────────────────────────────────────────────────────

@Composable
fun ReplayContent(
    game: GameSummary?,
    replayState: ReplayState,
    modifier: Modifier = Modifier,
    onNavigateToReview: ((gameId: Int) -> Unit)? = null,
    onFirstMove: () -> Unit,
    onPrevMove: () -> Unit,
    onNextMove: () -> Unit,
    onLastMove: () -> Unit,
    onMoveClick: (Int) -> Unit,
    onToggleAutoPlay: () -> Unit,
    onCopyPgn: () -> Unit,
) {
    Column(modifier = modifier) {
        if (replayState.isLoadingMoves) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(200.dp),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator(modifier = Modifier.size(32.dp))
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        stringResource(R.string.history_loading_moves),
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
            return
        }

        if (replayState.error != null) {
            Text(
                text = replayState.error,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(vertical = 8.dp),
            )
            return
        }

        if (replayState.moves.isEmpty()) {
            Text(
                text = stringResource(R.string.history_no_moves),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(vertical = 8.dp),
            )
            return
        }

        HorizontalDivider(modifier = Modifier.padding(bottom = 12.dp))

        // Chess board (non-interactive replay)
        val boardGame = remember(replayState.currentFen) {
            ChessGame(replayState.currentFen)
        }
        val boardOrientation = if (game?.playerColor == "black") {
            com.chess99.engine.Color.BLACK
        } else {
            com.chess99.engine.Color.WHITE
        }

        ChessBoardView(
            game = boardGame,
            boardOrientation = boardOrientation,
            isInteractive = false,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
        )

        Spacer(modifier = Modifier.height(8.dp))

        // Move counter
        Text(
            text = stringResource(
                R.string.history_move_counter,
                replayState.currentMoveIndex + 1,
                replayState.moves.size,
            ),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )

        Spacer(modifier = Modifier.height(8.dp))

        // Navigation controls
        ReplayControls(
            replayState = replayState,
            onFirstMove = onFirstMove,
            onPrevMove = onPrevMove,
            onNextMove = onNextMove,
            onLastMove = onLastMove,
            onToggleAutoPlay = onToggleAutoPlay,
            modifier = Modifier.fillMaxWidth(),
        )

        Spacer(modifier = Modifier.height(8.dp))

        // Move list
        ReplayMoveList(
            moves = replayState.moves,
            currentMoveIndex = replayState.currentMoveIndex,
            onMoveClick = onMoveClick,
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(max = 150.dp),
        )

        Spacer(modifier = Modifier.height(8.dp))

        // Action buttons
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            // PGN export button
            OutlinedButton(
                onClick = onCopyPgn,
                modifier = Modifier.weight(1f),
            ) {
                Icon(
                    Icons.Default.ContentCopy,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(stringResource(R.string.history_copy_pgn))
            }

            // Full review button
            if (onNavigateToReview != null && game != null) {
                Button(
                    onClick = { onNavigateToReview(game.id) },
                    modifier = Modifier.weight(1f),
                ) {
                    Icon(
                        Icons.Default.OpenInFull,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp),
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(stringResource(R.string.history_full_review))
                }
            }
        }
    }
}

// ── Replay Controls ───────────────────────────────────────────────────

@Composable
internal fun ReplayControls(
    replayState: ReplayState,
    onFirstMove: () -> Unit,
    onPrevMove: () -> Unit,
    onNextMove: () -> Unit,
    onLastMove: () -> Unit,
    onToggleAutoPlay: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // First move |<
        IconButton(
            onClick = onFirstMove,
            enabled = replayState.currentMoveIndex > -1,
        ) {
            Icon(Icons.Default.SkipPrevious, contentDescription = stringResource(R.string.a11y_first_move))
        }

        // Previous move <
        IconButton(
            onClick = onPrevMove,
            enabled = replayState.currentMoveIndex > -1,
        ) {
            Icon(
                Icons.AutoMirrored.Filled.NavigateBefore,
                contentDescription = stringResource(R.string.a11y_previous_move),
            )
        }

        // Auto-play toggle
        FilledTonalIconButton(
            onClick = onToggleAutoPlay,
            enabled = replayState.moves.isNotEmpty(),
        ) {
            Icon(
                imageVector = if (replayState.isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                contentDescription = stringResource(
                    if (replayState.isPlaying) R.string.action_pause else R.string.a11y_auto_play
                ),
            )
        }

        // Next move >
        IconButton(
            onClick = onNextMove,
            enabled = replayState.currentMoveIndex < replayState.moves.size - 1,
        ) {
            Icon(
                Icons.AutoMirrored.Filled.NavigateNext,
                contentDescription = stringResource(R.string.a11y_next_move),
            )
        }

        // Last move >|
        IconButton(
            onClick = onLastMove,
            enabled = replayState.currentMoveIndex < replayState.moves.size - 1,
        ) {
            Icon(Icons.Default.SkipNext, contentDescription = stringResource(R.string.a11y_last_move))
        }
    }
}

// ── Replay Move List ──────────────────────────────────────────────────

@Composable
private fun ReplayMoveList(
    moves: List<ReplayMove>,
    currentMoveIndex: Int,
    onMoveClick: (Int) -> Unit,
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
        for ((pairIndex, pair) in pairs.withIndex()) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // Move number
                Text(
                    text = stringResource(R.string.game_move_number, pairIndex + 1),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.width(32.dp),
                )

                // White move
                val whiteIndex = pairIndex * 2
                MoveChip(
                    san = pair[0].san,
                    isSelected = currentMoveIndex == whiteIndex,
                    onClick = { onMoveClick(whiteIndex) },
                    modifier = Modifier.width(72.dp),
                )

                // Black move
                if (pair.size > 1) {
                    val blackIndex = pairIndex * 2 + 1
                    MoveChip(
                        san = pair[1].san,
                        isSelected = currentMoveIndex == blackIndex,
                        onClick = { onMoveClick(blackIndex) },
                        modifier = Modifier.width(72.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun MoveChip(
    san: String,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        onClick = onClick,
        shape = MaterialTheme.shapes.small,
        color = if (isSelected) {
            MaterialTheme.colorScheme.primaryContainer
        } else {
            Color.Transparent
        },
        modifier = modifier.padding(vertical = 1.dp),
    ) {
        Text(
            text = san,
            style = MaterialTheme.typography.bodySmall,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
            color = if (isSelected) {
                MaterialTheme.colorScheme.onPrimaryContainer
            } else {
                MaterialTheme.colorScheme.onSurface
            },
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
        )
    }
}

// ── Empty & Error Content ─────────────────────────────────────────────

@Composable
private fun EmptyContent(
    hasFilters: Boolean,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier,
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(
                Icons.Default.SportsEsports,
                contentDescription = null,
                modifier = Modifier.size(64.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = stringResource(
                    if (hasFilters) R.string.history_empty_filtered_title
                    else R.string.history_empty_title
                ),
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = stringResource(
                    if (hasFilters) R.string.history_empty_filtered_body
                    else R.string.history_empty_body
                ),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun ErrorContent(
    error: String,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier,
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(
                Icons.Default.ErrorOutline,
                contentDescription = null,
                modifier = Modifier.size(64.dp),
                tint = MaterialTheme.colorScheme.error,
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = error,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.error,
                textAlign = TextAlign.Center,
            )
            Spacer(modifier = Modifier.height(16.dp))
            Button(onClick = onRetry) {
                Text(stringResource(R.string.action_retry))
            }
        }
    }
}

// ── Helpers ───────────────────────────────────────────────────────────

@Composable
private fun formatDate(dateStr: String): String {
    if (dateStr.isBlank()) return ""
    val months = stringArrayResource(R.array.month_abbreviations)
    // Parse ISO date and format for display.
    // Input: "2026-02-24T10:30:00.000000Z" or "2026-02-24 10:30:00".
    // No try/catch here: Compose forbids one around composable calls, and every
    // step below is already total (take/split/toIntOrNull never throw).
    val datePart = dateStr.take(10) // "2026-02-24"
    val parts = datePart.split("-")
    if (parts.size != 3) return datePart
    val month = parts[1].toIntOrNull()
        ?.takeIf { it in 1..12 }
        ?.let { months[it - 1] }
        ?: parts[1]
    return stringResource(R.string.history_date, parts[2].trimStart('0'), month, parts[0])
}
