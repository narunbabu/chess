# Tutorial System Setup Guide

Complete guide to setting up the tutorial system with migrations and seeders.

## Quick Start (All-in-One)

Run both migrations and seeders in one go:

```powershell
cd chess-backend
.\run-migrations.ps1
.\run-tutorial-seeder.ps1
```

That's it! Your tutorial system is now fully set up with:
- ✅ All database tables created
- ✅ Tutorial modules, lessons, and stages populated
- ✅ Progress tracking ready
- ✅ Achievement system initialized

---

## Step-by-Step Guide

### Step 1: Run Migrations

Create all required database tables:

```powershell
cd chess-backend
.\run-migrations.ps1
```

**OR** manually:

```powershell
php artisan migrate --force
```

**What this does:**
- Creates `tutorial_modules` table
- Creates `tutorial_lessons` table
- Creates `tutorial_achievements` table
- Creates `interactive_lesson_stages` table
- Creates `user_stage_progress` table (for progress tracking)
- Adds performance indexes

### Step 2: Run Seeders

Populate the database with tutorial content:

#### Option A: Comprehensive Seeder (Recommended)

```powershell
.\run-tutorial-seeder.ps1
```

This runs the **ComprehensiveTutorialSeeder** which includes:
- 6 Tutorial Modules (Beginner to Advanced)
- 20+ Lessons across all modules
- Interactive stages for hands-on learning
- Achievement system with 10+ achievements
- Complete piece movement training
- Chess basics (castling, en passant)
- Tactical patterns (forks, pins)
- Checkmate patterns

#### Option B: Run All Seeders

```powershell
.\run-tutorial-seeder.ps1 -All
```

This runs:
1. ComprehensiveTutorialSeeder
2. InteractiveLessonSeeder
3. GeneratedChallengesSeeder

#### Option C: Custom Selection

```powershell
.\run-tutorial-seeder.ps1 -Custom
```

Choose which seeders to run interactively.

#### Option D: Manual Seeder Commands

```powershell
# Main comprehensive seeder
php artisan db:seed --class=ComprehensiveTutorialSeeder

# Additional interactive lessons
php artisan db:seed --class=InteractiveLessonSeeder

# Extra challenges
php artisan db:seed --class=GeneratedChallengesSeeder
```

---

## Available Seeders

### 1. ComprehensiveTutorialSeeder ⭐ (Recommended)

**What it does:**
- Creates 6 tutorial modules with hierarchical progression
- Adds 20+ lessons with different types (theory, interactive, puzzle, practice)
- Creates interactive lesson stages for hands-on practice
- Sets up achievement system

**Modules included:**
1. **Introduction to Chess Pieces** (Beginner)
   - Pawn movement and captures
   - Rook movement and captures
   - Knight L-shaped movement
   - Bishop diagonal movement
   - Queen powerful movement
   - King movement and safety

2. **Chess Basics** (Beginner)
   - Chessboard and setup
   - Castling (kingside & queenside)
   - En passant special capture

3. **Basic Tactics** (Beginner)
   - Understanding forks
   - Fork puzzles
   - Understanding pins

4. **Basic Checkmates** (Beginner)
   - Queen and king checkmate
   - Two rook checkmate

5. **Opening Principles** (Intermediate)
   - Control the center
   - Development principles

6. **Advanced Endgames** (Advanced)
   - Rook endgame fundamentals

**Usage:**
```powershell
php artisan db:seed --class=ComprehensiveTutorialSeeder
```

---

### 2. InteractiveLessonSeeder

**What it does:**
- Adds specialized interactive lessons with multi-stage gameplay
- Creates hands-on practice exercises

**Lessons included:**
- Pawn Wars: The Breakthrough
- King Activity: Master Centralization
- Safe Squares: Navigate the Minefield
- Knight Mastery: The Dance
- Check Threats: Attack and Defense

**Usage:**
```powershell
php artisan db:seed --class=InteractiveLessonSeeder
```

---

### 3. TutorialContentSeeder (Legacy)

**What it does:**
- Original tutorial content seeder (less comprehensive)
- Use ComprehensiveTutorialSeeder instead for better content

**Usage:**
```powershell
php artisan db:seed --class=TutorialContentSeeder
```

---

### 4. GeneratedChallengesSeeder

**What it does:**
- Adds additional puzzle challenges
- Knight fork tactical puzzles
- Bishop movement theory

**Usage:**
```powershell
php artisan db:seed --class=GeneratedChallengesSeeder
```

---

## Verification

After running migrations and seeders, verify the setup:

### 1. Check Database Tables

```powershell
php artisan tinker
```

Then run:
```php
// Count modules
TutorialModule::count()

// Count lessons
TutorialLesson::count()

// Count stages
InteractiveLessonStage::count()

// Count achievements
TutorialAchievement::count()

// List all modules
TutorialModule::all()->pluck('name')
```

### 2. Test Frontend

1. Navigate to the Tutorial Hub in your browser
2. You should see all tutorial modules
3. Click on a module to see lessons
4. Try completing a lesson to test progress tracking

### 3. Test Progress Tracking

1. Complete any lesson in the tutorial system
2. Check browser console for:
   - `🎯 Completing lesson:` log
   - `✅ Lesson completion API response:` with XP awarded
3. Navigate back to Tutorial Hub
4. Progress percentages should update correctly

---

## Troubleshooting

### Migration Issues

**Problem:** Migration fails with "table already exists"

**Solution:**
```powershell
# Reset migrations (WARNING: destroys all data)
php artisan migrate:fresh

# Then run migrations again
php artisan migrate
```

---

### Seeder Issues

**Problem:** Seeder fails with foreign key constraint errors

**Solution:**
1. Make sure migrations ran successfully first
2. Try truncating tables and re-running:
   ```powershell
   php artisan db:seed --class=ComprehensiveTutorialSeeder --force
   ```

**Problem:** "Class not found" error

**Solution:**
```powershell
# Clear and regenerate autoload files
composer dump-autoload

# Then try seeder again
php artisan db:seed --class=ComprehensiveTutorialSeeder
```

---

### Progress Tracking Issues

**Problem:** Progress not saving after completing lessons

**Solution:**
1. Check that `user_stage_progress` table exists:
   ```powershell
   php artisan tinker
   Schema::hasTable('user_stage_progress')
   ```

2. If false, run the migration:
   ```powershell
   php artisan migrate --path=database/migrations/2025_11_19_100003_create_user_stage_progress_table.php
   ```

3. Check API endpoint is working:
   ```javascript
   // In browser console after completing a lesson
   // You should see network request to /api/tutorial/lessons/{id}/complete
   ```

---

## Database Schema Overview

### tutorial_modules
Stores tutorial module information (Chess Basics, Tactics, etc.)

### tutorial_lessons
Stores individual lessons within modules (theory, interactive, puzzle, practice)

### interactive_lesson_stages
Stores stages within interactive lessons (step-by-step exercises)

### user_stage_progress
**NEW** - Tracks user progress through lessons and awards XP

### tutorial_achievements
Stores achievement definitions and requirements

---

## Development Tips

### Adding New Content

1. **New Module:**
   - Add in seeder or create migration
   - Set `skill_tier`, `sort_order`, `unlock_requirement_id`

2. **New Lesson:**
   - Add to appropriate module
   - Set `lesson_type` (theory, interactive, puzzle, practice_game)
   - Define `content_data` based on type

3. **New Interactive Lesson:**
   - Create lesson with `lesson_type = 'interactive'`
   - Add stages with goals and success criteria
   - Define visual aids (arrows, highlights)

### Content Types

- **theory**: Slides with text, diagrams, quizzes
- **interactive**: Multi-stage hands-on exercises
- **puzzle**: Chess puzzles with solutions
- **practice_game**: Practice positions with AI

---

## Quick Reference Commands

```powershell
# Migrations
.\run-migrations.ps1                     # Run all pending migrations
php artisan migrate                      # Manual migration
php artisan migrate:rollback             # Rollback last migration
php artisan migrate:fresh                # Drop all tables and re-migrate

# Seeders
.\run-tutorial-seeder.ps1               # Run comprehensive seeder (recommended)
.\run-tutorial-seeder.ps1 -All          # Run all seeders
.\run-tutorial-seeder.ps1 -Custom       # Choose seeders interactively

# Database inspection
php artisan tinker                       # Interactive shell
php artisan db:show                      # Show database info
php artisan db:table tutorial_modules    # Show table structure

# Cache clearing (if changes don't reflect)
php artisan config:clear
php artisan cache:clear
php artisan route:clear
composer dump-autoload
```

---

## Next Steps

After setup:

1. ✅ Test the tutorial system in the frontend
2. ✅ Try completing a lesson to verify progress tracking
3. ✅ Check achievement system is working
4. ✅ Customize content by modifying seeders
5. ✅ Add new lessons/modules as needed

---

## Support

If you encounter issues:

1. Check the logs: `storage/logs/laravel.log`
2. Verify all migrations ran: `php artisan migrate:status`
3. Test database connection: `php artisan tinker` then `DB::connection()->getPdo()`
4. Ensure frontend API calls are correct
5. Check browser console for frontend errors
