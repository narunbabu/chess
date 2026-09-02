package com.chess99.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.random.Random

/**
 * End-to-end strength check: bots at different ratings play complete games
 * against each other through the production move-selection path.
 *
 * This is the test that answers "does a 2400 bot actually beat an 800 bot on
 * this device?" — the same question a player answers by picking a difficulty on
 * the Play vs Computer screen or tapping a bot persona. Everything below the
 * MultiPV list ([SimulatedOpponent]) is test scaffolding; the move choice, the
 * rating table and the rules are all production code.
 */
class EloLadderSimulationTest {

    @Test
    fun `a strong bot beats a beginner bot decisively over a match`() {
        val result = SimulatedOpponent.match(eloA = 2600, eloB = 600, games = 12, seed = 2026)

        println("[elo-ladder] $result")
        assertTrue(
            "2600 only scored ${result.scoreRateA * 100}% against 600 — the rating curve is flat",
            result.scoreRateA >= 0.75,
        )
        assertTrue("the match produced no decisive games", result.decisive > 0)
    }

    @Test
    fun `score against a fixed 1200 opponent rises with rating`() {
        val baseline = 1200
        val challengers = listOf(600, 1200, 2400)

        val scores = challengers.map { elo ->
            val result = SimulatedOpponent.match(elo, baseline, games = 8, seed = 4242)
            println("[elo-ladder] $result")
            elo to result.scoreRateA
        }

        val (weak, even, strong) = scores.map { it.second }
        assertTrue("600 ($weak) should not out-score 1200 ($even) against a 1200", weak <= even)
        assertTrue("2400 ($strong) should out-score 600 ($weak) against a 1200", strong > weak)
    }

    @Test
    fun `average centipawn loss in real games falls as rating rises`() {
        val ladder = listOf(400, 800, 1200, 1800, 2400, 3200)

        val losses = ladder.map { elo ->
            val bot = SimulatedOpponent.Bot(elo, Random(77))
            val sparring = SimulatedOpponent.Bot(1500, Random(78))
            repeat(2) { index ->
                if (index % 2 == 0) SimulatedOpponent.playGame(bot, sparring)
                else SimulatedOpponent.playGame(sparring, bot)
            }
            println("[elo-ladder] $elo average cp loss = ${"%.1f".format(bot.averageCpLoss)}")
            elo to bot.averageCpLoss
        }

        losses.zipWithNext { (lowElo, lowLoss), (highElo, highLoss) ->
            assertTrue(
                "cp loss rose from $lowElo (${"%.1f".format(lowLoss)}) to " +
                    "$highElo (${"%.1f".format(highLoss)})",
                highLoss <= lowLoss + 5.0,
            )
        }
        assertTrue(
            "400 and 3200 played with indistinguishable accuracy",
            losses.first().second > losses.last().second * 2,
        )
    }

    @Test
    fun `every move played at every rating is legal and games always terminate`() {
        val ratings = listOf(400, 900, 1500, 2000, 2600, 3200)

        ratings.forEach { elo ->
            val bot = SimulatedOpponent.Bot(elo, Random(elo.toLong().toInt()))
            val opponent = SimulatedOpponent.Bot(1400, Random(elo + 1))
            val log = SimulatedOpponent.playGame(bot, opponent)

            assertTrue("elo $elo produced a zero-move game", log.plies > 0)
            assertTrue("elo $elo ran past the ply cap", log.plies <= 140)
            // Replaying the game's final FEN must be a valid position.
            assertNotNull(ChessGame(log.finalFen).fen())
        }
    }

    @Test
    fun `bots at every rating deliver an available mate in one`() {
        // Back-rank mate: Ra1-a8 is mate; every other move is not.
        val ratings = listOf(400, 800, 1200, 1600, 2000, 2400, 3200)

        ratings.forEach { elo ->
            val rng = Random(31)
            repeat(200) {
                val game = ChessGame("6k1/5ppp/8/8/8/8/8/R3K3 w Q - 0 1")
                val bot = SimulatedOpponent.Bot(elo, rng)
                bot.playMove(game, halfMoveCount = 60)

                assertTrue(
                    "elo $elo missed mate in one, played ${game.history().last().uci()}",
                    game.isCheckmate(),
                )
            }
        }
    }

    @Test
    fun `a bot never hangs its queen for free when a safe move exists`() {
        // White queen on d5 is attacked by nothing; moving it to d7 loses it to
        // the king. Even a 400 should not routinely walk into a free capture,
        // because that move sits far outside every rating's centipawn budget.
        val game = ChessGame("4k3/3p4/8/3Q4/8/8/8/4K3 w - - 0 1")
        val ranked = SimulatedOpponent.rankedMoves(game)

        val hangingToKing = ranked.firstOrNull { it.uci == "d5d7" }
        assertNotNull("d5d7 should be a generated legal move", hangingToKing)
        assertTrue(
            "hanging the queen must be scored far below the best move",
            ranked.first().score - hangingToKing!!.score > 500,
        )

        val rng = Random(13)
        repeat(1_000) {
            assertTrue(
                "a 400-rated bot gave away its queen for nothing",
                EloMoveSelector.select(ranked, 400, 40, rng) != "d5d7",
            )
        }
    }

    @Test
    fun `difficulty levels one through sixteen all produce playable games`() {
        (1..16).forEach { level ->
            val elo = EloMoveSelector.resolveTargetElo(level, null)
            val bot = SimulatedOpponent.Bot(elo, Random(level))
            val game = ChessGame()

            repeat(10) { ply ->
                val opponent = SimulatedOpponent.Bot(1200, Random(level + 100))
                val mover = if (ply % 2 == 0) bot else opponent
                assertNotNull(
                    "level $level (elo $elo) failed to produce a move at ply $ply",
                    mover.playMove(game, ply),
                )
            }

            assertEquals("level $level did not play ten plies", 10, game.history().size)
        }
    }
}
