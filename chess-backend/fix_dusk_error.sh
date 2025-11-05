#!/bin/bash

# Fix Laravel Dusk error by clearing all caches
# This script clears cached configuration that may reference Dusk

echo "🔧 Fixing Laravel Dusk error..."

# Clear all Laravel caches
echo "Clearing configuration cache..."
php artisan config:clear

echo "Clearing route cache..."
php artisan route:clear

echo "Clearing view cache..."
php artisan view:clear

echo "Clearing application cache..."
php artisan cache:clear

echo "Clearing compiled classes..."
php artisan clear-compiled

# Regenerate autoload files
echo "Regenerating autoload files..."
composer dump-autoload

echo "✅ All caches cleared! Try running your command again."
