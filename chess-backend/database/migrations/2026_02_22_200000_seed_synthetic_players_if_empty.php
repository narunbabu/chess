<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Seed the synthetic_players table if it is empty.
     *
     * 40 bots across Stockfish levels 6-16, each with a unique
     * Indian name, DiceBear avatar seed, personality, and bio.
     * Rating formula: ~800 + (level * 100) ± 50.
     */
    public function up(): void
    {
        if (! Schema::hasTable('synthetic_players')) {
            return; // Table doesn't exist yet — skip
        }

        if (DB::table('synthetic_players')->count() > 0) {
            return; // Already seeded
        }

        $now = now();

        $players = [
            // Level 6 (1400 ± 50) — Medium
            ['name' => 'Priya Mehta', 'avatar_seed' => 'priya-mehta', 'computer_level' => 6, 'rating' => 1370, 'personality' => 'Balanced', 'bio' => 'Loves openings and tactical puzzles', 'games_played_count' => 245, 'wins_count' => 110],
            ['name' => 'Kiran Joshi', 'avatar_seed' => 'kiran-joshi', 'computer_level' => 6, 'rating' => 1390, 'personality' => 'Defensive', 'bio' => 'Patience is the best strategy', 'games_played_count' => 312, 'wins_count' => 140],
            ['name' => 'Ravi Patel', 'avatar_seed' => 'ravi-patel', 'computer_level' => 6, 'rating' => 1420, 'personality' => 'Aggressive', 'bio' => 'Attack is the best defense', 'games_played_count' => 198, 'wins_count' => 95],
            ['name' => 'Ananya Das', 'avatar_seed' => 'ananya-das', 'computer_level' => 6, 'rating' => 1440, 'personality' => 'Tactical', 'bio' => 'Always looking for tricks', 'games_played_count' => 267, 'wins_count' => 125],

            // Level 7 (1500 ± 50)
            ['name' => 'Vikram Rao', 'avatar_seed' => 'vikram-rao', 'computer_level' => 7, 'rating' => 1470, 'personality' => 'Positional', 'bio' => 'Slow and steady wins the game', 'games_played_count' => 389, 'wins_count' => 190],
            ['name' => 'Sneha Kulkarni', 'avatar_seed' => 'sneha-kulkarni', 'computer_level' => 7, 'rating' => 1500, 'personality' => 'Balanced', 'bio' => 'Club player from Pune', 'games_played_count' => 421, 'wins_count' => 210],
            ['name' => 'Aditya Nair', 'avatar_seed' => 'aditya-nair', 'computer_level' => 7, 'rating' => 1520, 'personality' => 'Aggressive', 'bio' => 'Gambit enthusiast', 'games_played_count' => 356, 'wins_count' => 175],
            ['name' => 'Meera Iyer', 'avatar_seed' => 'meera-iyer', 'computer_level' => 7, 'rating' => 1540, 'personality' => 'Tactical', 'bio' => 'Loves sacrifices and combinations', 'games_played_count' => 290, 'wins_count' => 148],

            // Level 8 (1600 ± 50)
            ['name' => 'Rohan Gupta', 'avatar_seed' => 'rohan-gupta', 'computer_level' => 8, 'rating' => 1570, 'personality' => 'Defensive', 'bio' => 'Solid as a rock', 'games_played_count' => 445, 'wins_count' => 240],
            ['name' => 'Deepa Sharma', 'avatar_seed' => 'deepa-sharma', 'computer_level' => 8, 'rating' => 1600, 'personality' => 'Balanced', 'bio' => 'Tournament regular in Delhi', 'games_played_count' => 512, 'wins_count' => 275],
            ['name' => 'Sanjay Reddy', 'avatar_seed' => 'sanjay-reddy', 'computer_level' => 8, 'rating' => 1620, 'personality' => 'Positional', 'bio' => 'Endgame specialist', 'games_played_count' => 378, 'wins_count' => 200],
            ['name' => 'Kavita Singh', 'avatar_seed' => 'kavita-singh', 'computer_level' => 8, 'rating' => 1640, 'personality' => 'Aggressive', 'bio' => 'Plays the Sicilian exclusively', 'games_played_count' => 334, 'wins_count' => 180],

            // Level 9 (1700 ± 50) — Hard
            ['name' => 'Arjun Kumar', 'avatar_seed' => 'arjun-kumar', 'computer_level' => 9, 'rating' => 1680, 'personality' => 'Tactical', 'bio' => 'State-level champion', 'games_played_count' => 567, 'wins_count' => 320],
            ['name' => 'Lakshmi Menon', 'avatar_seed' => 'lakshmi-menon', 'computer_level' => 9, 'rating' => 1710, 'personality' => 'Balanced', 'bio' => 'Chess coach from Kerala', 'games_played_count' => 623, 'wins_count' => 350],
            ['name' => 'Nikhil Banerjee', 'avatar_seed' => 'nikhil-banerjee', 'computer_level' => 9, 'rating' => 1730, 'personality' => 'Defensive', 'bio' => 'Never gives up a pawn', 'games_played_count' => 489, 'wins_count' => 270],
            ['name' => 'Pooja Deshmukh', 'avatar_seed' => 'pooja-deshmukh', 'computer_level' => 9, 'rating' => 1750, 'personality' => 'Positional', 'bio' => 'Loves closed positions', 'games_played_count' => 401, 'wins_count' => 225],

            // Level 10 (1800 ± 50) — Hard
            ['name' => 'Suresh Verma', 'avatar_seed' => 'suresh-verma', 'computer_level' => 10, 'rating' => 1780, 'personality' => 'Aggressive', 'bio' => 'Rapid chess specialist', 'games_played_count' => 712, 'wins_count' => 410],
            ['name' => 'Divya Bhat', 'avatar_seed' => 'divya-bhat', 'computer_level' => 10, 'rating' => 1810, 'personality' => 'Tactical', 'bio' => 'National team aspirant', 'games_played_count' => 534, 'wins_count' => 310],
            ['name' => 'Rajesh Pillai', 'avatar_seed' => 'rajesh-pillai', 'computer_level' => 10, 'rating' => 1830, 'personality' => 'Balanced', 'bio' => 'Experienced tournament player', 'games_played_count' => 645, 'wins_count' => 370],
            ['name' => 'Isha Chatterjee', 'avatar_seed' => 'isha-chatterjee', 'computer_level' => 10, 'rating' => 1850, 'personality' => 'Positional', 'bio' => 'Classical chess lover', 'games_played_count' => 478, 'wins_count' => 280],

            // Level 11 (1900 ± 50) — Expert
            ['name' => 'Amit Saxena', 'avatar_seed' => 'amit-saxena', 'computer_level' => 11, 'rating' => 1880, 'personality' => 'Aggressive', 'bio' => 'FIDE rated player', 'games_played_count' => 834, 'wins_count' => 500],
            ['name' => 'Nandini Yadav', 'avatar_seed' => 'nandini-yadav', 'computer_level' => 11, 'rating' => 1910, 'personality' => 'Balanced', 'bio' => 'Strong blitz player', 'games_played_count' => 756, 'wins_count' => 450],
            ['name' => 'Gaurav Mishra', 'avatar_seed' => 'gaurav-mishra', 'computer_level' => 11, 'rating' => 1940, 'personality' => 'Tactical', 'bio' => 'Calculation expert', 'games_played_count' => 623, 'wins_count' => 375],
            ['name' => 'Swati Tiwari', 'avatar_seed' => 'swati-tiwari', 'computer_level' => 11, 'rating' => 1950, 'personality' => 'Defensive', 'bio' => 'Fortress builder extraordinaire', 'games_played_count' => 567, 'wins_count' => 340],

            // Level 12 (2000 ± 50) — Expert
            ['name' => 'Manish Kapoor', 'avatar_seed' => 'manish-kapoor', 'computer_level' => 12, 'rating' => 1970, 'personality' => 'Positional', 'bio' => 'CM title holder', 'games_played_count' => 912, 'wins_count' => 570],
            ['name' => 'Shruti Gokhale', 'avatar_seed' => 'shruti-gokhale', 'computer_level' => 12, 'rating' => 2010, 'personality' => 'Aggressive', 'bio' => 'Attacks like Tal', 'games_played_count' => 845, 'wins_count' => 530],
            ['name' => 'Harish Chand', 'avatar_seed' => 'harish-chand', 'computer_level' => 12, 'rating' => 2040, 'personality' => 'Balanced', 'bio' => 'Experienced arbiter and player', 'games_played_count' => 789, 'wins_count' => 490],
            ['name' => 'Tanvi Bhargava', 'avatar_seed' => 'tanvi-bhargava', 'computer_level' => 12, 'rating' => 2050, 'personality' => 'Tactical', 'bio' => "Women's championship contender", 'games_played_count' => 678, 'wins_count' => 420],

            // Level 13 (2100 ± 50) — Expert
            ['name' => 'Ashwin Ramesh', 'avatar_seed' => 'ashwin-ramesh', 'computer_level' => 13, 'rating' => 2080, 'personality' => 'Tactical', 'bio' => 'FM norm holder', 'games_played_count' => 1034, 'wins_count' => 670],
            ['name' => 'Rekha Sundaram', 'avatar_seed' => 'rekha-sundaram', 'computer_level' => 13, 'rating' => 2120, 'personality' => 'Positional', 'bio' => 'Strategic mastermind', 'games_played_count' => 945, 'wins_count' => 610],
            ['name' => 'Vivek Anand', 'avatar_seed' => 'vivek-anand', 'computer_level' => 13, 'rating' => 2140, 'personality' => 'Balanced', 'bio' => 'Named after Vishy, plays like him too', 'games_played_count' => 867, 'wins_count' => 560],

            // Level 14 (2200 ± 50) — Expert
            ['name' => 'Arun Narayan', 'avatar_seed' => 'arun-narayan', 'computer_level' => 14, 'rating' => 2180, 'personality' => 'Aggressive', 'bio' => 'FM from Chennai', 'games_played_count' => 1123, 'wins_count' => 750],
            ['name' => 'Sunita Deshpande', 'avatar_seed' => 'sunita-deshpande', 'computer_level' => 14, 'rating' => 2220, 'personality' => 'Balanced', 'bio' => 'International tournament regular', 'games_played_count' => 1045, 'wins_count' => 700],
            ['name' => 'Pranav Hegde', 'avatar_seed' => 'pranav-hegde', 'computer_level' => 14, 'rating' => 2240, 'personality' => 'Tactical', 'bio' => 'Sharp tactician from Karnataka', 'games_played_count' => 978, 'wins_count' => 655],

            // Level 15 (2300 ± 50) — Expert
            ['name' => 'Krithika Narayanan', 'avatar_seed' => 'krithika-narayanan', 'computer_level' => 15, 'rating' => 2280, 'personality' => 'Positional', 'bio' => 'IM title contender', 'games_played_count' => 1234, 'wins_count' => 850],
            ['name' => 'Dhruv Mahajan', 'avatar_seed' => 'dhruv-mahajan', 'computer_level' => 15, 'rating' => 2320, 'personality' => 'Aggressive', 'bio' => 'Known for brilliant sacrifices', 'games_played_count' => 1156, 'wins_count' => 800],

            // Level 16 (2400 ± 50) — Master
            ['name' => 'Siddharth Venkatesh', 'avatar_seed' => 'siddharth-venkatesh', 'computer_level' => 16, 'rating' => 2370, 'personality' => 'Balanced', 'bio' => 'IM from Hyderabad', 'games_played_count' => 1345, 'wins_count' => 950],
            ['name' => 'Anisha Chandra', 'avatar_seed' => 'anisha-chandra', 'computer_level' => 16, 'rating' => 2410, 'personality' => 'Tactical', 'bio' => 'Rising star of Indian chess', 'games_played_count' => 1267, 'wins_count' => 900],
            ['name' => 'Vishal Rajput', 'avatar_seed' => 'vishal-rajput', 'computer_level' => 16, 'rating' => 2440, 'personality' => 'Positional', 'bio' => 'Deep endgame understanding', 'games_played_count' => 1189, 'wins_count' => 845],
        ];

        foreach ($players as $player) {
            DB::table('synthetic_players')->insert(array_merge($player, [
                'is_active'  => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]));
        }
    }

    public function down(): void
    {
        // Only remove the seeded rows (leave any manually created ones)
        DB::table('synthetic_players')
            ->whereIn('avatar_seed', [
                'priya-mehta', 'kiran-joshi', 'ravi-patel', 'ananya-das',
                'vikram-rao', 'sneha-kulkarni', 'aditya-nair', 'meera-iyer',
                'rohan-gupta', 'deepa-sharma', 'sanjay-reddy', 'kavita-singh',
                'arjun-kumar', 'lakshmi-menon', 'nikhil-banerjee', 'pooja-deshmukh',
                'suresh-verma', 'divya-bhat', 'rajesh-pillai', 'isha-chatterjee',
                'amit-saxena', 'nandini-yadav', 'gaurav-mishra', 'swati-tiwari',
                'manish-kapoor', 'shruti-gokhale', 'harish-chand', 'tanvi-bhargava',
                'ashwin-ramesh', 'rekha-sundaram', 'vivek-anand',
                'arun-narayan', 'sunita-deshpande', 'pranav-hegde',
                'krithika-narayanan', 'dhruv-mahajan',
                'siddharth-venkatesh', 'anisha-chandra', 'vishal-rajput',
            ])
            ->delete();
    }
};
