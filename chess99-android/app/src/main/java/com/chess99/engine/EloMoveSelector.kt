package com.chess99.engine

import kotlin.math.exp
import kotlin.math.max
import kotlin.math.min
import kotlin.random.Random

/**
 * ELO-faithful move selector — Kotlin port of the web frontend's
 * `selectMoveWithCpBudget` (chess-frontend/src/utils/computerMoveUtils.js).
 *
 * Given the ranked MultiPV list Stockfish already returns (each with a centipawn
 * score from the side-to-move's perspective, best first), it picks a move whose
 * strength matches the target ELO — a centipawn-loss budget + softmax weighting
 * + probabilistic blunder injection with opening protection — instead of the old
 * rank-bucket lottery that ignored ELO entirely.
 *
 * Web parity note: web additionally has a dedicated sub-1300 human-plausibility
 * model (sub1300Stockfish.js). This port uses the cp-budget model across all
 * ELOs; at low ELO its wide budget + high blunder rate already produce weak,
 * mistake-prone play. Porting the sub-1300 per-anchor refinement is a follow-up.
 */
object EloMoveSelector {

    // COMPUTER_LEVEL_RATINGS (eloUtils.js) — engine level (1-16) → ELO fallback,
    // used when no explicit synthetic-player rating is supplied.
    private val COMPUTER_LEVEL_RATINGS = mapOf(
        1 to 400, 2 to 600, 3 to 800, 4 to 1000, 5 to 1200, 6 to 1400,
        7 to 1600, 8 to 1800, 9 to 2000, 10 to 2200, 11 to 2400, 12 to 2600,
        13 to 2750, 14 to 2900, 15 to 3050, 16 to 3200,
    )

    /** Derive the target ELO exactly like web's makeComputerMove. */
    fun resolveTargetElo(depth: Int, rating: Int?): Int =
        if (rating != null && rating > 0) rating
        else COMPUTER_LEVEL_RATINGS[depth.coerceIn(1, 16)] ?: 1500

    /**
     * Convert a RankedMove to "cp from side-to-move". Stockfish reports mate as a
     * distance; web converts mate → large cp so the arithmetic still orders moves
     * (mate-in-1 beats mate-in-3, and mate beats any normal eval).
     */
    private fun RankedMove.effectiveCp(): Int =
        if (isMate) { if (score > 0) 9999 - score else -9999 - score } else score

    /**
     * Pick a UCI move matching [targetElo] from the ranked MultiPV list.
     * @param halfMoveCount half-moves played so far (drives the opening blunder ramp).
     * @return a UCI string, or null if [rankedMoves] is empty (caller falls back).
     */
    fun select(
        rankedMoves: List<RankedMove>,
        targetElo: Int,
        halfMoveCount: Int,
        rng: Random = Random.Default,
    ): String? {
        if (rankedMoves.isEmpty()) return null
        val sorted = rankedMoves.sortedBy { it.rank }
        if (sorted.size == 1) return sorted[0].uci

        val bestCp = sorted[0].effectiveCp()
        // cpLoss = how much worse than the best move (always >= 0).
        val cpLosses = sorted.map { max(0, bestCp - it.effectiveCp()) }

        // ── Normal-play budget & temperature ──
        val maxCpLoss = max(5.0, min(250.0, (3500.0 - targetElo) / 16.0))
        // Softmax temperature: lower = more concentrated on the best move (high ELO).
        val temperature = max(5.0, (3000.0 - targetElo) / 80.0)

        // ── Blunder injection ──
        val baseBlunderP = max(0.0, (2800.0 - targetElo) / 12000.0)
        val fullMoveNum = halfMoveCount / 2 + 1
        // Opening protected until move 6; ramps to full probability by move 18.
        val phase = max(0.0, min(1.0, (fullMoveNum - 6).toDouble() / 12.0))
        val blunderP = baseBlunderP * (0.05 + 0.95 * phase)
        // Severity: higher ELO makes smaller mistakes when it errs.
        val maxBlunderCp = max(100.0, min(350.0, 120.0 + (2400 - targetElo) * 0.22))
        val minBlunderCp = 30.0

        if (rng.nextDouble() < blunderP) {
            val blunderIdx = sorted.indices.filter {
                cpLosses[it] >= minBlunderCp && cpLosses[it] <= maxBlunderCp
            }
            if (blunderIdx.isNotEmpty()) {
                return sorted[blunderIdx[rng.nextInt(blunderIdx.size)]].uci
            }
            // No suitable candidate in range → fall through to normal play.
        }

        // ── Normal play: softmax-weighted selection over moves within budget ──
        val normalIdx = sorted.indices.filter { cpLosses[it] <= maxCpLoss }
        if (normalIdx.isEmpty()) return sorted[0].uci // forced/critical: play best

        val weights = normalIdx.map { exp(-cpLosses[it] / temperature) }
        val total = weights.sum()
        var r = rng.nextDouble() * total
        for (i in normalIdx.indices) {
            r -= weights[i]
            if (r <= 0) return sorted[normalIdx[i]].uci
        }
        return sorted[normalIdx.last()].uci
    }
}
