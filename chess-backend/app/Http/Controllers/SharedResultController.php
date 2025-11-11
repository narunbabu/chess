<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;
use App\Models\SharedResult;

class SharedResultController extends Controller
{
    /**
     * Store a game result image and return shareable URL
     */
    public function store(Request $request)
    {
        try {
            $request->validate([
                'image' => 'required|string', // Base64 encoded image
                'game_id' => 'nullable|integer',
                'user_id' => 'nullable|integer',
                'result_data' => 'nullable|json',
            ]);

            // Decode base64 image
            $imageData = $request->input('image');

            // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
            if (preg_match('/^data:image\/(\w+);base64,/', $imageData, $matches)) {
                $imageData = substr($imageData, strpos($imageData, ',') + 1);
                $imageType = $matches[1];
            } else {
                $imageType = 'jpeg'; // Default to JPEG
            }

            $imageData = base64_decode($imageData);

            if ($imageData === false) {
                return response()->json([
                    'error' => 'Invalid image data'
                ], 400);
            }

            // Generate unique filename
            $uniqueId = Str::uuid();
            $filename = "game-result-{$uniqueId}.{$imageType}";

            // Store image in public storage
            $path = "shared-results/{$filename}";
            Storage::disk('public')->put($path, $imageData);

            // Save metadata to database
            $sharedResult = SharedResult::create([
                'unique_id' => $uniqueId,
                'game_id' => $request->input('game_id'),
                'user_id' => $request->input('user_id'),
                'image_path' => $path,
                'result_data' => $request->input('result_data'),
                'view_count' => 0,
            ]);

            // Generate shareable URL - use BACKEND URL so crawlers get meta tags
            $shareUrl = config('app.url') . '/share/result/' . $uniqueId;

            Log::info('Game result shared', [
                'unique_id' => $uniqueId,
                'game_id' => $request->input('game_id'),
                'share_url' => $shareUrl
            ]);

            return response()->json([
                'success' => true,
                'share_url' => $shareUrl,
                'unique_id' => $uniqueId,
                'image_url' => config('app.url') . '/storage/' . $path,
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to save shared result', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'error' => 'Failed to save game result',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get shared result by unique ID
     */
    public function show($uniqueId)
    {
        try {
            $sharedResult = SharedResult::where('unique_id', $uniqueId)->firstOrFail();

            // Increment view count
            $sharedResult->increment('view_count');

            // Get full image URL
            $imageUrl = config('app.url') . '/storage/' . $sharedResult->image_path;

            return response()->json([
                'success' => true,
                'data' => [
                    'unique_id' => $sharedResult->unique_id,
                    'game_id' => $sharedResult->game_id,
                    'image_url' => $imageUrl,
                    'result_data' => $sharedResult->result_data,
                    'view_count' => $sharedResult->view_count,
                    'created_at' => $sharedResult->created_at,
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to load shared result', [
                'unique_id' => $uniqueId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Shared result not found'
            ], 404);
        }
    }

    /**
     * Get Open Graph data for a shared result
     */
    public function getOgData($uniqueId)
    {
        try {
            $sharedResult = SharedResult::where('unique_id', $uniqueId)->firstOrFail();

            $imageUrl = config('app.url') . '/storage/' . $sharedResult->image_path;
            $resultData = json_decode($sharedResult->result_data, true);

            // Generate title and description from result data
            $title = 'Chess Game Result - Chess99.com';
            $description = 'Check out this amazing chess game result!';

            if ($resultData) {
                if (isset($resultData['winner'])) {
                    $title = $resultData['winner'] === 'player' ? 'Victory in Chess!' :
                             ($resultData['winner'] === 'draw' ? 'Chess Game Draw' : 'Chess Game Result');
                }

                if (isset($resultData['playerName']) && isset($resultData['opponentName'])) {
                    $description = "{$resultData['playerName']} vs {$resultData['opponentName']} - {$title}";
                }
            }

            return response()->json([
                'success' => true,
                'og_data' => [
                    'og:title' => $title,
                    'og:description' => $description,
                    'og:image' => $imageUrl,
                    'og:url' => config('app.frontend_url') . '/share/result/' . $uniqueId,
                    'og:type' => 'website',
                    'og:site_name' => 'Chess99.com',
                    'twitter:card' => 'summary_large_image',
                    'twitter:image' => $imageUrl,
                    'twitter:title' => $title,
                    'twitter:description' => $description,
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Shared result not found'
            ], 404);
        }
    }

    /**
     * Show HTML page with OG meta tags for social media crawlers
     * Detects crawlers and serves proper meta tags or redirects to React app
     */
    public function showHtml($uniqueId)
    {
        try {
            $sharedResult = SharedResult::where('unique_id', $uniqueId)->firstOrFail();

            // Increment view count
            $sharedResult->increment('view_count');

            $imageUrl = config('app.url') . '/storage/' . $sharedResult->image_path;
            $resultData = json_decode($sharedResult->result_data, true);

            // Generate title and description from result data
            $title = 'Chess Game Result - Chess99.com';
            $description = 'Check out this amazing chess game result!';

            if ($resultData) {
                if (isset($resultData['winner'])) {
                    $title = $resultData['winner'] === 'player' ? 'Victory in Chess!' :
                             ($resultData['winner'] === 'draw' ? 'Chess Game Draw' : 'Chess Game Result');
                }

                if (isset($resultData['playerName']) && isset($resultData['opponentName'])) {
                    $description = "{$resultData['playerName']} vs {$resultData['opponentName']} - {$title}";
                }
            }

            $shareUrl = config('app.frontend_url') . '/share/result/' . $uniqueId;

            // Detect if request is from a crawler/bot
            $userAgent = request()->header('User-Agent', '');
            $isCrawler = preg_match('/(bot|crawler|spider|facebook|twitter|whatsapp|telegram|slack)/i', $userAgent);

            // For crawlers: show the view with meta tags
            // For regular users: they'll be served by React app
            return view('shared-result', [
                'title' => $title,
                'description' => $description,
                'imageUrl' => $imageUrl,
                'shareUrl' => $shareUrl,
                'uniqueId' => $uniqueId,
                'isCrawler' => $isCrawler,
                'frontendUrl' => config('app.frontend_url'),
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to show shared result HTML', [
                'unique_id' => $uniqueId,
                'error' => $e->getMessage()
            ]);

            abort(404, 'Shared result not found');
        }
    }
}
