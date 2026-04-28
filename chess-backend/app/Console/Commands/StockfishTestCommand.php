<?php

namespace App\Console\Commands;

use App\Services\MoveAnalysisService;
use Illuminate\Console\Command;

class StockfishTestCommand extends Command
{
    protected $signature = 'stockfish:test
                            {--fen= : FEN position to evaluate (default: starting position)}
                            {--depth=20 : Analysis depth}
                            {--multi-pv=3 : Number of top moves to show}';

    protected $description = 'Test Stockfish integration: evaluate a position and display centipawn score';

    public function handle(MoveAnalysisService $service): int
    {
        $fen = $this->option('fen') ?: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        $depth = (int) $this->option('depth');
        $multiPV = (int) $this->option('multi-pv');

        $this->info('Stockfish Integration Test');
        $this->info(str_repeat('-', 50));
        $this->line("FEN:   <info>{$fen}</info>");
        $this->line("Depth: <info>{$depth}</info>");

        // 1. Single-PV evaluation
        $this->newLine();
        $this->info('[1] evaluatePosition()');

        $result = $service->evaluatePosition($fen, $depth);

        if ($result['score_cp'] === null) {
            $this->error('  FAILED — no score returned. Is Stockfish installed?');
            $this->line('  Hint: Set STOCKFISH_PATH in .env or ensure "stockfish" is on PATH.');
            return self::FAILURE;
        }

        $this->line("  Score:     <info>{$result['score_cp']} cp</info>"
            . ($result['is_mate'] ? " (mate in {$result['mate_in']})" : ''));
        $this->line("  Best move: <info>" . ($result['best_move'] ?? 'N/A') . '</info>');
        $this->line("  Depth:     <info>{$result['depth']}</info>");

        // 2. MultiPV via analyzePosition
        $this->newLine();
        $this->info("[2] analyzePosition() — top {$multiPV} moves");

        $analysis = $service->analyzePosition($fen, $depth);

        if (empty($analysis['top_moves'])) {
            $this->warn('  No MultiPV data returned (Stockfish may not support MultiPV at this depth).');
        } else {
            foreach ($analysis['top_moves'] as $i => $move) {
                $num = $i + 1;
                $eval = $move['eval'] ?? 'N/A';
                $san = $move['move'] ?? '?';
                $d = $move['depth'] ?? '?';
                $this->line("  #{$num}: <info>{$san}</info>  eval={$eval}  depth={$d}");
            }
        }

        $this->newLine();
        $this->info('Stockfish integration OK');
        return self::SUCCESS;
    }
}
