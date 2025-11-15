<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class FixPlayerIdConstraints extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'db:fix-player-constraints';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Fix player_id constraints to allow NULL for placeholder matches';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Checking current column constraints...');

        // Show current structure
        $columns = DB::select("SHOW COLUMNS FROM championship_matches WHERE Field IN ('player1_id', 'player2_id', 'white_player_id', 'black_player_id')");

        $this->table(
            ['Field', 'Type', 'Null', 'Key', 'Default'],
            collect($columns)->map(function($col) {
                return [
                    $col->Field,
                    $col->Type,
                    $col->Null,
                    $col->Key,
                    $col->Default ?? 'NULL'
                ];
            })
        );

        if (!$this->confirm('Do you want to modify these columns to allow NULL?', true)) {
            $this->info('Operation cancelled.');
            return 0;
        }

        $this->info('Dropping foreign key constraints...');

        try {
            DB::statement('ALTER TABLE championship_matches DROP FOREIGN KEY championship_matches_player1_id_foreign');
            $this->info('✓ Dropped player1_id foreign key');
        } catch (\Exception $e) {
            $this->warn('player1_id foreign key not found or already dropped');
        }

        try {
            DB::statement('ALTER TABLE championship_matches DROP FOREIGN KEY championship_matches_player2_id_foreign');
            $this->info('✓ Dropped player2_id foreign key');
        } catch (\Exception $e) {
            $this->warn('player2_id foreign key not found or already dropped');
        }

        try {
            DB::statement('ALTER TABLE championship_matches DROP FOREIGN KEY championship_matches_white_player_id_foreign');
            $this->info('✓ Dropped white_player_id foreign key');
        } catch (\Exception $e) {
            $this->warn('white_player_id foreign key not found or already dropped');
        }

        try {
            DB::statement('ALTER TABLE championship_matches DROP FOREIGN KEY championship_matches_black_player_id_foreign');
            $this->info('✓ Dropped black_player_id foreign key');
        } catch (\Exception $e) {
            $this->warn('black_player_id foreign key not found or already dropped');
        }

        $this->info('Modifying columns to allow NULL...');

        DB::statement('ALTER TABLE championship_matches MODIFY COLUMN player1_id BIGINT UNSIGNED NULL');
        $this->info('✓ Modified player1_id to allow NULL');

        DB::statement('ALTER TABLE championship_matches MODIFY COLUMN player2_id BIGINT UNSIGNED NULL');
        $this->info('✓ Modified player2_id to allow NULL');

        DB::statement('ALTER TABLE championship_matches MODIFY COLUMN white_player_id BIGINT UNSIGNED NULL');
        $this->info('✓ Modified white_player_id to allow NULL');

        DB::statement('ALTER TABLE championship_matches MODIFY COLUMN black_player_id BIGINT UNSIGNED NULL');
        $this->info('✓ Modified black_player_id to allow NULL');

        $this->info('Re-adding foreign key constraints...');

        DB::statement('ALTER TABLE championship_matches ADD CONSTRAINT championship_matches_player1_id_foreign FOREIGN KEY (player1_id) REFERENCES users(id) ON DELETE CASCADE');
        $this->info('✓ Added player1_id foreign key');

        DB::statement('ALTER TABLE championship_matches ADD CONSTRAINT championship_matches_player2_id_foreign FOREIGN KEY (player2_id) REFERENCES users(id) ON DELETE CASCADE');
        $this->info('✓ Added player2_id foreign key');

        DB::statement('ALTER TABLE championship_matches ADD CONSTRAINT championship_matches_white_player_id_foreign FOREIGN KEY (white_player_id) REFERENCES users(id) ON DELETE CASCADE');
        $this->info('✓ Added white_player_id foreign key');

        DB::statement('ALTER TABLE championship_matches ADD CONSTRAINT championship_matches_black_player_id_foreign FOREIGN KEY (black_player_id) REFERENCES users(id) ON DELETE CASCADE');
        $this->info('✓ Added black_player_id foreign key');

        $this->newLine();
        $this->info('✅ All constraints fixed successfully!');
        $this->info('Player ID columns now allow NULL for placeholder matches.');

        // Show updated structure
        $this->newLine();
        $this->info('Updated column structure:');
        $updatedColumns = DB::select("SHOW COLUMNS FROM championship_matches WHERE Field IN ('player1_id', 'player2_id', 'white_player_id', 'black_player_id')");

        $this->table(
            ['Field', 'Type', 'Null', 'Key', 'Default'],
            collect($updatedColumns)->map(function($col) {
                return [
                    $col->Field,
                    $col->Type,
                    $col->Null,
                    $col->Key,
                    $col->Default ?? 'NULL'
                ];
            })
        );

        return 0;
    }
}
