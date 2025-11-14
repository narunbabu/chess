<?php

namespace Database\Seeders;

use App\Models\Championship;
use App\Models\ChampionshipParticipant;
use App\Models\User;
use Illuminate\Database\Seeder;

class ChampionshipParticipantSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Get championships by title to find their actual IDs
        $championship7608 = Championship::where('title', 'Organization Internal Tournament 7608')->first();
        $championshipTest1 = Championship::where('title', 'Test 1')->first();

        // Participants for Championship: Organization Internal Tournament 7608 (In Progress)
        if ($championship7608) {
            $participants = [
                [
                    'user_id' => 1, // Tatva Nalamara (admin)
                    'razorpay_order_id' => null,
                    'razorpay_payment_id' => null,
                    'razorpay_signature' => null,
                    'payment_status_id' => 2, // completed
                    'amount_paid' => '0.00',
                    'registered_at' => '2025-11-13T08:34:27.000000Z',
                    'seed_number' => null,
                ],
                [
                    'user_id' => 3, // Sanatan Nalamara
                    'razorpay_order_id' => null,
                    'razorpay_payment_id' => null,
                    'razorpay_signature' => null,
                    'payment_status_id' => 2, // completed
                    'amount_paid' => '100.00',
                    'registered_at' => '2025-11-13T12:57:40.000000Z',
                    'seed_number' => null,
                ],
                [
                    'user_id' => 4, // Arun Nalamara
                    'razorpay_order_id' => null,
                    'razorpay_payment_id' => null,
                    'razorpay_signature' => null,
                    'payment_status_id' => 2, // completed
                    'amount_paid' => '100.00',
                    'registered_at' => '2025-11-13T13:07:53.000000Z',
                    'seed_number' => null,
                ]
            ];

            foreach ($participants as $participantData) {
                $participant = ChampionshipParticipant::firstOrNew(
                    [
                        'championship_id' => $championship7608->id,
                        'user_id' => $participantData['user_id']
                    ],
                    $participantData
                );

                if (!$participant->exists) {
                    $participant->championship_id = $championship7608->id;
                    $participant->save();
                }
            }
        }

        // Add test registration for Test 1 championship
        if ($championshipTest1) {
            $testParticipant = [
                'user_id' => 2, // Vedansh Nalamara
                'razorpay_order_id' => null,
                'razorpay_payment_id' => null,
                'razorpay_signature' => null,
                'payment_status_id' => 1, // pending
                'amount_paid' => '0.00',
                'registered_at' => now(),
                'seed_number' => null,
            ];

            $participant = ChampionshipParticipant::firstOrNew(
                [
                    'championship_id' => $championshipTest1->id,
                    'user_id' => $testParticipant['user_id']
                ],
                $testParticipant
            );

            if (!$participant->exists) {
                $participant->championship_id = $championshipTest1->id;
                $participant->save();
            }
        }

        $this->command->info('Championship participants seeded successfully!');
        $this->command->info('- Organization Internal Tournament 7608: 3 participants (Tatva, Sanatan, Arun)');
        $this->command->info('- Test 1: 1 participant (Vedansh - pending payment)');
    }
}