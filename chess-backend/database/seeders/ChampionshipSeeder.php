<?php

namespace Database\Seeders;

use App\Models\Championship;
use Illuminate\Database\Seeder;
use Carbon\Carbon;

class ChampionshipSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $championships = [
            [
                'id' => 3,
                'title' => 'Organization Internal Tournament 8274',
                'description' => 'Private tournament for organization members',
                'entry_fee' => '0.00',
                'max_participants' => null,
                'registration_deadline' => '2025-12-01T10:00:00.000000Z',
                'start_date' => '2025-12-15T10:00:00.000000Z',
                'match_time_window_hours' => 24,
                'format_id' => 2,
                'swiss_rounds' => 5,
                'top_qualifiers' => null,
                'status_id' => 2, // registration_open
                'created_by' => 1, // Tatva Nalamara (admin)
                'organization_id' => null,
                'visibility' => 'public',
                'allow_public_registration' => true,
                'time_control_minutes' => 10,
                'time_control_increment' => 0,
                'total_rounds' => 5,
                'color_assignment_method' => 'balanced',
                'max_concurrent_matches' => 0,
                'auto_progression' => 0,
                'pairing_optimization' => 1,
                'auto_invitations' => 1,
                'round_interval_minutes' => 15,
                'invitation_timeout_minutes' => 60,
                'match_start_buffer_minutes' => 5,
                'tournament_settings' => null,
                'cancelled_at' => null,
                'cancelled_reason' => null,
                'scheduling_instructions' => null,
                'play_instructions' => null,
                'default_grace_period_minutes' => 10,
                'allow_early_play' => true,
                'require_confirmation' => true,
                'created_at' => '2025-11-13T16:48:02.000000Z',
                'updated_at' => '2025-11-13T16:48:02.000000Z',
            ],
            [
                'id' => 4,
                'title' => 'Organization Internal Tournament 7608',
                'description' => 'Private tournament for organization members',
                'entry_fee' => '100.00',
                'max_participants' => 50,
                'registration_deadline' => '2025-11-13T18:55:00.000000Z',
                'start_date' => '2025-11-13T19:00:00.000000Z',
                'match_time_window_hours' => 24,
                'format_id' => 2,
                'swiss_rounds' => 5,
                'top_qualifiers' => null,
                'status_id' => 3, // in_progress
                'created_by' => 1, // Tatva Nalamara (admin)
                'organization_id' => null,
                'visibility' => 'public',
                'allow_public_registration' => true,
                'time_control_minutes' => 10,
                'time_control_increment' => 0,
                'total_rounds' => 5,
                'color_assignment_method' => 'balanced',
                'max_concurrent_matches' => 0,
                'auto_progression' => 0,
                'pairing_optimization' => 1,
                'auto_invitations' => 1,
                'round_interval_minutes' => 15,
                'invitation_timeout_minutes' => 60,
                'match_start_buffer_minutes' => 5,
                'tournament_settings' => null,
                'cancelled_at' => null,
                'cancelled_reason' => null,
                'scheduling_instructions' => null,
                'play_instructions' => null,
                'default_grace_period_minutes' => 10,
                'allow_early_play' => true,
                'require_confirmation' => true,
                'created_at' => '2025-11-13T16:48:51.000000Z',
                'updated_at' => '2025-11-13T16:48:51.000000Z',
            ],
            [
                'id' => 6,
                'title' => 'Test 1',
                'description' => 'Hello how are you',
                'entry_fee' => '100.00',
                'max_participants' => 50,
                'registration_deadline' => '2025-11-14T18:20:00.000000Z',
                'start_date' => '2025-11-14T23:17:00.000000Z',
                'match_time_window_hours' => 72,
                'format_id' => 2,
                'swiss_rounds' => 5,
                'top_qualifiers' => null,
                'status_id' => 2, // registration_open
                'created_by' => 1, // Tatva Nalamara (admin)
                'organization_id' => null,
                'visibility' => 'public',
                'allow_public_registration' => true,
                'time_control_minutes' => 10,
                'time_control_increment' => 0,
                'total_rounds' => 5,
                'color_assignment_method' => 'balanced',
                'max_concurrent_matches' => 0,
                'auto_progression' => 0,
                'pairing_optimization' => 1,
                'auto_invitations' => 1,
                'round_interval_minutes' => 15,
                'invitation_timeout_minutes' => 60,
                'match_start_buffer_minutes' => 5,
                'tournament_settings' => null,
                'cancelled_at' => null,
                'cancelled_reason' => null,
                'scheduling_instructions' => null,
                'play_instructions' => null,
                'default_grace_period_minutes' => 10,
                'allow_early_play' => true,
                'require_confirmation' => true,
                'created_at' => '2025-11-13T17:51:32.000000Z',
                'updated_at' => '2025-11-14T01:23:35.000000Z',
            ]
        ];

        foreach ($championships as $championshipData) {
            $championship = Championship::firstOrNew(
                ['title' => $championshipData['title']],
                array_merge($championshipData, ['id' => null])
            );

            if ($championship->exists) {
                // Update existing championship
                $championship->update(array_diff_key($championshipData, ['id' => true, 'title' => true, 'created_at' => true]));
            } else {
                // Create new championship
                $championship->save();
            }
        }

        $this->command->info('Championships seeded successfully!');
        $this->command->info('- Organization Internal Tournament 8274 (Registration Open)');
        $this->command->info('- Organization Internal Tournament 7608 (In Progress)');
        $this->command->info('- Test 1 (Registration Open)');
    }
}