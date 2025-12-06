#!/bin/bash
# ============================================================================
# Chess-Web Production Deployment Script
# ============================================================================
# This script handles deployment of both backend (Laravel) and frontend (React)
# For initial setup instructions, see: docs/PRODUCTION_DEPLOYMENT.md
# ============================================================================

set -e  # Exit on error

# Configuration
PROJECT_DIR="/opt/Chess-Web"
BACKEND_DIR="$PROJECT_DIR/chess-backend"
FRONTEND_DIR="$PROJECT_DIR/chess-frontend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# ============================================================================
# Main Deployment Script
# ============================================================================

echo "🚀 Starting Chess-Web deployment..."
echo "================================================"

# 1. Pull latest code
log_info "Pulling latest code from repository..."
cd "$PROJECT_DIR"
git pull origin master

# 2. Backend deployment
echo ""
log_info "Deploying backend..."
cd "$BACKEND_DIR"

log_info "Installing backend dependencies..."
sudo -u www-data COMPOSER_HOME=/var/www composer install --no-dev --optimize-autoloader --classmap-authoritative

log_info "Running database migrations..."
sudo -u www-data php artisan migrate --force

log_info "Restarting queue workers (if any)..."
php artisan queue:restart 2>/dev/null || log_warn "No queue workers to restart"

log_info "Clearing caches..."
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear

log_info "Optimizing application..."
php artisan config:cache
php artisan route:cache
php artisan view:cache

log_info "Setting up log rotation..."
# Ensure log rotation command exists
if php artisan list | grep -q "logs:rotate"; then
    log_info "Log rotation command available"

    # Set up Laravel scheduler cron job if not exists
    CRON_CMD="* * * * * cd $BACKEND_DIR && php artisan schedule:run >> /dev/null 2>&1"
    (crontab -u www-data -l 2>/dev/null | grep -q "artisan schedule:run") || {
        log_warn "Laravel scheduler cron job not found, adding it..."
        (crontab -u www-data -l 2>/dev/null; echo "$CRON_CMD") | crontab -u www-data -
        log_info "Laravel scheduler cron job installed"
    }

    # Verify scheduler is working
    if crontab -u www-data -l | grep -q "artisan schedule:run"; then
        log_info "Laravel scheduler configured correctly"
    else
        log_warn "Failed to configure Laravel scheduler - log rotation may not run automatically"
    fi
else
    log_warn "Log rotation command not found - run: php artisan make:command LogRotation"
fi

# 3. Frontend deployment
echo ""
log_info "Deploying frontend..."
cd "$FRONTEND_DIR"

log_info "Installing frontend dependencies..."
npm install

log_info "Building frontend..."
npm run build

log_info "Deploying frontend to web server..."
rsync -av --delete build/ /var/www/chess99.com/

# 4. Set correct permissions
echo ""
log_info "Setting permissions..."
chown -R www-data:www-data "$BACKEND_DIR/storage"
chown -R www-data:www-data "$BACKEND_DIR/bootstrap/cache"

# Only set SQLite permissions if using SQLite database
if [ -f "$BACKEND_DIR/database/database.sqlite" ]; then
    chmod 664 "$BACKEND_DIR/database/database.sqlite"
    log_info "Set SQLite database permissions"
fi

# 5. Restart services
echo ""
log_info "Restarting services..."

# Restart PHP-FPM
systemctl restart php8.3-fpm
log_info "PHP-FPM restarted"

# Restart Reverb WebSocket server
if systemctl is-enabled laravel-reverb >/dev/null 2>&1; then
    systemctl restart laravel-reverb
    log_info "Laravel Reverb restarted"
else
    log_warn "laravel-reverb service not found - WebSockets may not work"
    log_warn "Run: sudo systemctl enable laravel-reverb && sudo systemctl start laravel-reverb"
fi

# Reload Nginx
systemctl reload nginx
log_info "Nginx reloaded"

# 6. Health check
echo ""
log_info "Running health checks..."

# Check if nginx is running
if systemctl is-active --quiet nginx; then
    log_info "Nginx is running"
else
    log_error "Nginx is not running!"
    exit 1
fi

# Check if php-fpm is running
if systemctl is-active --quiet php8.3-fpm; then
    log_info "PHP-FPM is running"
else
    log_error "PHP-FPM is not running!"
    exit 1
fi

# Check if Reverb is running
if systemctl is-active --quiet laravel-reverb; then
    log_info "Laravel Reverb WebSocket server is running"
else
    log_warn "Laravel Reverb is NOT running - real-time features will not work!"
fi

# Check if database connection works
if sudo -u www-data php "$BACKEND_DIR/artisan" migrate:status >/dev/null 2>&1; then
    log_info "Database connection successful"
else
    log_error "Cannot connect to database!"
fi

echo ""
echo "================================================"
log_info "Deployment complete! ✅"
echo "================================================"
echo ""
echo "Next steps:"
echo "  • Check logs: tail -f $BACKEND_DIR/storage/logs/laravel.log"
echo "  • Monitor Nginx: tail -f /var/log/nginx/error.log"
echo "  • Test application in browser"
