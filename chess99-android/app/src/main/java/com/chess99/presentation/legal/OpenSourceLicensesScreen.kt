package com.chess99.presentation.legal

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri

private const val STOCKFISH_SOURCE_URL =
    "https://github.com/official-stockfish/Stockfish/tree/c3483fa9a7d7c0ffa9fcc32b467ca844cfb63790"

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OpenSourceLicensesScreen(onNavigateBack: () -> Unit) {
    val context = LocalContext.current
    val licenceText = remember {
        context.assets.open("licenses/stockfish-gpl-3.0.txt")
            .bufferedReader()
            .use { it.readText() }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Open-source licences", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(20.dp),
        ) {
            item {
                Text(
                    text = "Stockfish 11",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                )
                Text(
                    text = "Chess99 includes unmodified Stockfish 11 executables. " +
                        "Stockfish is free software licensed under GNU GPL version 3. " +
                        "The exact corresponding source is available at the link below.",
                    modifier = Modifier.padding(top = 8.dp),
                    style = MaterialTheme.typography.bodyMedium,
                )
                TextButton(
                    onClick = {
                        context.startActivity(
                            Intent(Intent.ACTION_VIEW, STOCKFISH_SOURCE_URL.toUri())
                        )
                    },
                    modifier = Modifier.padding(vertical = 8.dp),
                ) {
                    Text("View exact Stockfish source")
                }
                Text(
                    text = licenceText,
                    style = MaterialTheme.typography.bodySmall,
                    fontFamily = FontFamily.Monospace,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
