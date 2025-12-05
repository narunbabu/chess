 // Quick one-liner to delete all test tournaments
  \App\Models\Championship::where('is_test_tournament', true)->orWhere('title', 'LIKE',
  '[%]%')->get()->each(function($c) { $c->matches()->delete(); $c->standings()->delete();
  $c->participants()->delete(); $c->delete(); });