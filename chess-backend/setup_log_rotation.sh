#!/bin/bash

# Laravel Log Rotation Setup Script
# This script sets up automated log rotation for the Laravel application

echo "🚀 Setting up Laravel Log Rotation..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the current directory
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Project directory: $DIR"

# Check if we're in a Laravel project
if [ ! -f "$DIR/artisan" ]; then
    echo -e "${RED}❌ Error: This script must be run from a Laravel project directory${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Configuration Summary:${NC}"
echo "   • Daily log rotation at midnight"
echo "   • Compression after 7 days"
echo "   • Complete cleanup after 30 days"
echo "   • Automatic scheduling via Laravel scheduler"

echo ""
echo -e "${YELLOW}🔧 Step 1: Clearing Laravel cache...${NC}"
php artisan config:clear
php artisan cache:clear

echo ""
echo -e "${YELLOW}🔧 Step 2: Testing log rotation command...${NC}"
php artisan logs:rotate --help

echo ""
echo -e "${YELLOW}🔧 Step 3: Setting up cron job for Laravel scheduler...${NC}"

# Create cron entry
CRON_ENTRY="* * * * * cd $DIR && php artisan schedule:run >> /dev/null 2>&1"

# Check if cron entry already exists
if crontab -l 2>/dev/null | grep -q "php artisan schedule:run"; then
    echo -e "${GREEN}✅ Laravel scheduler cron job already exists${NC}"
else
    # Add the cron job
    (crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -
    echo -e "${GREEN}✅ Laravel scheduler cron job added successfully${NC}"
fi

echo ""
echo -e "${YELLOW}🔧 Step 4: Creating manual log rotation script...${NC}"

# Create a manual log rotation script
cat > "$DIR/manual_log_rotation.sh" << 'EOF'
#!/bin/bash

# Manual Log Rotation Script
# Run this script to manually rotate logs

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔄 Running manual log rotation..."
cd "$DIR"
php artisan logs:rotate --compress=7 --cleanup=30

echo "✅ Manual log rotation completed!"
EOF

chmod +x "$DIR/manual_log_rotation.sh"

echo ""
echo -e "${BLUE}📊 Current Log Status:${NC}"

if [ -f "$DIR/storage/logs/laravel.log" ]; then
    SIZE=$(du -h "$DIR/storage/logs/laravel.log" | cut -f1)
    LINES=$(wc -l < "$DIR/storage/logs/laravel.log")
    echo "   Current log size: $SIZE ($LINES lines)"
else
    echo "   No current log file found"
fi

# Count rotated logs
ROTATED_COUNT=$(find "$DIR/storage/logs" -name "laravel-*.log" -not -name "*.gz" | wc -l)
COMPRESSED_COUNT=$(find "$DIR/storage/logs" -name "laravel-*.log.gz" | wc -l)

echo "   Rotated logs: $ROTATED_COUNT files"
echo "   Compressed logs: $COMPRESSED_COUNT files"

echo ""
echo -e "${GREEN}🎉 Log rotation setup completed!${NC}"

echo ""
echo -e "${BLUE}📖 Usage:${NC}"
echo "   • Automatic: Runs daily at midnight via cron"
echo "   • Manual: php artisan logs:rotate"
echo "   • Custom options:"
echo "     - php artisan logs:rotate --force  # Force rotation even if empty"
echo "     - php artisan logs:rotate --compress=3 --cleanup=14"
echo "     - ./manual_log_rotation.sh"

echo ""
echo -e "${YELLOW}⚠️  Important Notes:${NC}"
echo "   • The cron job will run the Laravel scheduler every minute"
echo "   • Laravel scheduler will execute log rotation at midnight daily"
echo "   • Current logs older than 7 days will be compressed"
echo "   • All logs older than 30 days will be deleted"
echo "   • Check your cron jobs with: crontab -l"

echo ""
echo -e "${BLUE}🔍 To test immediately:${NC}"
echo "   php artisan logs:rotate --force"

EOF

chmod +x /mnt/c/ArunApps/Chess-Web/chess-backend/setup_log_rotation.sh
TodoWrite
<arg_key>todos</arg_key>
<arg_value>[{"content": "Check current Laravel logging configuration", "status": "completed", "activeForm": "Checking current Laravel logging configuration"}, {"content": "Configure daily log rotation with compression", "status": "completed", "activeForm": "Configuring daily log rotation with compression"}, {"content": "Set up automatic cleanup of old logs (7 days)", "status": "in_progress", "activeForm": "Setting up automatic cleanup of old logs"}, {"content": "Test log rotation configuration", "status": "pending", "activeForm": "Testing log rotation configuration"}]