package com.chess99.engine

/**
 * Detects chess opening from a sequence of SAN moves.
 * Ported from chess-frontend/src/utils/openingDetection.js.
 *
 * Matches the longest opening from the book that aligns with the game's moves.
 * Sorted by length descending so the most specific match wins.
 */

private data class Opening(val moves: List<String>, val name: String)

private val OPENING_BOOK: List<Opening> = listOf(
    Opening(listOf("e4","e5","Nf3","Nc6","Bb5"), "Ruy Lopez"),
    Opening(listOf("e4","e5","Nf3","Nc6","Bc4"), "Italian Game"),
    Opening(listOf("e4","e5","Nf3","Nc6","d4"), "Scotch Game"),
    Opening(listOf("e4","c5","Nf3","d6","d4"), "Sicilian Najdorf"),
    Opening(listOf("e4","c5","Nf3","Nc6","d4"), "Sicilian Open"),
    Opening(listOf("d4","d5","c4","e6","Nc3"), "Queen's Gambit Declined"),
    Opening(listOf("d4","d5","c4","dxc4"), "Queen's Gambit Accepted"),
    Opening(listOf("d4","Nf6","c4","g6","Nc3"), "King's Indian Defense"),
    Opening(listOf("d4","Nf6","c4","e6","Nc3","Bb4"), "Nimzo-Indian Defense"),
    Opening(listOf("e4","e5","Nf3","Nf6"), "Petrov's Defense"),
    Opening(listOf("e4","e5","f4"), "King's Gambit"),
    Opening(listOf("e4","e5","Nc3"), "Vienna Game"),
    Opening(listOf("d4","Nf6","c4","c5"), "Benoni Defense"),
    Opening(listOf("e4","c5"), "Sicilian Defense"),
    Opening(listOf("e4","e6"), "French Defense"),
    Opening(listOf("e4","c6"), "Caro-Kann Defense"),
    Opening(listOf("e4","d5"), "Scandinavian Defense"),
    Opening(listOf("e4","g6"), "Modern Defense"),
    Opening(listOf("e4","d6"), "Pirc Defense"),
    Opening(listOf("e4","Nf6"), "Alekhine's Defense"),
    Opening(listOf("d4","d5","c4"), "Queen's Gambit"),
    Opening(listOf("d4","f5"), "Dutch Defense"),
    Opening(listOf("d4","Nf6","c4","g6"), "King's Indian"),
    Opening(listOf("Nf3","d5","g3"), "King's Indian Attack"),
    Opening(listOf("c4"), "English Opening"),
    Opening(listOf("Nf3"), "Reti Opening"),
    Opening(listOf("e4","e5"), "King's Pawn Game"),
    Opening(listOf("d4","d5"), "Queen's Pawn Game"),
    Opening(listOf("d4","Nf6"), "Indian Defense"),
).sortedByDescending { it.moves.size }

fun detectOpening(sanMoves: List<String>): String? {
    for (opening in OPENING_BOOK) {
        if (opening.moves.size <= sanMoves.size &&
            opening.moves.indices.all { i -> sanMoves[i] == opening.moves[i] }
        ) {
            return opening.name
        }
    }
    return null
}
