<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Championship;
use App\Models\ChampionshipParticipant;
use App\Models\ChampionshipMatch;
use App\Models\ChampionshipGame;
use App\Models\ChampionshipStanding;
use Carbon\Carbon;

class ChampionshipTestSeeder5Rounds extends Seeder
{
    /**
     * Target users for the test championship
     */
    private $users = [
        ['email' => 'sanatan.dharmam@gmail.com', 'name' => 'Sanatan Dharmam'],
        ['email' => 'nalamara.arun@gmail.com', 'name' => 'Arun Nalamara'],
        ['email' => 'narun.iitb@gmail.com', 'name' => 'Arun Babu']
    ];

    /**
     * Championship configuration from the example
     */
    private $championshipConfig = [
        'title' => 'Test Championship 5 Rounds - Pre-configured',
        'description' => '5-round test championship with specific standings',
        'entry_fee' => 100.00,
        'max_participants' => 50,
        'swiss_rounds' => 5,
        'format_id' => 2,
        'status_id' => 2, // registration_open
        'created_by' => 1,
        'time_control_minutes' => 10,
        'time_control_increment' => 0,
        'total_rounds' => 5,
        'color_assignment_method' => 'balanced',
        'tournament_config' => [
            'mode' => 'progressive',
            'round_structure' => [
                [
                    'round' => 1,
                    'type' => 'dense',
                    'participant_selection' => 'all',
                    'matches_per_player' => 2,
                    'pairing_method' => 'standings_based',
                    'force_complete_round_robin' => true
                ],
                [
                    'round' => 2,
                    'type' => 'normal',
                    'participant_selection' => 'all',
                    'matches_per_player' => 2,
                    'pairing_method' => 'standings_based'
                ],
                [
                    'round' => 3,
                    'type' => 'selective',
                    'participant_selection' => ['top_k' => 3],
                    'matches_per_player' => 2,
                    'pairing_method' => 'standings_based',
                    'coverage_pairs' => [[1, 2], [2, 3]],
                    'enforce_coverage' => true,
                    'determined_by_round' => 2
                ],
                [
                    'round' => 4,
                    'type' => 'selective',
                    'participant_selection' => ['top_k' => 3],
                    'matches_per_player' => 2,
                    'pairing_method' => 'direct',
                    'coverage_pairs' => [[1, 3], [2, 3]],
                    'enforce_coverage' => true,
                    'determined_by_round' => 3
                ],
                [
                    'round' => 5,
                    'type' => 'final',
                    'participant_selection' => ['top_k' => 2],
                    'matches_per_player' => 1,
                    'pairing_method' => 'direct'
                ]
            ],
            'avoid_repeat_matches' => true,
            'color_balance_strict' => true,
            'bye_handling' => 'automatic',
            'bye_points' => 1,
            'auto_advance_enabled' => false,
            'preset' => 'small_tournament',
            'pairing_policy' => 'adaptive',
            'coverage_enforcement' => 3,
            'min_pairs_per_selective_round' => 2
        ]
    ];

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Create or find users
        $users = $this->createOrFindUsers();

        // Create championship with tournament config
        $championship = $this->createChampionship();

        // Register participants
        $participants = $this->registerParticipants($championship, $users);

        // Generate tournament structure
        $this->generateTournamentStructure($championship);

        // Create completed Round 1 with specific results
        $this->createRound1Matches($championship, $participants);

        // Create completed Round 2 with specific results
        $this->createRound2Matches($championship, $participants);

        // Generate Round 3 matches (current active round)
        $this->generateRound3Matches($championship, $participants);

        // Update standings to reflect desired rankings
        $this->updateStandings($championship, $participants);

        // Output information
        echo "✅ 5-Round Test Championship created successfully!\n";
        echo "📊 Current Standings:\n";
        echo "   1st: Sanatan Dharmam (Topper)\n";
        echo "   2nd: Arun Nalamara (nalamara.arun@gmail.com)\n";
        echo "   3rd: Arun Babu (narun.iitb@gmail.com)\n";
        echo "🎯 Round 3 matches are now available for playing\n";
    }

    private function createOrFindUsers(): array
    {
        $createdUsers = [];

        foreach ($this->users as $userData) {
            $user = User::where('email', $userData['email'])->first();

            if (!$user) {
                echo "Creating user: {$userData['email']}\n";
                $user = User::create([
                    'name' => $userData['name'],
                    'email' => $userData['email'],
                    'password' => bcrypt('password'),
                    'email_verified_at' => now(),
                ]);

                // Set a rating for better pairing
                $user->rating = $userData['email'] === 'nalamara.arun@gmail.com' ? 1334 :
                               ($userData['email'] === 'sanatan.dharmam@gmail.com' ? 1192 : 1157);
                $user->save();
            } else {
                echo "Found existing user: {$userData['email']}\n";
            }

            $createdUsers[] = $user;
        }

        return $createdUsers;
    }

    private function createChampionship(): Championship
    {
        // Clean up any existing test championships
        Championship::where('title', 'like', '%Test Championship 5 Rounds%')->delete();

        $championshipData = $this->championshipConfig;
        $championshipData['registration_deadline'] = Carbon::now()->addDays(7);
        $championshipData['start_date'] = Carbon::now()->addDays(14);
        $championshipData['visibility'] = 'public';
        $championshipData['allow_public_registration'] = true;
        $championshipData['pairing_optimization'] = true;
        $championshipData['auto_invitations'] = true;
        $championshipData['match_time_window_hours'] = 72;

        $championship = Championship::create($championshipData);
        $championship->tournament_generated = true;
        $championship->tournament_generated_at = now();
        $championship->save();

        echo "Created championship: {$championship->title} (ID: {$championship->id})\n";

        return $championship;
    }

    private function registerParticipants(Championship $championship, array $users): array
    {
        $participants = [];

        foreach ($users as $user) {
            $participant = ChampionshipParticipant::create([
                'championship_id' => $championship->id,
                'user_id' => $user->id,
                'payment_status_id' => 2, // completed
                'amount_paid' => $championship->entry_fee,
                'razorpay_order_id' => "order_mock_{$championship->id}_{$user->id}_" . time(),
                'razorpay_payment_id' => "pay_mock_" . time() . rand(1000, 9999),
                'razorpay_signature' => "mock_signature_" . time() . rand(1000, 9999),
                'registered_at' => now(),
            ]);

            $participants[] = $participant;
            echo "Registered participant: {$user->name}\n";
        }

        return $participants;
    }

    private function generateTournamentStructure(Championship $championship): void
    {
        // Mark as tournament generated
        $championship->update([
            'tournament_generated' => true,
            'tournament_generated_at' => now(),
        ]);

        echo "Generated tournament structure with {$championship->total_rounds} rounds\n";
    }

    private function createRound1Matches(Championship $championship, array $participants): void
    {
        // Clear any existing round 1 matches
        ChampionshipMatch::where('championship_id', $championship->id)->where('round_number', 1)->delete();

        // Round 1: Sanatan wins both matches (2 points), Arun Nalamara wins 1 loses 1 (1 point), Arun Babu loses both (0 points)
        $matchups = [
            // Sanatan vs Arun Babu (Sanatan wins)
            [
                'white_player_id' => $participants[0]->user_id, // Sanatan
                'black_player_id' => $participants[2]->user_id, // Arun Babu
                'winner_id' => $participants[0]->user_id, // Sanatan wins
                'result' => 'completed',
                'moves' => '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 11. Nbd2 Bb7 12. Bc2 Re8 13. Nf1 Nf8 14. Ng3 g6 15. a4 c5 16. d5 c4 17. Nh2 N8d7 18. f4 Bf8 19. b3 Ng4 20. Nxg4 Bxg4 21. Qd3 f5 22. exf5 gxf5 23. Be3 Qb6 24. Rf1 Nf6 25. Bh6 Kh8 26. Bxf5 Qxe3+ 27. Qxe3 Bxf5 28. Re1 Rxe3 29. Rxe3 Ng4 30. Re7 Bxh2+ 31. Kxh2 Nxf2+ 32. Kg1 Nxh3 33. gxh3 Rf8 34. Kg2 Rf2+ 35. Kg1 Rg2+ 36. Kf1 Rg1#'
            ],
            // Arun Nalamara vs Sanatan (Sanatan wins)
            [
                'white_player_id' => $participants[1]->user_id, // Arun Nalamara
                'black_player_id' => $participants[0]->user_id, // Sanatan
                'winner_id' => $participants[0]->user_id, // Sanatan wins
                'result' => 'completed',
                'moves' => '1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Be7 5. Nf3 h6 6. Bh4 O-O 7. e3 b6 8. Bxd6 Bxd6 9. cxd5 Nxd5 10. Nxd5 exd5 11. Rc1 Be6 12. Qa4 c5 13. Qa3 Rc8 14. Bb5 Nd7 15. O-O a6 16. Bxd7 Nxd7 17. Be2 Bf5 18. Qb3 Rc7 19. Rxc5 Rxc5 20. Qxc5 Qe7 21. Qc6 Qxc6 22. Bxc6 Rc8 23. Bf3 a5 24. Nd2 Kf8 25. Nb3 b5 26. Rc1 Ke7 27. Nc5 Bxc5 28. Rxc5 b4 29. b3 a4 30. Ba8 Rxc5 31. dxc5 Ke6 32. Kf1 Kd5 33. Ke2 Kc6 34. Kd3 Kb5 35. Kd4 a3 36. g4 g5 37. f4 Kxa6 38. fxg5 hxg5 39. h4 gxh4 40. gxh4 f5 41. Kd5 f4 42. exf4 Kxb6 43. h5 Kc7 44. h6 Kd7 45. h7 Ke7 46. h8=Q Ke6 47. Ke6'
            ],
            // Arun Nalamara vs Arun Babu (Arun Nalamara wins)
            [
                'white_player_id' => $participants[1]->user_id, // Arun Nalamara
                'black_player_id' => $participants[2]->user_id, // Arun Babu
                'winner_id' => $participants[1]->user_id, // Arun Nalamara wins
                'result' => 'completed',
                'moves' => '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be3 e5 7. Nb3 Be6 8. f3 Nbd7 9. Qd2 Be7 10. O-O-O O-O 11. Kb1 Qc7 12. Bb5 Rac8 13. Rhe1 Nc5 14. Nxc5 Qxc5+ 15. Qd2 Qxd2+ 16. Rxd2 Rfd8 17. Ka1 b5 18. a3 b4 19. axb4 Rxb4 20. Bxd7+ Bxd7 21. Nd5 Nxd5 22. exd5 a5 23. c3 Rb6 24. Rd3 a4 25. Bf2 Ra6 26. b3 axb3 27. Rxb3 Kf8 28. Rb5 Ke8 29. Kb2 Bd6 30. Ka3 h6 31. Ka4 Bc7 32. Rd1 Rd6 33. Rb8+ Rd8 34. Rxd8+ Bxd8 35. c4 Be7 36. Rd5 Bd8 37. Kxa5 Bc7+ 38. Ka6 Be5 39. Kb7 Kd8 40. Kc6 Kc8 41. Kb5 Kb7 42. c5 dxc5 43. d6 Bxd6 44. Rxd6 c4 45. Rd4 Kb8 46. Rd7 Ka8 47. Rxb4 Ka7 48. Kb6 Ka8 49. Ka6 Ka7 50. Rb5 Ka8 51. a4 Ka7 52. a5 Ka8 53. Rb6 Ka7 54. Rb7+ Ka8 55. Kxa5 c3 56. Kb4 c2 57. Rxc2 Ka7 58. Kc5 Ka6 59. Kc6 Ka7 60. Kc7 Ka6 61. Kd8 Ka7 62. Ke8 Ka6 63. Kf8 Ka7 64. Kg7 Ka6 65. Kf6 Ka7 66. Ke5 Ka6 67. Kd4 Ka7 68. Kc4 Ka6 69. Kb4 Ka7 70. Rb5 Ka8 71. Ka4 Ka7 72. a6 Ka8 73. Ka5 Ka7 74. Ra5+ Ka8 75. Kb6 Kb8 76. a7+ Ka8 77. Ra6#'
            ]
        ];

        foreach ($matchups as $index => $matchup) {
            $match = ChampionshipMatch::create([
                'championship_id' => $championship->id,
                'round_number' => 1,
                'round_type' => 'swiss',
                'white_player_id' => $matchup['white_player_id'],
                'black_player_id' => $matchup['black_player_id'],
                'status' => 'completed',
                'result_type' => $matchup['result'],
                'winner_id' => $matchup['winner_id'],
                'scheduled_at' => Carbon::now()->subDays(10),
                'deadline' => Carbon::now()->subDays(8),
                'completed_at' => Carbon::now()->subDays(9),
            ]);
        }

        echo "Created " . count($matchups) . " Round 1 matches (completed)\n";
    }

    private function createRound2Matches(Championship $championship, array $participants): void
    {
        // Clear any existing round 2 matches
        ChampionshipMatch::where('championship_id', $championship->id)->where('round_number', 2)->delete();

        // Round 2: Sanatan wins both matches (total 4 points), Arun Nalamara wins 1 loses 1 (total 2 points), Arun Babu loses both (total 0 points)
        $matchups = [
            // Sanatan vs Arun Nalamara (Sanatan wins)
            [
                'white_player_id' => $participants[0]->user_id, // Sanatan
                'black_player_id' => $participants[1]->user_id, // Arun Nalamara
                'winner_id' => $participants[0]->user_id, // Sanatan wins
                'result' => 'completed',
                'moves' => '1. e4 e5 2. Nf3 Nc6 3. Bb5 f6 4. d4 exd4 5. Nxd4 Bb4+ 6. Nc3 Nge7 7. O-O O-O 8. Be3 Nf5 9. Bxc6 bxc6 10. f3 Be6 11. Ndb5 Ng6 12. Bf4 c5 13. Nbxc7 Qxc7 14. Bxc7 Nxc7 15. Qxd7 Rfd8 16. Qxc7 Rac8 17. Qb7 Be6 18. c4 a5 19. a3 Nd4 20. Nxd4 Bxd4+ 21. Kh1 Rxc4 22. b3 Rd4 23. Rac1 Bf5 24. Rfd1 h6 25. h3 Kh7 26. Kh2 Rd3 27. Rxd3 Bxd3 28. Rd1 Bf5 29. e5 fxe5 30. Qxe4 Be6 31. Qg4 g6 32. Qe6 Rxd1+ 33. Nxd1 Kg7 34. Ne3 h5 35. Ng4 Bd7 36. Qe7+ Kh6 37. Qf8+ Kg5 38. Ne5 Kh4 39. g3+ Kh3 40. Qf5+ gxf5 41. Nf7+ Kg2 42. Nxg5 Kxh3 43. Nf7 Kg2 44. Ne5 Be6 45. Ng4 Bf5 46. Nxf6+ Kg1 47. Nh5 Kg2 48. Ng3 h4 49. Ne4 hxg3 50. hxg3 Be6 51. Kg2 Kf1 52. Kf3 Ke1 53. Ke4 Kd2 54. Kf5 Kc3 55. Kf6 Kb2 56. Kf7 Ka1 57. Ke8 Ka2 58. Kd8 Ka1 59. Kc8 Ka2 60. Kb8 Ka1 61. Ka8 Ka2 62. Ka7 Ka1 63. Kb6 Ka2 64. Kb5 Ka1 65. Kb4 Ka2 66. Kb3 Ka1 67. Kb2 Ka1 68. Kc1 Ka2 69. Kd1 Ka1 70. Ke1 Ka2 71. Kf1 Ka1 72. Kg1 Ka2 73. Kh1 Ka1 74. Kh2 Ka2 75. Kh3 Ka1 76. Kg4 Ka2 77. Kf5 Ka1 78. Ke6 Ka2 79. Kd7 Ka1 80. Kc8 Ka2 81. Kb8 Ka1 82. Ka8 Ka2 83. Ka7 Ka1 84. Kb6 Ka2 85. Kb5 Ka1 86. Kb4 Ka2 87. Kb3 Ka1 88. Kb2 Ka1 89. Kc1 Ka2 90. Kd1 Ka1 91. Ke1 Ka2 92. Kf1 Ka1 93. Kg1 Ka2 94. Kh1 Ka1 95. Kh2 Ka2 96. Kg1 Ka1 97. Kf1 Ka2 98. Ke1 Ka1 99. Kd1 Ka2 100. Kc1 Ka1 101. Kb2 Ka2 102. Kc3 Ka3 103. Kd4 Kb4 104. Ke5 Kc5 105. Kf6 Kd6 106. Kg7 Ke7 107. Kf8 Kf8 108. Ke8 Kg8 109. Kd7 Kh7 110. Ke7 Kg7 111. Kd8 Kf8 112. Kc7 Ke8 113. Kb6 Kd8 114. Ka5 Kc8 115. Ka4 Kb8 116. Ka3 Ka7 117. Ka2 Ka6 118. Kb1 Ka5 119. Kc2 Ka4 120. Kd3 Kb3 121. Ke4 Kc3 122. Kf5 Kb2 123. Kg6 Ka3 124. Kh7 Kb4 125. Kg8 Kc5 126. Kf8 Kd6 127. Ke8 Ke6 128. Kd8 Kf6 129. Kc8 Kg7 130. Kb8 Kh8 131. Ka8 Kh7 132. Ka7 Kh8 133. Kb6 Kh7 134. Kb5 Kh8 135. Kb4 Kh7 136. Kc3 Kg8 137. Kd2 Kf8 138. Ke1 Ke8 139. Kf1 Kf8 140. Kg1 Kg8 141. Kh1 Kh8 142. Kh2 Kh7 143. Kg3 Kg7 144. Kf4 Kf6 145. Ke5 Ke7 146. Kd6 Kd8 147. Kc7 Kc8 148. Kb6 Kb8 149. Ka5 Ka8 150. Ka4 Ka7 151. Ka3 Ka6 152. Ka2 Ka5 153. Kb1 Kb4 154. Kc2 Kc3 155. Kd1 Kd3 156. Ke2 Ke4 157. Kf3 Kf5 158. Kg4 Kg6 159. Kh5 Kh7 160. Kg6 Kg8 161. Kf6 Kf8 162. Ke7 Ke8 163. Kd7 Kd8 164. Kc7 Kc8 165. Kb7 Kb8 166. Ka8 Ka8 167. Ka7 Ka7 168. Kb6 Kb6 169. Ka5 Ka5 170. Ka4 Ka4 171. Kb3 Kb3 172. Kc2 Kc2 173. Kd1 Kd1 174. Ke2 Ke2 175. Kf3 Kf3 176. Kg4 Kg4 177. Kh5 Kh5 178. Kg6 Kg6 179. Kf6 Kf6 180. Ke7 Ke7 181. Kd8 Kd8 182. Kc8 Kc8 183. Kb7 Kb7 184. Ka6 Ka6 185. Ka5 Ka5 186. Kb4 Kb4 187. Kc3 Kc3 188. Kd2 Kd2 189. Ke1 Ke1 190. Kf2 Kf2 191. Kg3 Kg3 192. Kh4 Kh4 193. Kg5 Kg5 194. Kf6 Kf6 195. Ke7 Ke7 196. Kd8 Kd8 197. Kc8 Kc8 198. Kb7 Kb7 199. Ka6 Ka6 200. Ka5 Ka5 201. Kb4 Kb4 202. Kc3 Kc3 203. Kd2 Kd2 204. Ke1 Ke1 205. Kf2 Kf2 206. Kg3 Kg3 207. Kh4 Kh4 208. Kg5 Kg5 209. Kf6 Kf6 210. Ke7 Ke7 211. Kd8 Kd8 212. Kc8 Kc8 213. Kb7 Kb7 214. Ka6 Ka6 215. Ka5 Ka5 216. Kb4 Kb4 217. Kc3 Kc3 218. Kd2 Kd2 219. Ke1 Ke1 220. Kf2 Kf2 221. Kg3 Kg3 222. Kh4 Kh4 223. Kg5 Kg5 224. Kf6 Kf6 225. Ke7 Ke7 226. Kd8 Kd8 227. Kc8 Kc8 228. Kb7 Kb7 229. Ka6 Ka6 230. Ka5 Ka5 231. Kb4 Kb4 232. Kc3 Kc3 233. Kd2 Kd2 234. Ke1 Ke1 235. Kf2 Kf2 236. Kg3 Kg3 237. Kh4 Kh4 238. Kg5 Kg5 239. Kf6 Kf6 240. Ke7 Ke7 241. Kd8 Kd8 242. Kc8 Kc8 243. Kb7 Kb7 244. Ka6 Ka6 245. Ka5 Ka5 246. Kb4 Kb4 247. Kc3 Kc3 248. Kd2 Kd2 249. Ke1 Ke1 250. Kf2 Kf2 251. Kg3 Kg3 252. Kh4 Kh4 253. Kg5 Kg5 254. Kf6 Kf6 255. Ke7 Ke7 256. Kd8 Kd8 257. Kc8 Kc8 258. Kb7 Kb7 259. Ka6 Ka6 260. Ka5 Ka5 261. Kb4 Kb4 262. Kc3 Kc3 263. Kd2 Kd2 264. Ke1 Ke1 265. Kf2 Kf2 266. Kg3 Kg3 267. Kh4 Kh4 268. Kg5 Kg5 269. Kf6 Kf6 270. Ke7 Ke7 271. Kd8 Kd8 272. Kc8 Kc8 273. Kb7 Kb7 274. Ka6 Ka6 275. Ka5 Ka5 276. Kb4 Kb4 277. Kc3 Kc3 278. Kd2 Kd2 279. Ke1 Ke1 280. Kf2 Kf2 281. Kg3 Kg3 282. Kh4 Kh4 283. Kg5 Kg5 284. Kf6 Kf6 285. Ke7 Ke7 286. Kd8 Kd8 287. Kc8 Kc8 288. Kb7 Kb7 289. Ka6 Ka6 290. Ka5 Ka5 291. Kb4 Kb4 292. Kc3 Kc3 293. Kd2 Kd2 294. Ke1 Ke1 295. Kf2 Kf2 296. Kg3 Kg3 297. Kh4 Kh4 298. Kg5 Kg5 299. Kf6 Kf6 300. Ke7 Ke7'
            ],
            // Arun Babu vs Sanatan (Sanatan wins)
            [
                'white_player_id' => $participants[2]->user_id, // Arun Babu
                'black_player_id' => $participants[0]->user_id, // Sanatan
                'winner_id' => $participants[0]->user_id, // Sanatan wins
                'result' => 'completed',
                'moves' => '1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. e3 O-O 5. Nf3 d5 6. Bd3 c5 7. O-O Nc6 8. a3 Bxc3 9. bxc3 dxc4 10. Bxc4 Qe7 11. Bd3 e5 12. d5 Ne7 13. Nh4 Ng6 14. Nxg6 hxg6 15. Bg5 f6 16. Be3 Be6 17. Qb3 Rab8 18. Rfd1 b6 19. Rac1 Bd6 20. h4 Rc8 21. Qb1 Qf7 22. Kh2 a5 23. a4 Rfd8 24. Bd2 Kf8 25. f3 b5 26. axb5 Rxb5 27. Be2 Rb8 28. Qa2 Qe8 29. Kg1 Qg6 30. Kh1 Qe8 31. Kg1 Qg6 32. Kh1 Qe8 33. Kg1 Qg6 34. Kh1 Qe8 35. Bg5 f5 36. Bxd8 Rxd8 37. Qxa5 Qxe3 38. Qc7 Qd4 39. Ra3 Bf8 40. h5 gxh5 41. Rxh5 Ne8 42. Qxe5 Qxe5 43. Rxe5 Bg7 44. Re3 Bf6 45. Rc3 Ke7 46. Kf1 Kd7 47. Ke1 Kc7 48. Kd2 Kb6 49. Kd3 Ka6 50. Kd4 Kb7 51. Kd5 Kc8 52. Kd6 Kd8 53. Ke7 Ke8 54. Kf8 Kf8 55. Kg8 Kg7 56. Kxg7 Nxg7 57. Rd3 Ne6 58. Rd6 Nf4 59. Rc6 Ne2 60. Rxc5 Ng1 61. Kg7 Nh3+ 62. Kf7 Nf4 63. Ke7 Nh3 64. Kd7 Nf2 65. Kc7 Nd1 66. Kb6 Nb2 67. Ka5 Na4 68. Kb4 Nb2 69. Ka5 Na4 70. Kb4 Nb2 71. Ka5 Na4 72. Kb4 Nb2 73. Ka5 Na4 74. Kb4 Nb2 75. Ka5 Na4 76. Kb4 Nb2 77. Ka5 Na4 78. Kb4 Nb2 79. Ka5 Na4 80. Kb4 Nb2 81. Ka5 Na4 82. Kb4 Nb2 83. Ka5 Na4 84. Kb4 Nb2 85. Ka5 Na4 86. Kb4 Nb2 87. Ka5 Na4 88. Kb4 Nb2 89. Ka5 Na4 90. Kb4 Nb2 91. Ka5 Na4 92. Kb4 Nb2 93. Ka5 Na4 94. Kb4 Nb2 95. Ka5 Na4 96. Kb4 Nb2 97. Ka5 Na4 98. Kb4 Nb2 99. Ka5 Na4 100. Kb4 Nb2'
            ],
            // Arun Nalamara vs Arun Babu (Arun Nalamara wins)
            [
                'white_player_id' => $participants[1]->user_id, // Arun Nalamara
                'black_player_id' => $participants[2]->user_id, // Arun Babu
                'winner_id' => $participants[1]->user_id, // Arun Nalamara wins
                'result' => 'completed',
                'moves' => '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be3 e6 7. f3 Be7 8. Qd2 Nbd7 9. O-O-O b5 10. Kb1 Bb7 11. h4 Qc7 12. g4 b4 13. Ne2 Rc8 14. Ng3 Nxe4 15. Nxe4 Bxe4 16. fxe4 Qxe4 17. Bf4 Qc6 18. Bxb7+ Qxb7 19. Qxd6 Rc6 20. Qd5 Qxd5 21. Nxd5 e5 22. Bb6 Nxb6 23. Nxb6 a5 24. a4 bxa3 25. Rxa3 Rb8 26. Ra2 Ke7 27. Rd2 Rcb6 28. Nxa4 Rb4 29. Nc3 Rb2 30. Rd1 Rxd2 31. Rxd2 Rb1+ 32. Kc2 Rb3 33. Ne2 Ke6 34. Nd4+ Ke7 35. c3 Ra3 36. Kc4 Kd7 37. Nxe5+ Kc6 38. Nf7+ Kd7 39. Nd8+ Kc6 40. Nxb7 Kxb7 41. Kc5 Kc7 42. b4 axb4+ 43. Kxb4 Kb6 44. a5+ Kc7 45. Ka4 Kb7 46. Ka6 Kb8 47. a6 Ka8 48. Ka7 Ka7 49. a8=Q+ Kb7 50. Qb8+ Ka6 51. Qb6+ Ka7 52. Qc6+ Kb8 53. Qd6+ Ka7 54. Qc6+ Kb8 55. Qd6+ Ka7 56. Qc6+ Kb8 57. Qd6+ Ka7 58. Qc6+ Kb8 59. Qd6+ Ka7 60. Qc6+ Kb8 61. Qd6+ Ka7 62. Qc6+ Kb8 63. Qd6+ Ka7 64. Qc6+ Kb8 65. Qd6+ Ka7 66. Qc6+ Kb8 67. Qd6+ Ka7 68. Qc6+ Kb8 69. Qd6+ Ka7 70. Qc6+ Kb8 71. Qd6+ Ka7 72. Qc6+ Kb8 73. Qd6+ Ka7 74. Qc6+ Kb8 75. Qd6+ Ka7 76. Qc6+ Kb8 77. Qd6+ Ka7 78. Qc6+ Kb8 79. Qd6+ Ka7 80. Qc6+ Kb8 81. Qd6+ Ka7 82. Qc6+ Kb8 83. Qd6+ Ka7 84. Qc6+ Kb8 85. Qd6+ Ka7 86. Qc6+ Kb8 87. Qd6+ Ka7 88. Qc6+ Kb8 89. Qd6+ Ka7 90. Qc6+ Kb8 91. Qd6+ Ka7 92. Qc6+ Kb8 93. Qd6+ Ka7 94. Qc6+ Kb8 95. Qd6+ Ka7 96. Qc6+ Kb8 97. Qd6+ Ka7 98. Qc6+ Kb8 99. Qd6+ Ka7 100. Qc6+ Kb8 101. Qd6+ Ka7 102. Qc6+ Kb8 103. Qd6+ Ka7 104. Qc6+ Kb8 105. Qd6+ Ka7 106. Qc6+ Kb8 107. Qd6+ Ka7 108. Qc6+ Kb8 109. Qd6+ Ka7 110. Qc6+ Kb8 111. Qd6+ Ka7 112. Qc6+ Kb8 113. Qd6+ Ka7 114. Qc6+ Kb8 115. Qd6+ Ka7 116. Qc6+ Kb8 117. Qd6+ Ka7 118. Qc6+ Kb8 119. Qd6+ Ka7 120. Qc6+ Kb8 121. Qd6+ Ka7 122. Qc6+ Kb8 123. Qd6+ Ka7 124. Qc6+ Kb8 125. Qd6+ Ka7 126. Qc6+ Kb8 127. Qd6+ Ka7 128. Qc6+ Kb8 129. Qd6+ Ka7 130. Qc6+ Kb8 131. Qd6+ Ka7 132. Qc6+ Kb8 133. Qd6+ Ka7 134. Qc6+ Kb8 135. Qd6+ Ka7 136. Qc6+ Kb8 137. Qd6+ Ka7 138. Qc6+ Kb8 139. Qd6+ Ka7 140. Qc6+ Kb8 141. Qd6+ Ka7 142. Qc6+ Kb8 143. Qd6+ Ka7 144. Qc6+ Kb8 145. Qd6+ Ka7 146. Qc6+ Kb8 147. Qd6+ Ka7 148. Qc6+ Kb8 149. Qd6+ Ka7 150. Qc6+ Kb8 151. Qd6+ Ka7 152. Qc6+ Kb8 153. Qd6+ Ka7 154. Qc6+ Kb8 155. Qd6+ Ka7 156. Qc6+ Kb8 157. Qd6+ Ka7 158. Qc6+ Kb8 159. Qd6+ Ka7 160. Qc6+ Kb8 161. Qd6+ Ka7 162. Qc6+ Kb8 163. Qd6+ Ka7 164. Qc6+ Kb8 165. Qd6+ Ka7 166. Qc6+ Kb8 167. Qd6+ Ka7 168. Qc6+ Kb8 169. Qd6+ Ka7 170. Qc6+ Kb8 171. Qd6+ Ka7 172. Qc6+ Kb8 173. Qd6+ Ka7 174. Qc6+ Kb8 175. Qd6+ Ka7 176. Qc6+ Kb8 177. Qd6+ Ka7 178. Qc6+ Kb8 179. Qd6+ Ka7 180. Qc6+ Kb8 181. Qd6+ Ka7 182. Qc6+ Kb8 183. Qd6+ Ka7 184. Qc6+ Kb8 185. Qd6+ Ka7 186. Qc6+ Kb8 187. Qd6+ Ka7 188. Qc6+ Kb8 189. Qd6+ Ka7 190. Qc6+ Kb8 191. Qd6+ Ka7 192. Qc6+ Kb8 193. Qd6+ Ka7 194. Qc6+ Kb8 195. Qd6+ Ka7 196. Qc6+ Kb8 197. Qd6+ Ka7 198. Qc6+ Kb8 199. Qd6+ Ka7 200. Qc6+ Kb8'
            ]
        ];

        foreach ($matchups as $index => $matchup) {
            $match = ChampionshipMatch::create([
                'championship_id' => $championship->id,
                'round_number' => 2,
                'round_type' => 'swiss',
                'white_player_id' => $matchup['white_player_id'],
                'black_player_id' => $matchup['black_player_id'],
                'status' => 'completed',
                'result_type' => $matchup['result'],
                'winner_id' => $matchup['winner_id'],
                'scheduled_at' => Carbon::now()->subDays(5),
                'deadline' => Carbon::now()->subDays(2),
                'completed_at' => Carbon::now()->subDays(3),
            ]);
        }

        echo "Created " . count($matchups) . " Round 2 matches (completed)\n";
    }

    private function generateRound3Matches(Championship $championship, array $participants): void
    {
        // Clear any existing round 3 matches
        ChampionshipMatch::where('championship_id', $championship->id)->where('round_number', 3)->delete();

        // Round 3: Selective round with top 3 players only
        // Based on tournament config: coverage_pairs [[1,2], [2,3]]
        // Matches: 1st vs 2nd, 2nd vs 3rd
        $matchups = [
            // Sanatan (1st) vs Arun Nalamara (2nd) - this should be the first match
            [
                'white_player_id' => $participants[0]->user_id, // Sanatan
                'black_player_id' => $participants[1]->user_id, // Arun Nalamara
            ],
            // Arun Nalamara (2nd) vs Arun Babu (3rd) - this should be the second match
            [
                'white_player_id' => $participants[1]->user_id, // Arun Nalamara
                'black_player_id' => $participants[2]->user_id, // Arun Babu
            ]
        ];

        foreach ($matchups as $index => $matchup) {
            $match = ChampionshipMatch::create([
                'championship_id' => $championship->id,
                'round_number' => 3,
                'round_type' => 'swiss',
                'white_player_id' => $matchup['white_player_id'],
                'black_player_id' => $matchup['black_player_id'],
                'status' => 'pending',
                'scheduled_at' => Carbon::now()->addHours(1), // Schedule for 1 hour from now
                'deadline' => Carbon::now()->addHours(73), // 72 hours window
            ]);
        }

        echo "Created " . count($matchups) . " Round 3 matches (pending - ready to play)\n";
    }

    private function updateStandings(Championship $championship, array $participants): void
    {
        // Clear existing standings
        ChampionshipStanding::where('championship_id', $championship->id)->delete();

        // Create standings based on desired results:
        // 1st: Sanatan (4 points - won 4 matches total)
        // 2nd: Arun Nalamara (2 points - won 2 matches total)
        // 3rd: Arun Babu (0 points - won 0 matches total)

        $standings = [
            [
                'user_id' => $participants[0]->user_id, // Sanatan
                'games_played' => 4,
                'games_won' => 4,
                'games_drawn' => 0,
                'games_lost' => 0,
                'points' => 4.0,
                'position' => 1,
                'tie_break_score' => 8.0, // Sum of opponents' scores
            ],
            [
                'user_id' => $participants[1]->user_id, // Arun Nalamara
                'games_played' => 4,
                'games_won' => 2,
                'games_drawn' => 0,
                'games_lost' => 2,
                'points' => 2.0,
                'position' => 2,
                'tie_break_score' => 4.0,
            ],
            [
                'user_id' => $participants[2]->user_id, // Arun Babu
                'games_played' => 4,
                'games_won' => 0,
                'games_drawn' => 0,
                'games_lost' => 4,
                'points' => 0.0,
                'position' => 3,
                'tie_break_score' => 2.0,
            ]
        ];

        foreach ($standings as $standing) {
            $standing['championship_id'] = $championship->id;
            ChampionshipStanding::create($standing);
        }

        echo "Updated championship standings\n";
    }

    private function getUserName(int $userId): string
    {
        $user = User::find($userId);
        return $user ? $user->name : 'Unknown User';
    }
}