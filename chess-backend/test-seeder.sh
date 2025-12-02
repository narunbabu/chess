#!/bin/bash

echo "🧪 Testing GeneratedChallengesSeeder..."
echo ""

# Check if we're in the right directory
if [ ! -f "artisan" ]; then
    echo "❌ Error: Must be run from chess-backend directory"
    exit 1
fi

echo "📊 Current lesson count:"
php artisan tinker --execute="echo 'Total Lessons: ' . App\Models\TutorialLesson::count() . PHP_EOL;"

echo ""
echo "🚀 Running GeneratedChallengesSeeder..."
php artisan db:seed --class=GeneratedChallengesSeeder

echo ""
echo "📊 New lesson count:"
php artisan tinker --execute="echo 'Total Lessons: ' . App\Models\TutorialLesson::count() . PHP_EOL;"

echo ""
echo "🔍 Checking new lessons:"
php artisan tinker --execute="
\$newLessons = App\Models\TutorialLesson::whereIn('slug', ['knight-fork-royal-family', 'bishop-movement-fundamentals'])->get(['id', 'title', 'lesson_type', 'xp_reward']);
foreach (\$newLessons as \$lesson) {
    echo '✅ ' . \$lesson->title . ' (' . \$lesson->lesson_type . ') - ' . \$lesson->xp_reward . ' XP' . PHP_EOL;
}
"

echo ""
echo "🎉 Test complete! Navigate to /tutorial in your browser to see the new challenges."
